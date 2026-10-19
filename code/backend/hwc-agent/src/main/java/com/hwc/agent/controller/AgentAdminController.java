package com.hwc.agent.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.domain.agent.AgentDefinition;
import com.hwc.domain.agent.AgentFlow;
import com.hwc.domain.agent.AgentFlowNode;
import com.hwc.domain.agent.AgentToolBinding;
import com.hwc.agent.mapper.AgentDefinitionMapper;
import com.hwc.agent.mapper.AgentFlowMapper;
import com.hwc.agent.mapper.AgentFlowNodeMapper;
import com.hwc.agent.mapper.AgentToolBindingMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Agent 管理")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AgentAdminController {

    private final AgentDefinitionMapper definitionMapper;
    private final AgentToolBindingMapper bindingMapper;
    private final AgentFlowMapper flowMapper;
    private final AgentFlowNodeMapper flowNodeMapper;

    @Operation(summary = "Agent 定义分页")
    @GetMapping("/admin/agent/definitions")
    @PreAuthorize("hasAuthority('agent:definition:read')")
    public Result<PageResult<AgentDefinition>> pageDefinitions(@RequestParam(defaultValue = "1") long current,
                                                               @RequestParam(defaultValue = "10") long size,
                                                               @RequestParam(required = false) String keyword,
                                                               @RequestParam(required = false) String domain) {
        LambdaQueryWrapper<AgentDefinition> wrapper = new LambdaQueryWrapper<AgentDefinition>()
                .and(keyword != null && !keyword.isBlank(),
                        w -> w.like(AgentDefinition::getName, keyword).or().like(AgentDefinition::getCode, keyword))
                .eq(domain != null && !domain.isBlank(), AgentDefinition::getDomain, domain)
                .orderByAsc(AgentDefinition::getSort);
        Page<AgentDefinition> page = definitionMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "修改 Agent 定义")
    @PutMapping("/admin/agent/definitions/{id}")
    @PreAuthorize("hasAuthority('agent:definition:write')")
    public Result<Void> updateDefinition(@PathVariable Long id, @RequestBody AgentDefinition definition) {
        AgentDefinition existing = definitionMapper.selectById(id);
        if (existing == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "Agent 不存在");
        }
        definition.setId(id);
        definitionMapper.updateById(definition);
        return Result.ok();
    }

    @Operation(summary = "Agent 启停")
    @PutMapping("/admin/agent/definitions/{id}/status")
    @PreAuthorize("hasAuthority('agent:definition:write')")
    public Result<Void> switchDefinition(@PathVariable Long id, @RequestBody AgentDefinition body) {
        AgentDefinition definition = new AgentDefinition();
        definition.setId(id);
        definition.setStatus(body.getStatus());
        definitionMapper.updateById(definition);
        return Result.ok();
    }

    @Operation(summary = "工具与知识绑定列表")
    @GetMapping("/admin/agent/bindings")
    @PreAuthorize("hasAuthority('agent:binding:read')")
    public Result<List<AgentToolBinding>> listBindings(@RequestParam(required = false) Long agentId) {
        return Result.ok(bindingMapper.selectList(new LambdaQueryWrapper<AgentToolBinding>()
                .eq(agentId != null, AgentToolBinding::getAgentId, agentId)
                .orderByAsc(AgentToolBinding::getAgentId)));
    }

    @Operation(summary = "修改工具与知识绑定")
    @PutMapping("/admin/agent/bindings/{agentId}")
    @PreAuthorize("hasAuthority('agent:binding:write')")
    public Result<Void> updateBinding(@PathVariable Long agentId, @RequestBody AgentToolBinding binding) {
        AgentToolBinding existing = bindingMapper.selectOne(new LambdaQueryWrapper<AgentToolBinding>()
                .eq(AgentToolBinding::getAgentId, agentId));
        if (existing == null) {
            binding.setAgentId(agentId);
            bindingMapper.insert(binding);
        } else {
            binding.setId(existing.getId());
            binding.setAgentId(agentId);
            bindingMapper.updateById(binding);
        }
        return Result.ok();
    }

    @Operation(summary = "协同流程分页")
    @GetMapping("/admin/agent/flows")
    @PreAuthorize("hasAuthority('agent:flow:read')")
    public Result<PageResult<AgentFlow>> pageFlows(@RequestParam(defaultValue = "1") long current,
                                                   @RequestParam(defaultValue = "10") long size,
                                                   @RequestParam(required = false) String keyword,
                                                   @RequestParam(required = false) String status) {
        LambdaQueryWrapper<AgentFlow> wrapper = new LambdaQueryWrapper<AgentFlow>()
                .like(keyword != null && !keyword.isBlank(), AgentFlow::getName, keyword)
                .eq(status != null && !status.isBlank(), AgentFlow::getStatus, status)
                .orderByDesc(AgentFlow::getId);
        Page<AgentFlow> page = flowMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "流程详情（含节点）")
    @GetMapping("/admin/agent/flows/{id}")
    @PreAuthorize("hasAuthority('agent:flow:read')")
    public Result<AgentFlow> flowDetail(@PathVariable Long id) {
        return Result.ok(flowMapper.selectById(id));
    }

    @Operation(summary = "流程节点列表")
    @GetMapping("/admin/agent/flows/{id}/nodes")
    @PreAuthorize("hasAuthority('agent:flow:read')")
    public Result<List<AgentFlowNode>> flowNodes(@PathVariable Long id) {
        return Result.ok(flowNodeMapper.selectList(new LambdaQueryWrapper<AgentFlowNode>()
                .eq(AgentFlowNode::getFlowId, id)
                .orderByAsc(AgentFlowNode::getNodeOrder)));
    }

    @Operation(summary = "保存流程（含节点，全量替换）")
    @PutMapping("/admin/agent/flows/{id}")
    @PreAuthorize("hasAuthority('agent:flow:write')")
    @Transactional
    public Result<Void> saveFlow(@PathVariable Long id, @RequestBody FlowSaveRequest request) {
        AgentFlow existing = flowMapper.selectById(id);
        if (existing == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "流程不存在");
        }
        AgentFlow flow = request.flow();
        flow.setId(id);
        flowMapper.updateById(flow);

        flowNodeMapper.delete(new LambdaQueryWrapper<AgentFlowNode>().eq(AgentFlowNode::getFlowId, id));
        for (AgentFlowNode node : request.nodes()) {
            node.setId(null);
            node.setFlowId(id);
            flowNodeMapper.insert(node);
        }
        return Result.ok();
    }

    @Operation(summary = "流程发布")
    @PutMapping("/admin/agent/flows/{id}/publish")
    @PreAuthorize("hasAuthority('agent:flow:write')")
    public Result<Void> publish(@PathVariable Long id) {
        return switchFlowStatus(id, "published");
    }

    @Operation(summary = "流程暂停")
    @PutMapping("/admin/agent/flows/{id}/pause")
    @PreAuthorize("hasAuthority('agent:flow:write')")
    public Result<Void> pause(@PathVariable Long id) {
        return switchFlowStatus(id, "paused");
    }

    private Result<Void> switchFlowStatus(Long id, String status) {
        AgentFlow flow = flowMapper.selectById(id);
        if (flow == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "流程不存在");
        }
        AgentFlow patch = new AgentFlow();
        patch.setId(id);
        patch.setStatus(status);
        flowMapper.updateById(patch);
        return Result.ok();
    }

    public record FlowSaveRequest(AgentFlow flow, List<AgentFlowNode> nodes) {
    }
}