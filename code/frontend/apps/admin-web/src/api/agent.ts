import { api } from "@hwc/shared-api";
import type {
  AgentDefinition,
  AgentDefinitionCreateRequest,
  AgentFlow,
  AgentFlowCreateRequest,
  AgentFlowNode,
  AgentRun,
  AgentStep,
  AgentToolBinding,
  CanvasView,
  DiagnosisRecord,
  PageResult,
} from "@hwc/shared-types";

/* ===== Agent 定义 ===== */
export const pageDefinitions = (params: { current?: number; size?: number; keyword?: string; domain?: string }) =>
  api.get<PageResult<AgentDefinition>>("/api/admin/agent/definitions", params);

export const createDefinition = (body: AgentDefinitionCreateRequest) =>
  api.post<AgentDefinition>("/api/admin/agent/definitions", body);

export const deleteDefinition = (id: number) => api.delete<void>(`/api/admin/agent/definitions/${id}`);

export const updateDefinition = (id: number, body: Partial<AgentDefinition>) =>
  api.put<void>(`/api/admin/agent/definitions/${id}`, body);

export const switchDefinition = (id: number, status: number) =>
  api.put<void>(`/api/admin/agent/definitions/${id}/status`, { status });

/* ===== 工具与知识绑定 ===== */
export const listBindings = (agentId?: number) =>
  api.get<AgentToolBinding[]>("/api/admin/agent/bindings", agentId ? { agentId } : undefined);

export const updateBinding = (agentId: number, body: Partial<AgentToolBinding>) =>
  api.put<void>(`/api/admin/agent/bindings/${agentId}`, body);

/* ===== 协同流程 ===== */
export const pageFlows = (params: { current?: number; size?: number; keyword?: string; status?: string }) =>
  api.get<PageResult<AgentFlow>>("/api/admin/agent/flows", params);

export const getFlow = (id: number) => api.get<AgentFlow>(`/api/admin/agent/flows/${id}`);

export const listFlowNodes = (id: number) => api.get<AgentFlowNode[]>(`/api/admin/agent/flows/${id}/nodes`);

export interface FlowSaveRequest {
  flow: Partial<AgentFlow>;
  nodes: Partial<AgentFlowNode>[];
}

export const saveFlow = (id: number, body: FlowSaveRequest) =>
  api.put<void>(`/api/admin/agent/flows/${id}`, body);

export const publishFlow = (id: number) => api.put<void>(`/api/admin/agent/flows/${id}/publish`);

export const pauseFlow = (id: number) => api.put<void>(`/api/admin/agent/flows/${id}/pause`);

export const createFlow = (body: AgentFlowCreateRequest) =>
  api.post<AgentFlow>("/api/admin/agent/flows", body);

export const deleteFlow = (id: number) => api.delete<void>(`/api/admin/agent/flows/${id}`);

export const getFlowCanvas = (id: number) => api.get<CanvasView>(`/api/admin/agent/flows/${id}/canvas`);

/* ===== 执行记录 ===== */
export const pageRuns = (params: { current?: number; size?: number }) =>
  api.get<PageResult<AgentRun>>("/api/admin/agent/runs", params);

export const listRunSteps = (runId: number) => api.get<AgentStep[]>(`/api/admin/agent/runs/${runId}/steps`);

export const pageDiagnosisRecords = (params: { current?: number; size?: number; deviceId?: number; riskLevel?: string }) =>
  api.get<PageResult<DiagnosisRecord>>("/api/admin/agent/diagnosis/records", params);