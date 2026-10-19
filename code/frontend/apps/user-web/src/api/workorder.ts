import { api, downloadFile, saveBlob } from "@hwc/shared-api";
import type { PageResult, WoWorkOrder, WoWorkOrderPart } from "@hwc/shared-types";

/** 工单分页 */
export function fetchWorkOrders(params?: { current?: number; size?: number; deviceId?: number; status?: string; keyword?: string }) {
  return api.get<PageResult<WoWorkOrder>>("/api/user/workorders", params);
}

/** 工单详情（含备件） */
export function fetchWorkOrderDetail(id: number) {
  return api.get<{ order: WoWorkOrder; parts: WoWorkOrderPart[] }>(`/api/user/workorders/${id}`);
}

/** 生成工单（汇总诊断结论） */
export function generateWorkOrder(diagnosisId: number) {
  return api.post<WoWorkOrder>("/api/user/workorders/generate", undefined, { diagnosisId });
}

/** 下载工单 PDF */
export async function exportWorkOrderPdf(id: number) {
  const blob = await downloadFile(`/api/user/workorders/${id}/export`);
  saveBlob(blob, `work-order-${id}.pdf`);
}

/** 工单归档（PDF 存 MinIO） */
export function archiveWorkOrder(id: number) {
  return api.post<string>(`/api/user/workorders/${id}/archive`);
}