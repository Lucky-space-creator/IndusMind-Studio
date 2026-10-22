import { api } from "@hwc/shared-api";
import type { KbGraphEdge, KbGraphNode, PageResult } from "@hwc/shared-types";

export const pageEdges = (params: {
  current?: number;
  size?: number;
  kbId?: number;
  relationType?: string;
  status?: string;
  source?: string;
}) => api.get<PageResult<KbGraphEdge>>("/api/admin/docgraph/edges", params);

export const listNodes = (params?: { kbId?: number; nodeType?: string; keyword?: string }) =>
  api
    .get<PageResult<KbGraphNode>>("/api/admin/docgraph/nodes", { ...params, current: 1, size: 500 })
    .then((r) => r?.records ?? []);

export const createEdge = (body: Partial<KbGraphEdge>) => api.post<KbGraphEdge>("/api/admin/docgraph/edges", body);

export const updateEdge = (id: number, body: Partial<KbGraphEdge>) =>
  api.put<void>(`/api/admin/docgraph/edges/${id}`, body);

export const deleteEdge = (id: number) => api.delete<void>(`/api/admin/docgraph/edges/${id}`);

export const confirmEdge = (id: number) => api.put<void>(`/api/admin/docgraph/edges/${id}/confirm`);

export const rejectEdge = (id: number) => api.put<void>(`/api/admin/docgraph/edges/${id}/reject`);

export const extractEdges = (kbId: number) =>
  api.post<{ addedEdges: number }>("/api/admin/docgraph/extract", { kbId });

export const syncGraph = (kbId: number) => api.post<void>("/api/admin/docgraph/sync", { kbId });