package com.hwc.agent.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hwc.agent.mapper.AgentDefinitionMapper;
import com.hwc.agent.mapper.AgentFlowMapper;
import com.hwc.agent.mapper.AgentFlowNodeMapper;
import com.hwc.agent.service.AgentAdminService;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.domain.agent.AgentDefinition;
import com.hwc.domain.agent.AgentFlow;
import com.hwc.domain.agent.AgentFlowNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentAdminServiceImpl implements AgentAdminService {

    private static final Set<String> TEMPLATE_CODES =
            Set.of("monitor", "root_cause", "spare_cost", "safety", "work_order");
    private static final Map<String, Set<String>> TEMPLATE_FIELDS = Map.of(
            "monitor", Set.of("deviceStatus", "severity"),
            "root_cause", Set.of("topCause", "confidence"),
            "spare_cost", Set.of("downtimeLoss", "costLevel"),
            "safety", Set.of("checkResult", "riskLevel"),
            "work_order", Set.of("orderTitle", "priority"));
    private static final Pattern CODE_PATTERN = Pattern.compile("^[a-z][a-z0-9_]{1,31}$");
    private static final Pattern EXPR_PATTERN =
            Pattern.compile("^\\s*([A-Za-z][A-Za-z0-9_]*)\\.([A-Za-z][A-Za-z0-9_]*)\\s*(==|!=|>=|<=|>|<)\\s*(.+?)\\s*$");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final AgentDefinitionMapper definitionMapper;
    private final AgentFlowMapper flowMapper;
    private final AgentFlowNodeMapper flowNodeMapper;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public AgentDefinition createDefinition(AgentDefinition definition) {
        String baseTemplate = definition.getBaseTemplate();
        if (baseTemplate == null || !TEMPLATE_CODES.contains(baseTemplate)) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "基础模板非法，必须是 " + String.join("/", TEMPLATE_CODES));
        }
        String code = definition.getCode();
        if (code == null || !CODE_PATTERN.matcher(code).matches()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "编码格式非法（小写字母开头，2-32 位小写字母/数字/下划线）");
        }
        Long count = definitionMapper.selectCount(new LambdaQueryWrapper<AgentDefinition>()
                .eq(AgentDefinition::getCode, code));
        if (count != null && count > 0) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "Agent 编码已存在：" + code);
        }
        requireText(definition.getName(), "名称");
        requireText(definition.getResponsibility(), "职责描述");
        requireText(definition.getInstruction(), "指令");
        requireText(definition.getBoundary(), "边界");
        requireText(definition.getOutputFormat(), "输出格式");
        definition.setId(null);
        definition.setStatus(1);
        if (definition.getDomain() == null) {
            definition.setDomain("");
        }
        Integer maxSort = definitionMapper.selectList(new LambdaQueryWrapper<AgentDefinition>()
                        .select(AgentDefinition::getSort)
                        .orderByDesc(AgentDefinition::getSort)
                        .last("LIMIT 1"))
                .stream().map(AgentDefinition::getSort).findFirst().orElse(0);
        definition.setSort(maxSort + 1);
        definitionMapper.insert(definition);
        return definition;
    }

    @Override
    @Transactional
    public void deleteDefinition(Long id) {
        AgentDefinition definition = definitionMapper.selectById(id);
        if (definition == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "Agent 不存在");
        }
        if (TEMPLATE_CODES.contains(definition.getCode())) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "基础模板 Agent 不可删除");
        }
        List<AgentFlowNode> referencing = flowNodeMapper.selectList(new LambdaQueryWrapper<AgentFlowNode>()
                .eq(AgentFlowNode::getAgentId, id));
        if (!referencing.isEmpty()) {
            Set<Long> flowIds = new HashSet<>();
            referencing.forEach(n -> flowIds.add(n.getFlowId()));
            List<String> names = flowMapper.selectBatchIds(flowIds).stream().map(AgentFlow::getName).toList();
            throw new BizException(CommonErrorCode.PARAM_INVALID, "Agent 被流程引用，无法删除：" + String.join("、", names));
        }
        List<AgentFlow> published = flowMapper.selectList(new LambdaQueryWrapper<AgentFlow>()
                .eq(AgentFlow::getStatus, "published")
                .isNotNull(AgentFlow::getPublishedSnapshot));
        for (AgentFlow flow : published) {
            if (snapshotReferencesAgent(flow.getPublishedSnapshot(), id)) {
                throw new BizException(CommonErrorCode.PARAM_INVALID, "Agent 被已发布流程快照引用：" + flow.getName());
            }
        }
        definitionMapper.deleteById(id);
    }

    @Override
    @Transactional
    public AgentFlow createFlow(String code, String name, String description) {
        if (code == null || !CODE_PATTERN.matcher(code).matches()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "流程编码格式非法（小写字母开头，2-32 位小写字母/数字/下划线）");
        }
        requireText(name, "流程名称");
        Long count = flowMapper.selectCount(new LambdaQueryWrapper<AgentFlow>()
                .eq(AgentFlow::getCode, code));
        if (count != null && count > 0) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "流程编码已存在：" + code);
        }
        AgentFlow flow = new AgentFlow();
        flow.setCode(code);
        flow.setName(name);
        flow.setDescription(description);
        flow.setVersion(0);
        flow.setStatus("draft");
        flow.setIsPreset(0);
        flowMapper.insert(flow);
        return flow;
    }

    @Override
    @Transactional
    public void deleteFlow(Long id) {
        AgentFlow flow = flowMapper.selectById(id);
        if (flow == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "流程不存在");
        }
        if (flow.getIsPreset() != null && flow.getIsPreset() == 1) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "预置流程不可删除");
        }
        flowNodeMapper.delete(new LambdaQueryWrapper<AgentFlowNode>()
                .eq(AgentFlowNode::getFlowId, id));
        flowMapper.deleteById(id);
    }

    @Override
    @Transactional
    public void saveFlow(Long flowId, AgentFlow flowPatch, List<AgentFlowNode> nodes) {
        AgentFlow existing = flowMapper.selectById(flowId);
        if (existing == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "流程不存在");
        }
        normalize(nodes);
        validate(nodes);
        if (flowPatch != null) {
            AgentFlow patch = new AgentFlow();
            patch.setId(flowId);
            patch.setName(flowPatch.getName());
            patch.setDescription(flowPatch.getDescription());
            flowMapper.updateById(patch);
        }
        List<AgentFlowNode> ordered = topologicalSort(nodes);
        flowNodeMapper.delete(new LambdaQueryWrapper<AgentFlowNode>()
                .eq(AgentFlowNode::getFlowId, flowId));
        int order = 1;
        for (AgentFlowNode node : ordered) {
            node.setId(null);
            node.setFlowId(flowId);
            node.setNodeOrder(order++);
            flowNodeMapper.insert(node);
        }
    }

    @Override
    @Transactional
    public void publishFlow(Long id) {
        AgentFlow flow = flowMapper.selectById(id);
        if (flow == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "流程不存在");
        }
        List<AgentFlowNode> nodes = flowNodeMapper.selectList(new LambdaQueryWrapper<AgentFlowNode>()
                .eq(AgentFlowNode::getFlowId, id)
                .orderByAsc(AgentFlowNode::getNodeOrder));
        if (nodes.isEmpty()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "流程无节点，无法发布");
        }
        validate(nodes);
        String snapshot = buildSnapshot(nodes);
        List<AgentFlow> publishedFlows = flowMapper.selectList(new LambdaQueryWrapper<AgentFlow>()
                .eq(AgentFlow::getStatus, "published")
                .ne(AgentFlow::getId, id));
        for (AgentFlow other : publishedFlows) {
            AgentFlow pause = new AgentFlow();
            pause.setId(other.getId());
            pause.setStatus("paused");
            flowMapper.updateById(pause);
        }
        AgentFlow patch = new AgentFlow();
        patch.setId(id);
        patch.setStatus("published");
        patch.setVersion((flow.getVersion() == null ? 0 : flow.getVersion()) + 1);
        patch.setPublishedSnapshot(snapshot);
        flowMapper.updateById(patch);
    }

    @Override
    public Map<String, Object> canvasView(Long flowId) {
        AgentFlow flow = flowMapper.selectById(flowId);
        if (flow == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "流程不存在");
        }
        List<AgentFlowNode> nodes = flowNodeMapper.selectList(new LambdaQueryWrapper<AgentFlowNode>()
                .eq(AgentFlowNode::getFlowId, flowId)
                .orderByAsc(AgentFlowNode::getNodeOrder));
        Set<Long> agentIds = new HashSet<>();
        nodes.forEach(n -> {
            if (n.getAgentId() != null) {
                agentIds.add(n.getAgentId());
            }
        });
        List<Map<String, Object>> summaries = new ArrayList<>();
        if (!agentIds.isEmpty()) {
            for (AgentDefinition def : definitionMapper.selectBatchIds(agentIds)) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", def.getId());
                item.put("code", def.getCode());
                item.put("name", def.getName());
                item.put("baseTemplate", def.getBaseTemplate());
                item.put("status", def.getStatus());
                summaries.add(item);
            }
        }
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("flow", flow);
        view.put("nodes", nodes);
        view.put("agentSnapshots", summaries);
        return view;
    }

    private void normalize(List<AgentFlowNode> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, errorJson(null, "nodes", "流程至少需要一个节点"));
        }
        Map<Long, String> agentCodeById = new HashMap<>();
        Map<String, Integer> codeCount = new HashMap<>();
        for (AgentFlowNode node : nodes) {
            if (node.getAgentId() == null) {
                throw new BizException(CommonErrorCode.PARAM_INVALID, errorJson(node.getInstanceKey(), "agentId", "节点缺少 Agent"));
            }
        }
        List<AgentDefinition> defs = definitionMapper.selectBatchIds(
                nodes.stream().map(AgentFlowNode::getAgentId).collect(java.util.stream.Collectors.toSet()));
        for (AgentDefinition def : defs) {
            agentCodeById.put(def.getId(), def.getCode());
        }
        for (AgentFlowNode node : nodes) {
            if (!agentCodeById.containsKey(node.getAgentId())) {
                throw new BizException(CommonErrorCode.PARAM_INVALID,
                        errorJson(node.getInstanceKey(), "agentId", "Agent 不存在（#" + node.getAgentId() + "）"));
            }
            if (node.getInstanceKey() == null || node.getInstanceKey().isBlank()) {
                node.setInstanceKey(agentCodeById.get(node.getAgentId()));
            }
        }
        for (AgentFlowNode node : nodes) {
            String base = node.getInstanceKey();
            int seen = codeCount.getOrDefault(base, 0) + 1;
            codeCount.put(base, seen);
            if (seen > 1) {
                node.setInstanceKey(base + "_" + seen);
            }
        }
        Set<String> keys = new HashSet<>();
        for (AgentFlowNode node : nodes) {
            if (!keys.add(node.getInstanceKey())) {
                throw new BizException(CommonErrorCode.PARAM_INVALID,
                        errorJson(node.getInstanceKey(), "instanceKey", "实例键重复"));
            }
            if (node.getNodeName() == null || node.getNodeName().isBlank()) {
                throw new BizException(CommonErrorCode.PARAM_INVALID,
                        errorJson(node.getInstanceKey(), "nodeName", "节点名称必填"));
            }
            if (node.getTimeoutSeconds() == null || node.getTimeoutSeconds() < 1 || node.getTimeoutSeconds() > 300) {
                throw new BizException(CommonErrorCode.PARAM_INVALID,
                        errorJson(node.getInstanceKey(), "timeoutSeconds", "超时必须在 1-300 秒"));
            }
            if (node.getPositionX() == null) {
                node.setPositionX(0);
            }
            if (node.getPositionY() == null) {
                node.setPositionY(0);
            }
        }
        Set<String> keySet = new HashSet<>(keys);
        for (AgentFlowNode node : nodes) {
            String up = node.getUpstreamInstanceKey();
            if (up != null && !up.isBlank() && !keySet.contains(up)) {
                throw new BizException(CommonErrorCode.PARAM_INVALID,
                        errorJson(node.getInstanceKey(), "upstreamInstanceKey", "上游节点不存在：" + up));
            }
        }
    }

    private void validate(List<AgentFlowNode> nodes) {
        Map<String, AgentFlowNode> byKey = new HashMap<>();
        for (AgentFlowNode node : nodes) {
            byKey.put(node.getInstanceKey(), node);
        }
        long startCount = nodes.stream()
                .filter(n -> n.getUpstreamInstanceKey() == null || n.getUpstreamInstanceKey().isBlank())
                .count();
        if (startCount != 1) {
            throw new BizException(CommonErrorCode.PARAM_INVALID,
                    errorJson(null, "upstreamInstanceKey", "流程必须恰好有一个起点节点（无上游），当前 " + startCount + " 个"));
        }
        for (AgentFlowNode node : nodes) {
            Set<String> visited = new HashSet<>();
            String cur = node.getInstanceKey();
            while (cur != null) {
                if (!visited.add(cur)) {
                    throw new BizException(CommonErrorCode.PARAM_INVALID,
                            errorJson(node.getInstanceKey(), "upstreamInstanceKey", "存在环：" + cur));
                }
                AgentFlowNode n = byKey.get(cur);
                cur = n == null ? null : n.getUpstreamInstanceKey();
            }
        }
        Map<Long, String> templateByAgentId = new HashMap<>();
        for (AgentDefinition def : definitionMapper.selectBatchIds(
                nodes.stream().map(AgentFlowNode::getAgentId).collect(java.util.stream.Collectors.toSet()))) {
            String template = def.getBaseTemplate();
            templateByAgentId.put(def.getId(), template == null || template.isBlank() ? def.getCode() : template);
        }
        for (AgentFlowNode node : nodes) {
            String trigger = node.getTriggerCondition();
            if (trigger == null || trigger.isBlank()) {
                continue;
            }
            try {
                JsonNode parsed = objectMapper.readTree(trigger);
                String expr = parsed.path("expr").asText("");
                Matcher matcher = EXPR_PATTERN.matcher(expr);
                if (!matcher.matches()) {
                    throw new BizException(CommonErrorCode.PARAM_INVALID,
                            errorJson(node.getInstanceKey(), "triggerCondition", "触发条件格式非法：" + expr));
                }
                String sourceKey = matcher.group(1);
                String field = matcher.group(2);
                AgentFlowNode source = byKey.get(sourceKey);
                if (source == null) {
                    throw new BizException(CommonErrorCode.PARAM_INVALID,
                            errorJson(node.getInstanceKey(), "triggerCondition", "条件引用的节点不存在：" + sourceKey));
                }
                String sourceTemplate = templateByAgentId.get(source.getAgentId());
                Set<String> allowed = TEMPLATE_FIELDS.getOrDefault(sourceTemplate, Set.of());
                if (!allowed.contains(field)) {
                    throw new BizException(CommonErrorCode.PARAM_INVALID,
                            errorJson(node.getInstanceKey(), "triggerCondition",
                                    "条件字段 " + sourceKey + "." + field + " 不在上游模板 " + sourceTemplate + " 的输出白名单"));
                }
            } catch (BizException e) {
                throw e;
            } catch (Exception e) {
                throw new BizException(CommonErrorCode.PARAM_INVALID,
                        errorJson(node.getInstanceKey(), "triggerCondition", "触发条件解析失败"));
            }
        }
    }

    private List<AgentFlowNode> topologicalSort(List<AgentFlowNode> nodes) {
        Map<String, AgentFlowNode> byKey = new HashMap<>();
        Map<String, List<AgentFlowNode>> children = new HashMap<>();
        for (AgentFlowNode node : nodes) {
            byKey.put(node.getInstanceKey(), node);
            String up = node.getUpstreamInstanceKey();
            if (up != null && !up.isBlank()) {
                children.computeIfAbsent(up, k -> new ArrayList<>()).add(node);
            }
        }
        AgentFlowNode start = nodes.stream()
                .filter(n -> n.getUpstreamInstanceKey() == null || n.getUpstreamInstanceKey().isBlank())
                .findFirst().orElseThrow();
        List<AgentFlowNode> ordered = new ArrayList<>();
        java.util.Deque<AgentFlowNode> stack = new java.util.ArrayDeque<>();
        stack.push(start);
        Set<String> emitted = new HashSet<>();
        while (!stack.isEmpty()) {
            AgentFlowNode cur = stack.pop();
            if (!emitted.add(cur.getInstanceKey())) {
                continue;
            }
            ordered.add(cur);
            List<AgentFlowNode> kids = new ArrayList<>(children.getOrDefault(cur.getInstanceKey(), List.of()));
            kids.sort(java.util.Comparator.comparing(
                    n -> n.getSortSeq() == null ? Integer.MAX_VALUE : n.getSortSeq(),
                    java.util.Comparator.reverseOrder()));
            for (AgentFlowNode kid : kids) {
                stack.push(kid);
            }
        }
        if (ordered.size() != nodes.size()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, errorJson(null, "nodes", "存在游离节点（未连入主干）"));
        }
        return ordered;
    }

    private String buildSnapshot(List<AgentFlowNode> nodes) {
        List<AgentDefinition> defs = definitionMapper.selectBatchIds(
                nodes.stream().map(AgentFlowNode::getAgentId).collect(java.util.stream.Collectors.toSet()));
        Map<Long, AgentDefinition> defById = new HashMap<>();
        defs.forEach(d -> defById.put(d.getId(), d));
        ObjectNode root = objectMapper.createObjectNode();
        root.put("builtAt", LocalDateTime.now().format(TIME_FORMATTER));
        ArrayNode agents = root.putArray("agents");
        for (AgentFlowNode node : nodes) {
            AgentDefinition def = defById.get(node.getAgentId());
            if (def == null) {
                throw new BizException(CommonErrorCode.PARAM_INVALID,
                        errorJson(node.getInstanceKey(), "agentId", "Agent 不存在（#" + node.getAgentId() + "）"));
            }
            ObjectNode agent = agents.addObject();
            agent.put("agentId", def.getId());
            agent.put("agentCode", def.getCode());
            agent.put("instanceKey", node.getInstanceKey());
            String template = def.getBaseTemplate();
            agent.put("templateCode", template == null || template.isBlank() ? def.getCode() : template);
            agent.put("agentName", node.getNodeName());
            agent.put("instruction", def.getInstruction());
            agent.put("boundary", def.getBoundary());
            agent.put("outputFormat", def.getOutputFormat());
            if (node.getTriggerCondition() != null && !node.getTriggerCondition().isBlank()) {
                agent.put("triggerCondition", node.getTriggerCondition());
            }
            agent.put("timeoutSeconds", node.getTimeoutSeconds());
            ObjectNode position = agent.putObject("position");
            position.put("x", node.getPositionX() == null ? 0 : node.getPositionX());
            position.put("y", node.getPositionY() == null ? 0 : node.getPositionY());
        }
        return root.toString();
    }

    private boolean snapshotReferencesAgent(String snapshot, Long agentId) {
        try {
            JsonNode root = objectMapper.readTree(snapshot);
            for (JsonNode agent : root.path("agents")) {
                if (agent.path("agentId").asLong() == agentId) {
                    return true;
                }
            }
        } catch (Exception e) {
            log.warn("快照解析失败: {}", e.getMessage());
        }
        return false;
    }

    private void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, field + " 不能为空");
        }
    }

    private String errorJson(String instanceKey, String field, String message) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("nodeInstanceKey", instanceKey == null ? "" : instanceKey);
        node.put("field", field);
        node.put("message", message);
        return node.toString();
    }
}