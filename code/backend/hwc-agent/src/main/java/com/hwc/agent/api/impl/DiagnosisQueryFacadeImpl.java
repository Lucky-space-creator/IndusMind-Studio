package com.hwc.agent.api.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.agent.api.DiagnosisQueryFacade;
import com.hwc.agent.mapper.AgentFlowMapper;
import com.hwc.agent.mapper.AgentFlowNodeMapper;
import com.hwc.agent.mapper.AgentStepMapper;
import com.hwc.agent.mapper.DiagnosisRecordMapper;
import com.hwc.agent.service.DiagnosisService;
import com.hwc.aiclient.model.DiagnosisRunResponse;
import com.hwc.domain.agent.AgentFlow;
import com.hwc.domain.agent.AgentFlowNode;
import com.hwc.domain.agent.AgentStep;
import com.hwc.domain.agent.DiagnosisRecord;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DiagnosisQueryFacadeImpl implements DiagnosisQueryFacade {

    private final DiagnosisRecordMapper diagnosisMapper;
    private final AgentStepMapper stepMapper;
    private final AgentFlowMapper flowMapper;
    private final AgentFlowNodeMapper flowNodeMapper;
    private final DiagnosisService diagnosisService;

    @Override
    public DiagnosisRunResponse run(Long deviceId, Long datasetId, Long flowId, String phenomenon) {
        return diagnosisService.run(deviceId, datasetId, flowId, phenomenon);
    }

    @Override
    public DiagnosisRecord getDiagnosis(Long diagnosisId) {
        return diagnosisMapper.selectById(diagnosisId);
    }

    @Override
    public List<AgentStep> listStepsByRun(Long runId) {
        return stepMapper.selectList(new LambdaQueryWrapper<AgentStep>()
                .eq(AgentStep::getRunId, runId)
                .orderByAsc(AgentStep::getStepOrder));
    }

    @Override
    public AgentFlow getFlow(Long flowId) {
        return flowMapper.selectById(flowId);
    }

    @Override
    public List<AgentFlowNode> listFlowNodes(Long flowId) {
        return flowNodeMapper.selectList(new LambdaQueryWrapper<AgentFlowNode>()
                .eq(AgentFlowNode::getFlowId, flowId)
                .orderByAsc(AgentFlowNode::getNodeOrder));
    }
}