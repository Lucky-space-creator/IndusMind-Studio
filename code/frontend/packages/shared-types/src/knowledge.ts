/** ===== 知识库与文档关联域（hwc-knowledge / hwc-docgraph）===== */

export interface KbKnowledgeBase {
  id: number;
  name: string;
  devTypeId: number;
  vendor: string;
  faultLevel: string;
  docCount: number;
  /** init/indexing/ready/error */
  indexStatus: string;
  description?: string;
}

export interface KbDocument {
  id: number;
  kbId: number;
  docName: string;
  docType: string;
  version: string;
  /** enabled/disabled */
  status: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  segmentCount?: number;
  remark?: string;
}

export interface KbSegment {
  id: number;
  docId: number;
  seqNo: number;
  content: string;
  chapter?: string;
  pageNo?: number;
  charCount?: number;
  keywords?: string;
}

export interface KbIndexTask {
  id: number;
  kbId: number;
  docId: number;
  taskType: string;
  /** pending/running/success/failed */
  status: string;
  /** 0-100 */
  progress: number;
  indexVersion?: string;
  errorMsg?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface KbGraphNode {
  id: number;
  kbId: number;
  /** doc/section/segment */
  nodeType: string;
  refId: number;
  title: string;
  extra?: string;
}

export interface KbGraphEdge {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  /** 引用/替代/补充/前置/同设备/同故障 */
  relationType: string;
  /** auto/manual */
  source: string;
  confidence?: number;
  /** pending/confirmed/rejected */
  status: string;
  remark?: string;
}

/** 知识检索请求（RagSearchRequest） */
export interface KnowledgeSearchRequest {
  query: string;
  kbIds?: number[];
  topK?: number;
  /** low/medium/high */
  strictness?: string;
}

/** 知识检索命中片段（RagSearchResponse.SegmentHit） */
export interface SegmentHit {
  segmentId: number;
  docId: number;
  docName: string;
  chapter?: string;
  pageNo?: number;
  content: string;
  score: number;
}