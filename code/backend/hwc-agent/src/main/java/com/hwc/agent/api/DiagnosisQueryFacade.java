package com.hwc.agent.api;

import com.hwc.aiclient.model.DiagnosisRunResponse;
import com.hwc.domain.agent.AgentFlow;
import com.hwc.domain.agent.AgentFlowNode;
import com.hwc.domain.agent.AgentStep;
import com.hwc.domain.agent.DiagnosisRecord;

import java.util.List;

/**
 * Agent 诊断对外查询 Facade（跨模块唯一入口，供 hwc-workorder/hwc-publish 等下游模块使用）。
 */
public interface DiagnosisQueryFacade {

    DiagnosisRunResponse run(Long deviceId, Long datasetId, Long flowId, String phenomenon);

    DiagnosisRecord getDiagnosis(Long diagnosisId);

    List<AgentStep> listStepsByRun(Long runId);

    AgentFlow getFlow(Long flowId);

    List<AgentFlowNode> listFlowNodes(Long flowId);
}