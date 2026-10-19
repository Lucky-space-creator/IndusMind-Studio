/** ===== 看板与工单域（hwc-workorder）===== */

/** 看板快照（wo_dashboard_metric） */
export interface DashboardMetric {
  id: number;
  deviceId: number;
  datasetId: number;
  /** 0-100 */
  healthScore: number;
  /** normal/warning/fault */
  status: string;
  riskHint?: string;
  /** JSON（指标名→值） */
  metricSnapshot?: string;
  anomalyCount: number;
  snapshotTime: string;
}

export interface WoWorkOrder {
  id: number;
  orderNo: string;
  diagnosisId: number;
  deviceId: number;
  faultSummary?: string;
  rootCause?: string;
  /** low/medium/high */
  riskLevel: string;
  safetyRequirements?: string;
  repairSteps?: string;
  estDowntimeHours?: number;
  downtimeCost?: number;
  partsCost?: number;
  totalCost?: number;
  fileUrl?: string;
  /** generated/exported */
  status: string;
  generatedBy?: string;
  generatedTime?: string;
}

export interface WoWorkOrderPart {
  id: number;
  orderId: number;
  sparePartId: number;
  partName: string;
  partModel?: string;
  quantity: number;
  unitPrice?: number;
  stockSnapshot?: number;
  remark?: string;
}

/** 工单详情（order + parts） */
export interface WorkOrderDetail {
  order: WoWorkOrder;
  parts: WoWorkOrderPart[];
}