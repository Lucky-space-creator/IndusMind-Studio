/** ===== 设备配置域（hwc-device）===== */

export interface DevType {
  id: number;
  code: string;
  name: string;
  vendor: string;
  description: string;
  createTime?: string;
}

export interface DevModel {
  id: number;
  typeId: number;
  code: string;
  name: string;
  spec: string;
}

export interface DevInfo {
  id: number;
  code: string;
  name: string;
  typeId: number;
  modelId: number;
  lineName: string;
  location: string;
  /** normal/warning/fault/offline */
  status: string;
  runDate?: string;
  remark?: string;
}

export interface DevMetric {
  id: number;
  typeId: number;
  code: string;
  name: string;
  unit: string;
  sampleInterval: number;
}

export interface DevMetricThreshold {
  id: number;
  metricId: number;
  normalMin: number;
  normalMax: number;
  warnMin: number;
  warnMax: number;
  faultMin: number;
  faultMax: number;
  remark?: string;
}

export interface DevAlarmRule {
  id: number;
  metricId: number;
  /** info/warn/fault */
  level: string;
  conditionType: string;
  durationCount: number;
  thresholdExpr: string;
  enabled: number;
  description?: string;
}

export interface DevSparePart {
  id: number;
  code: string;
  name: string;
  model: string;
  unit: string;
  stock: number;
  safetyStock: number;
  unitPrice: number;
  status: number;
  remark?: string;
}

export interface DevDowntimeCost {
  id: number;
  scopeType: string;
  deviceId: number;
  lineName: string;
  costPerHour: number;
  remark?: string;
}