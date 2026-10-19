import { api } from "@hwc/shared-api";
import type { KbDocument, KbKnowledgeBase, KbSegment, KnowledgeSearchRequest, PageResult, SegmentHit } from "@hwc/shared-types";

/** 知识库列表（只读，后端分页接口，取首页大页解包为数组） */
export function fetchKbs() {
  return api
    .get<PageResult<KbKnowledgeBase>>("/api/user/knowledge/kbs", { current: 1, size: 200 })
    .then((r) => r?.records ?? []);
}

/** 知识库下文档列表（只读） */
export function fetchDocuments(params?: { kbId?: number; keyword?: string; current?: number; size?: number }) {
  return api.get<PageResult<KbDocument>>("/api/user/knowledge/documents", params);
}

/** 文档片段（引用溯源原文） */
export function fetchSegments(docId: number) {
  return api.get<KbSegment[]>(`/api/user/knowledge/documents/${docId}/segments`);
}

/** 知识检索（语义 + 关键词），后端返回 { segments: SegmentHit[] } */
export function searchKnowledge(body: KnowledgeSearchRequest) {
  return api
    .post<{ segments: SegmentHit[] | null }>("/api/user/knowledge/search", body)
    .then((r) => r?.segments ?? []);
}