import { api } from "@hwc/shared-api";
import type { DevInfo, DevMetric, DevMetricThreshold, DevSparePart, DevType, PageResult } from "@hwc/shared-types";

export function fetchDeviceTypes() {
  return api
    .get<PageResult<DevType>>("/api/user/device/types", { current: 1, size: 200 })
    .then((r) => r?.records ?? []);
}

export function fetchDevices(params?: { current?: number; size?: number; keyword?: string; status?: string; typeId?: number }) {
  return api.get<PageResult<DevInfo>>("/api/user/device/infos", params);
}

export function fetchDevice(id: number) {
  return api.get<DevInfo>(`/api/user/device/infos/${id}`);
}

export function fetchMetrics(params?: { typeId?: number }) {
  return api
    .get<PageResult<DevMetric>>("/api/user/device/metrics", { ...params, current: 1, size: 200 })
    .then((r) => r?.records ?? []);
}

export function fetchMetricThreshold(metricId: number) {
  return api.get<DevMetricThreshold>(`/api/user/device/metrics/${metricId}/threshold`);
}

export function fetchSpareParts(params?: { current?: number; size?: number; keyword?: string }) {
  return api.get<PageResult<DevSparePart>>("/api/user/device/spare-parts", params);
}