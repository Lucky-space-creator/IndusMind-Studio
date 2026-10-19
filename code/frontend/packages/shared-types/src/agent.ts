/** ===== Agent 与诊断域（hwc-agent / hwc-ai-client）===== */

/** 引用（溯源条款） */
export interface Citation {
  docId: number;
  segmentId: number;
  docName: string;
  chapter?: string;
  pageNo?: number;
  score?: number;
}

export interface AgentDefinition {
  id: number;
  code: string;
  name: string;
  domain: string;
  responsibility: string;
  instruction: string;
  boundary: string;
  params?: string;
  outputFormat?: string;
  modelConfig?: string;
  /** 1/0 */
  status: number;
  sort: number;
}

export interface AgentToolBinding {
  id: number;
  agentId: number;
  /** 逗号分隔知识库 id */
  kbIds?: string;
  matchStrictness?: string;
  tools?: string;
  remark?: string;
}

export interface AgentFlow {
  id: number;
  code: string;
  name: string;
  version: number;
  /** draft/published/paused */
  status: string;
  isPreset: number;
  description?: string;
}

export interface AgentFlowNode {
  id: number;
  flowId: number;
  nodeOrder: number;
  nodeName: string;
  agentId: number;
  triggerCondition?: string;
  timeoutSeconds?: number;
  remark?: string;
}

export interface AgentRun {
  id: number;
  /** single/multi */
  runType: string;
  flowId?: number;
  sessionId?: number;
  deviceId?: number;
  datasetId?: number;
  input?: string;
  /** running/success/failed */
  status: string;
  conclusion?: string;
  traceId?: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  errorMsg?: string;
}

export interface AgentStep {
  id: number;
  runId: number;
  stepOrder: number;
  agentId: number;
  phase: string;
  summary?: string;
  detail?: string;
  /** JSON 数组字符串（Citation[]） */
  citations?: string;
  durationMs?: number;
  /** running/success/failed/skipped */
  status: string;
}

export interface ChatSession {
  id: number;
  userId: number;
  title: string;
  messageCount: number;
  lastMessageTime?: string;
}

export interface ChatMessage {
  id: number;
  sessionId: number;
  /** user/assistant */
  role: string;
  content: string;
  /** JSON 数组字符串（Citation[]） */
  citations?: string;
}

/** 问答结果（ChatResult） */
export interface ChatResult {
  sessionId: number;
  answer: string;
  citations: Citation[];
  hit: boolean;
  traceId?: string;
}

/** 发起问答请求 */
export interface ChatSendRequest {
  sessionId?: number;
  question: string;
  kbIds?: number[];
  matchStrictness?: string;
}

/** 协同诊断执行响应（DiagnosisRunResponse） */
export interface DiagnosisRunResponse {
  runId: string;
  steps: DiagnosisStepResult[];
  conclusion: string;
  riskLevel: string;
  citations: Citation[];
  traceId?: string;
}

export interface DiagnosisStepResult {
  stepOrder: number;
  agentCode: string;
  agentName: string;
  /** running/success/failed/skipped */
  status: string;
  summary?: string;
  output?: string;
  citations?: Citation[];
  durationMs?: number;
}

/** 发起协同诊断请求 */
export interface DiagnosisRunRequest {
  deviceId: number;
  datasetId: number;
  flowId?: number;
  phenomenon?: string;
}

export interface DiagnosisRecord {
  id: number;
  runId: number;
  deviceId: number;
  datasetId: number;
  faultSummary?: string;
  rootCause?: string;
  /** low/medium/high */
  riskLevel: string;
  safetyConclusion?: string;
  /** JSON 数组字符串（Citation[]） */
  citations?: string;
  conclusionTime?: string;
}