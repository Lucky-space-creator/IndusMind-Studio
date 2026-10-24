package com.hwc.agent.service;

import com.hwc.domain.agent.AgentDefinition;
import com.hwc.domain.agent.AgentFlow;

import java.util.List;
import java.util.Map;

public interface AgentAdminService {

    AgentDefinition createDefinition(AgentDefinition definition);

    void deleteDefinition(Long id);

    AgentFlow createFlow(String code, String name, String description);

    void deleteFlow(Long id);

    void publishFlow(Long id);

    void saveFlow(Long flowId, AgentFlow flowPatch, List<com.hwc.domain.agent.AgentFlowNode> nodes);

    Map<String, Object> canvasView(Long flowId);
}