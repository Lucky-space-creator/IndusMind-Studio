import { api } from "@hwc/shared-api";
import type { AgentStep, DiagnosisRecord, DiagnosisRunRequest, DiagnosisRunResponse, PageResult } from "@hwc/shared-types";

/** 发起协同诊断 */
export function runDiagnosis(body: DiagnosisRunRequest) {
  return api.post<DiagnosisRunResponse>("/api/user/diagnosis/run", body);
}

/** 诊断记录分页 */
export function fetchDiagnosisRecords(params?: { current?: number; size?: number; deviceId?: number; riskLevel?: string }) {
  return api.get<PageResult<DiagnosisRecord>>("/api/user/diagnosis/records", params);
}

/** 诊断详情（含步骤） */
export function fetchDiagnosisDetail(id: number) {
  return api.get<{ record: DiagnosisRecord; steps: AgentStep[] }>(`/api/user/diagnosis/records/${id}`);
}

/** 诊断运行步骤（历史 run） */
export function fetchRunSteps(runId: number | string) {
  return api.get<AgentStep[]>(`/api/user/diagnosis/runs/${runId}/steps`);
}