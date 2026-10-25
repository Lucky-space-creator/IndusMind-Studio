package com.hwc.agent.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.aiclient.client.AgentClient;
import com.hwc.aiclient.model.Citation;
import com.hwc.aiclient.model.DiagnosisRunRequest;
import com.hwc.aiclient.model.DiagnosisRunResponse;
import com.hwc.agent.mapper.AgentDefinitionMapper;
import com.hwc.agent.mapper.AgentFlowMapper;
import com.hwc.agent.mapper.AgentFlowNodeMapper;
import com.hwc.agent.mapper.AgentRunMapper;
import com.hwc.agent.mapper.AgentStepMapper;
import com.hwc.agent.mapper.AgentToolBindingMapper;
import com.hwc.agent.mapper.DiagnosisRecordMapper;
import com.hwc.agent.service.DiagnosisService;
import com.hwc.common.context.TraceContext;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.device.api.DeviceQueryFacade;
import com.hwc.devicedata.api.DataQueryFacade;
import com.hwc.domain.agent.AgentDefinition;
import com.hwc.domain.agent.AgentFlow;
import com.hwc.domain.agent.AgentFlowNode;
import com.hwc.domain.agent.AgentRun;
import com.hwc.domain.agent.AgentStep;
import com.hwc.domain.agent.AgentToolBinding;
import com.hwc.domain.agent.DiagnosisRecord;
import com.hwc.domain.device.DevInfo;
import com.hwc.domain.device.DevMetric;
import com.hwc.domain.devicedata.DataAnomaly;
import com.hwc.domain.devicedata.DataDataset;
import com.hwc.knowledge.api.KnowledgeQueryFacade;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 多 Agent 协同诊断：组装异常清单与 Agent 编排配置，调用 /diagnosis/run 并落库运行轨迹。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DiagnosisServiceImpl implements DiagnosisService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int MAX_ANOMALIES = 100;

    private final AgentDefinitionMapper definitionMapper;
    private final AgentToolBindingMapper bindingMapper;
    private final AgentFlowMapper flowMapper;
    private final AgentFlowNodeMapper flowNodeMapper;
    private final AgentRunMapper runMapper;
    private final AgentStepMapper stepMapper;
    private final DiagnosisRecordMapper diagnosisMapper;
    private final AgentClient agentClient;
    private final DeviceQueryFacade deviceQueryFacade;
    private final DataQueryFacade dataQueryFacade;
    private final KnowledgeQueryFacade knowledgeQueryFacade;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public DiagnosisRunResponse run(Long deviceId, Long datasetId, Long flowId, String phenomenon) {
        DevInfo device = deviceQueryFacade.getDevice(deviceId);
        if (device == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "设备不存在");
        }
        DataDataset dataset = dataQueryFacade.getDataset(datasetId);
        if (dataset == null || !dataset.getDeviceId().equals(deviceId)) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "数据集不存在或不属于该设备");
        }
        List<DataAnomaly> anomalies = dataQueryFacade.listAnomalies(datasetId, MAX_ANOMALIES);
        if (anomalies.isEmpty()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "数据集无异常记录，请先执行异常提取");
        }

        AgentFlow flow = resolveFlow(flowId);

        DiagnosisRunRequest request;
        if (flow.getPublishedSnapshot() != null && !flow.getPublishedSnapshot().isBlank()) {
            request = buildRequestFromSnapshot(device, datasetId, flow, anomalies, phenomenon);
        } else {
            List<AgentFlowNode> nodes = flowNodeMapper.selectList(new LambdaQueryWrapper<AgentFlowNode>()
                    .eq(AgentFlowNode::getFlowId, flow.getId())
                    .orderByAsc(AgentFlowNode::getNodeOrder));
            if (nodes.isEmpty()) {
                throw new BizException(CommonErrorCode.PARAM_INVALID, "协同流程未配置节点");
            }
            request = buildRequest(device, datasetId, flow, nodes, anomalies, phenomenon);
        }

        AgentRun agentRun = new AgentRun();
        agentRun.setRunType("multi");
        agentRun.setFlowId(flow.getId());
        agentRun.setDeviceId(deviceId);
        agentRun.setDatasetId(datasetId);
        agentRun.setInput(phenomenon == null || phenomenon.isBlank()
                ? null : toJson(Map.of("phenomenon", phenomenon)));
        agentRun.setStatus("running");
        agentRun.setStartedAt(LocalDateTime.now());
        agentRun.setTraceId(TraceContext.getTraceId());
        runMapper.insert(agentRun);

        try {
            DiagnosisRunResponse response = agentClient.runDiagnosis(request);
            persistResult(agentRun, response, deviceId, datasetId);
            response.setRunId(String.valueOf(agentRun.getId()));
            return response;
        } catch (BizException e) {
            agentRun.setStatus("failed");
            agentRun.setErrorMsg(e.getMessage());
            agentRun.setEndedAt(LocalDateTime.now());
            runMapper.updateById(agentRun);
            throw e;
        }
    }

    private DiagnosisRunRequest buildRequest(DevInfo device, Long datasetId, AgentFlow flow,
                                             List<AgentFlowNode> nodes, List<DataAnomaly> anomalies,
                                             String phenomenon) {
        Map<Long, AgentDefinition> definitions = definitionMapper.selectList(
                        new LambdaQueryWrapper<AgentDefinition>().eq(AgentDefinition::getStatus, 1))
                .stream().collect(Collectors.toMap(AgentDefinition::getId, Function.identity(), (a, b) -> a));
        Map<Long, AgentToolBinding> bindings = bindingMapper.selectList(null)
                .stream().collect(Collectors.toMap(AgentToolBinding::getAgentId, Function.identity(), (a, b) -> a));
        Map<Long, DevMetric> metrics = deviceQueryFacade.getMetricMap(
                anomalies.stream().map(DataAnomaly::getMetricId).filter(id -> id != null).distinct().toList());

        DiagnosisRunRequest request = new DiagnosisRunRequest();
        request.setDeviceId(device.getId());
        request.setDeviceName(device.getName());
        request.setDatasetId(datasetId);
        request.setFlowId(flow.getId());
        request.setPhenomenon(phenomenon);
        request.setAnomalies(anomalies.stream().map(item -> toAnomalyItem(item, metrics)).toList());

        List<DiagnosisRunRequest.AgentConfig> agentConfigs = new ArrayList<>();
        for (AgentFlowNode node : nodes) {
            AgentDefinition definition = definitions.get(node.getAgentId());
            if (definition == null) {
                continue;
            }
            AgentToolBinding binding = bindings.get(definition.getId());
            DiagnosisRunRequest.AgentConfig config = new DiagnosisRunRequest.AgentConfig();
            config.setAgentCode(definition.getCode());
            config.setInstanceKey(node.getInstanceKey() != null && !node.getInstanceKey().isBlank()
                    ? node.getInstanceKey() : definition.getCode());
            String baseTemplate = definition.getBaseTemplate();
            config.setTemplateCode(baseTemplate != null && !baseTemplate.isBlank()
                    ? baseTemplate : definition.getCode());
            config.setAgentName(node.getNodeName() != null && !node.getNodeName().isBlank()
                    ? node.getNodeName() : definition.getName());
            config.setInstruction(definition.getInstruction());
            config.setBoundary(definition.getBoundary());
            config.setOutputFormat(definition.getOutputFormat());
            config.setKbIds(resolveKbIds(binding, device.getTypeId()));
            config.setMatchStrictness(binding != null && binding.getMatchStrictness() != null
                    ? binding.getMatchStrictness() : "medium");
            config.setTools(parseStringList(binding != null ? binding.getTools() : null));
            config.setTriggerCondition(node.getTriggerCondition());
            config.setTimeoutSeconds(node.getTimeoutSeconds());
            agentConfigs.add(config);
        }
        request.setAgents(agentConfigs);
        return request;
    }

    private DiagnosisRunRequest buildRequestFromSnapshot(DevInfo device, Long datasetId, AgentFlow flow,
                                                          List<DataAnomaly> anomalies, String phenomenon) {
        List<DiagnosisRunRequest.AgentConfig> agentConfigs = new ArrayList<>();
        try {
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(flow.getPublishedSnapshot());
            for (com.fasterxml.jackson.databind.JsonNode agent : root.path("agents")) {
                DiagnosisRunRequest.AgentConfig config = new DiagnosisRunRequest.AgentConfig();
                config.setAgentCode(agent.path("agentCode").asText(null));
                config.setInstanceKey(agent.path("instanceKey").asText(null));
                config.setTemplateCode(agent.path("templateCode").asText(null));
                config.setAgentName(agent.path("agentName").asText(null));
                config.setInstruction(agent.path("instruction").asText(null));
                config.setBoundary(agent.path("boundary").asText(null));
                config.setOutputFormat(agent.path("outputFormat").asText(null));
                config.setTriggerCondition(agent.path("triggerCondition").asText(null));
                config.setTimeoutSeconds(agent.path("timeoutSeconds").asInt(120));
                Long agentId = agent.path("agentId").asLong();
                AgentToolBinding binding = bindingMapper.selectOne(new LambdaQueryWrapper<AgentToolBinding>()
                        .eq(AgentToolBinding::getAgentId, agentId));
                config.setKbIds(resolveKbIds(binding, device.getTypeId()));
                config.setMatchStrictness(binding != null && binding.getMatchStrictness() != null
                        ? binding.getMatchStrictness() : "medium");
                config.setTools(parseStringList(binding != null ? binding.getTools() : null));
                agentConfigs.add(config);
            }
        } catch (Exception e) {
            log.warn("流程快照解析失败，回退节点表 flowId={} err={}", flow.getId(), e.getMessage());
            List<AgentFlowNode> nodes = flowNodeMapper.selectList(new LambdaQueryWrapper<AgentFlowNode>()
                    .eq(AgentFlowNode::getFlowId, flow.getId())
                    .orderByAsc(AgentFlowNode::getNodeOrder));
            return buildRequest(device, datasetId, flow, nodes, anomalies, phenomenon);
        }
        if (agentConfigs.isEmpty()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "流程发布快照为空，请重新发布流程");
        }

        Map<Long, DevMetric> metrics = deviceQueryFacade.getMetricMap(
                anomalies.stream().map(DataAnomaly::getMetricId).filter(id -> id != null).distinct().toList());
        DiagnosisRunRequest request = new DiagnosisRunRequest();
        request.setDeviceId(device.getId());
        request.setDeviceName(device.getName());
        request.setDatasetId(datasetId);
        request.setFlowId(flow.getId());
        request.setPhenomenon(phenomenon);
        request.setAnomalies(anomalies.stream().map(item -> toAnomalyItem(item, metrics)).toList());
        request.setAgents(agentConfigs);
        return request;
    }

    private void persistResult(AgentRun agentRun, DiagnosisRunResponse response,
                               Long deviceId, Long datasetId) {
        agentRun.setStatus("success");
        agentRun.setEndedAt(LocalDateTime.now());
        agentRun.setConclusion(response.getConclusion());
        agentRun.setDurationMs((int) java.time.Duration.between(
                agentRun.getStartedAt(), agentRun.getEndedAt()).toMillis());
        runMapper.updateById(agentRun);

        Map<String, Long> codeToId = definitionMapper.selectList(null).stream()
                .collect(Collectors.toMap(AgentDefinition::getCode, AgentDefinition::getId, (a, b) -> a));
        for (DiagnosisRunResponse.StepResult step : response.getSteps() != null ? response.getSteps() : List.<DiagnosisRunResponse.StepResult>of()) {
            AgentStep agentStep = new AgentStep();
            agentStep.setRunId(agentRun.getId());
            agentStep.setStepOrder(step.getStepOrder());
            agentStep.setAgentId(codeToId.get(step.getAgentCode()));
            agentStep.setPhase(step.getAgentCode());
            agentStep.setSummary(step.getSummary());
            agentStep.setDetail(step.getOutput());
            agentStep.setCitations(toJson(step.getCitations()));
            agentStep.setDurationMs(step.getDurationMs());
            agentStep.setStatus(step.getStatus());
            stepMapper.insert(agentStep);
        }

        DiagnosisRecord record = new DiagnosisRecord();
        record.setRunId(agentRun.getId());
        record.setDeviceId(deviceId);
        record.setDatasetId(datasetId);
        record.setFaultSummary(findSummary(response, "monitor"));
        record.setRootCause(findSummary(response, "root_cause"));
        record.setRiskLevel(response.getRiskLevel());
        record.setSafetyConclusion(findSummary(response, "safety"));
        record.setCitations(toJson(response.getCitations()));
        record.setConclusionTime(LocalDateTime.now());
        diagnosisMapper.insert(record);
    }

    private DiagnosisRunRequest.AnomalyItem toAnomalyItem(DataAnomaly anomaly, Map<Long, DevMetric> metrics) {
        DiagnosisRunRequest.AnomalyItem item = new DiagnosisRunRequest.AnomalyItem();
        item.setMetricId(anomaly.getMetricId());
        DevMetric metric = metrics.get(anomaly.getMetricId());
        item.setMetricName(metric != null ? metric.getName() : String.valueOf(anomaly.getMetricId()));
        item.setAnomalyType(anomaly.getAnomalyType());
        item.setSeverity(anomaly.getSeverity());
        item.setStartTime(anomaly.getStartTime() != null ? anomaly.getStartTime().format(TIME_FORMATTER) : null);
        item.setEndTime(anomaly.getEndTime() != null ? anomaly.getEndTime().format(TIME_FORMATTER) : null);
        item.setPeakValue(anomaly.getPeakValue() != null ? anomaly.getPeakValue().doubleValue() : null);
        item.setAvgValue(anomaly.getAvgValue() != null ? anomaly.getAvgValue().doubleValue() : null);
        item.setSummary(anomaly.getSummary());
        return item;
    }

    private AgentFlow resolveFlow(Long flowId) {
        AgentFlow flow;
        if (flowId != null) {
            flow = flowMapper.selectById(flowId);
            if (flow == null) {
                throw new BizException(CommonErrorCode.NOT_FOUND, "协同流程不存在");
            }
        } else {
            flow = flowMapper.selectOne(new LambdaQueryWrapper<AgentFlow>()
                    .eq(AgentFlow::getIsPreset, 1)
                    .eq(AgentFlow::getStatus, "published")
                    .orderByAsc(AgentFlow::getId)
                    .last("LIMIT 1"));
            if (flow == null) {
                throw new BizException(CommonErrorCode.PARAM_INVALID, "暂无可用诊断流程，请联系管理员");
            }
        }
        if (!"published".equals(flow.getStatus())) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "协同流程未发布");
        }
        return flow;
    }

    private List<Long> resolveKbIds(AgentToolBinding binding, Long devTypeId) {
        if (binding == null || binding.getKbIds() == null || "null".equals(binding.getKbIds().trim())) {
            return knowledgeQueryFacade.listKbIdsByDevType(devTypeId);
        }
        return parseLongList(binding.getKbIds());
    }

    private List<Long> parseLongList(String json) {
        List<Long> result = new ArrayList<>();
        String body = trimBrackets(json);
        if (body.isEmpty()) {
            return result;
        }
        for (String token : body.split(",")) {
            token = token.trim();
            if (!token.isEmpty()) {
                result.add(Long.valueOf(token));
            }
        }
        return result;
    }

    private List<String> parseStringList(String json) {
        List<String> result = new ArrayList<>();
        String body = trimBrackets(json);
        if (body.isEmpty()) {
            return result;
        }
        for (String token : body.split(",")) {
            token = token.trim().replace("\"", "");
            if (!token.isEmpty()) {
                result.add(token);
            }
        }
        return result;
    }

    private String trimBrackets(String json) {
        if (json == null) {
            return "";
        }
        String body = json.trim();
        if (body.startsWith("[")) {
            body = body.substring(1);
        }
        if (body.endsWith("]")) {
            body = body.substring(0, body.length() - 1);
        }
        return body.trim();
    }

    private String findSummary(DiagnosisRunResponse response, String agentCode) {
        if (response.getSteps() == null) {
            return null;
        }
        for (DiagnosisRunResponse.StepResult step : response.getSteps()) {
            if (agentCode.equals(step.getAgentCode())) {
                return step.getSummary() != null ? step.getSummary() : step.getOutput();
            }
        }
        return null;
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("引用序列化失败: {}", e.getMessage());
            return null;
        }
    }
}