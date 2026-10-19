import { api } from "@hwc/shared-api";
import type {
  DevAlarmRule,
  DevDowntimeCost,
  DevInfo,
  DevMetric,
  DevMetricThreshold,
  DevModel,
  DevSparePart,
  DevType,
  PageResult,
} from "@hwc/shared-types";

/* ===== 设备类型与型号 ===== */
export const pageTypes = (params: { current?: number; size?: number; keyword?: string }) =>
  api.get<PageResult<DevType>>("/api/admin/device/types", params);

export const getType = (id: number) => api.get<DevType>(`/api/admin/device/types/${id}`);

export const createType = (body: Partial<DevType>) => api.post<DevType>("/api/admin/device/types", body);

export const updateType = (id: number, body: Partial<DevType>) =>
  api.put<void>(`/api/admin/device/types/${id}`, body);

export const deleteType = (id: number) => api.delete<void>(`/api/admin/device/types/${id}`);

export const listModels = (typeId: number) => api.get<DevModel[]>(`/api/admin/device/types/${typeId}/models`);

export const createModel = (body: Partial<DevModel>) => api.post<DevModel>("/api/admin/device/models", body);

export const updateModel = (id: number, body: Partial<DevModel>) =>
  api.put<void>(`/api/admin/device/models/${id}`, body);

export const deleteModel = (id: number) => api.delete<void>(`/api/admin/device/models/${id}`);

/* ===== 设备台账 ===== */
export const pageDevices = (params: {
  current?: number;
  size?: number;
  keyword?: string;
  typeId?: number;
  status?: string;
}) => api.get<PageResult<DevInfo>>("/api/admin/device/infos", params);

export const getDevice = (id: number) => api.get<DevInfo>(`/api/admin/device/infos/${id}`);

export const createDevice = (body: Partial<DevInfo>) => api.post<DevInfo>("/api/admin/device/infos", body);

export const updateDevice = (id: number, body: Partial<DevInfo>) =>
  api.put<void>(`/api/admin/device/infos/${id}`, body);

export const deleteDevice = (id: number) => api.delete<void>(`/api/admin/device/infos/${id}`);

/* ===== 指标与阈值 ===== */
export const pageMetrics = (params: { current?: number; size?: number; typeId?: number; keyword?: string }) =>
  api.get<PageResult<DevMetric>>("/api/admin/device/metrics", params);

export const createMetric = (body: Partial<DevMetric>) => api.post<DevMetric>("/api/admin/device/metrics", body);

export const updateMetric = (id: number, body: Partial<DevMetric>) =>
  api.put<void>(`/api/admin/device/metrics/${id}`, body);

export const deleteMetric = (id: number) => api.delete<void>(`/api/admin/device/metrics/${id}`);

export const getThreshold = (metricId: number) =>
  api.get<DevMetricThreshold | null>(`/api/admin/device/metrics/${metricId}/threshold`);

export const saveThreshold = (metricId: number, body: Partial<DevMetricThreshold>) =>
  api.post<void>(`/api/admin/device/metrics/${metricId}/threshold`, body);

/* ===== 告警规则 ===== */
export const listAlarmRules = (metricId: number) =>
  api.get<DevAlarmRule[]>(`/api/admin/device/metrics/${metricId}/alarm-rules`);

export const createAlarmRule = (body: Partial<DevAlarmRule>) =>
  api.post<DevAlarmRule>("/api/admin/device/alarm-rules", body);

export const updateAlarmRule = (id: number, body: Partial<DevAlarmRule>) =>
  api.put<void>(`/api/admin/device/alarm-rules/${id}`, body);

export const deleteAlarmRule = (id: number) => api.delete<void>(`/api/admin/device/alarm-rules/${id}`);

/* ===== 备件 ===== */
export const pageSpareParts = (params: { current?: number; size?: number; keyword?: string }) =>
  api.get<PageResult<DevSparePart>>("/api/admin/device/spare-parts", params);

export const createSparePart = (body: Partial<DevSparePart>) =>
  api.post<DevSparePart>("/api/admin/device/spare-parts", body);

export const updateSparePart = (id: number, body: Partial<DevSparePart>) =>
  api.put<void>(`/api/admin/device/spare-parts/${id}`, body);

export const deleteSparePart = (id: number) => api.delete<void>(`/api/admin/device/spare-parts/${id}`);

/* ===== 停机损失（后端为全量列表接口，无分页） ===== */
export const listDowntimeCosts = () =>
  api.get<DevDowntimeCost[]>("/api/admin/device/downtime-costs").then((r) => r ?? []);

export const createDowntimeCost = (body: Partial<DevDowntimeCost>) =>
  api.post<DevDowntimeCost>("/api/admin/device/downtime-costs", body);

export const updateDowntimeCost = (id: number, body: Partial<DevDowntimeCost>) =>
  api.put<void>(`/api/admin/device/downtime-costs/${id}`, body);

export const deleteDowntimeCost = (id: number) =>
  api.delete<void>(`/api/admin/device/downtime-costs/${id}`);