import { api } from "@hwc/shared-api";
import type { DashboardMetric, PageResult } from "@hwc/shared-types";

/** 看板概览（各设备最新快照） */
export function fetchDashboard(deviceIds?: number[]) {
  return api.get<DashboardMetric[]>("/api/user/dashboard", {
    deviceIds: deviceIds && deviceIds.length ? deviceIds.join(",") : undefined,
  });
}

/** 设备看板历史快照 */
export function fetchDashboardHistory(deviceId: number, current = 1, size = 20) {
  return api.get<PageResult<DashboardMetric>>(`/api/user/dashboard/devices/${deviceId}/history`, { current, size });
}

/** 手动刷新看板快照 */
export function refreshDashboard(datasetId: number) {
  return api.post<DashboardMetric>("/api/user/dashboard/refresh", undefined, { datasetId });
}