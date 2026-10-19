import { api, uploadFile } from "@hwc/shared-api";
import type {
  KbDocument,
  KbIndexTask,
  KbKnowledgeBase,
  KbSegment,
  KnowledgeSearchRequest,
  PageResult,
  SegmentHit,
} from "@hwc/shared-types";

/* ===== 知识库 ===== */
export const pageKbs = (params: {
  current?: number;
  size?: number;
  keyword?: string;
  devTypeId?: number;
  faultLevel?: string;
}) => api.get<PageResult<KbKnowledgeBase>>("/api/admin/knowledge/kbs", params);

export const getKb = (id: number) => api.get<KbKnowledgeBase>(`/api/admin/knowledge/kbs/${id}`);

export const createKb = (body: Partial<KbKnowledgeBase>) =>
  api.post<KbKnowledgeBase>("/api/admin/knowledge/kbs", body);

export const updateKb = (id: number, body: Partial<KbKnowledgeBase>) =>
  api.put<void>(`/api/admin/knowledge/kbs/${id}`, body);

export const deleteKb = (id: number) => api.delete<void>(`/api/admin/knowledge/kbs/${id}`);

/* ===== 文档 ===== */
export const pageDocuments = (params: {
  current?: number;
  size?: number;
  kbId?: number;
  keyword?: string;
  status?: string;
  docType?: string;
}) => api.get<PageResult<KbDocument>>("/api/admin/knowledge/documents", params);

export const uploadDocument = (file: File, kbId: number, docName?: string, docType?: string) =>
  uploadFile<KbDocument>("/api/admin/knowledge/documents/upload", file, {
    kbId: String(kbId),
    ...(docName ? { docName } : {}),
    ...(docType ? { docType } : {}),
  });

export const changeDocumentStatus = (id: number, status: "enabled" | "disabled") =>
  api.put<void>(`/api/admin/knowledge/documents/${id}/status`, { status });

export const deleteDocument = (id: number) => api.delete<void>(`/api/admin/knowledge/documents/${id}`);

export const reindexDocument = (id: number) => api.post<void>(`/api/admin/knowledge/documents/${id}/reindex`);

export const listDocumentTasks = (id: number) =>
  api.get<KbIndexTask[]>(`/api/admin/knowledge/documents/${id}/tasks`);

/* ===== 片段 ===== */
export const listSegments = (docId: number, _params?: { current?: number; size?: number }) =>
  api.get<KbSegment[]>(`/api/admin/knowledge/documents/${docId}/segments`).then((r) => r ?? []);

export const updateSegment = (id: number, body: Partial<KbSegment>) =>
  api.put<void>(`/api/admin/knowledge/segments/${id}`, body);

/* ===== 检索（管理端试搜），后端返回 { segments: SegmentHit[] } ===== */
export const searchKnowledge = (body: KnowledgeSearchRequest) =>
  api
    .post<{ segments: SegmentHit[] | null }>("/api/admin/knowledge/search", body)
    .then((r) => r?.segments ?? []);