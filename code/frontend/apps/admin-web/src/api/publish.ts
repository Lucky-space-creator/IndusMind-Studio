import { api } from "@hwc/shared-api";
import type {
  CredentialIssue,
  PageResult,
  PubCallLog,
  PubCredential,
  PubService,
  PubVersion,
} from "@hwc/shared-types";

export const pageServices = (params: { current?: number; size?: number; keyword?: string; status?: string }) =>
  api.get<PageResult<PubService>>("/api/admin/publish/services", params);

export const createService = (body: Partial<PubService>) =>
  api.post<PubService>("/api/admin/publish/services", body);

/** 修改已部署服务：仅名称/说明/关联流程可改，服务编码与状态由发布流程托管 */
export const updateService = (id: number, body: Partial<PubService>) =>
  api.put<PubService>(`/api/admin/publish/services/${id}`, body);

export const publishService = (id: number, changelog?: string) =>
  api.put<CredentialIssue>(`/api/admin/publish/services/${id}/publish`, changelog ? { changelog } : undefined);

export const pauseService = (id: number) => api.put<void>(`/api/admin/publish/services/${id}/pause`);

export const rotateCredential = (id: number) =>
  api.post<CredentialIssue>(`/api/admin/publish/services/${id}/credential/rotate`);

export const listCredentials = (id: number) =>
  api.get<PubCredential[]>(`/api/admin/publish/services/${id}/credentials`);

export const listVersions = (id: number) => api.get<PubVersion[]>(`/api/admin/publish/services/${id}/versions`);

export const pageCallLogs = (params: { current?: number; size?: number; serviceId?: number; success?: number }) =>
  api.get<PageResult<PubCallLog>>("/api/admin/publish/call-logs", params);