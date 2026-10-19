/** ===== 设备数据域（hwc-device-data）===== */

export interface DataDataset {
  id: number;
  name: string;
  deviceId: number;
  /** import/simulate */
  sourceType: string;
  fileUrl?: string;
  timeStart?: string;
  timeEnd?: string;
  recordCount: number;
  metricIds?: string;
  cleanConfig?: string;
  cleanedCount?: number;
  anomalyCount?: number;
  /** raw/cleaned/analyzed/error */
  status: string;
  errorMsg?: string;
}

export interface DataRecord {
  id: number;
  datasetId: number;
  deviceId: number;
  metricId: number;
  collectTime: string;
  metricValue: number;
}

export interface DataAnomaly {
  id: number;
  datasetId: number;
  deviceId: number;
  metricId: number;
  /** over_limit/sustained_rise/sustained_fall/abnormal_fluctuation */
  anomalyType: string;
  /** warn/fault */
  severity: string;
  startTime?: string;
  endTime?: string;
  sampleCount: number;
  peakValue?: number;
  avgValue?: number;
  summary: string;
  detail?: string;
}

export interface DataCleaned {
  id: number;
  datasetId: number;
  recordId: number;
  metricId: number;
  collectTime: string;
  rawValue: number;
  cleanedValue: number;
  isModified: number;
  rulesApplied?: string;
  remark?: string;
}

/** 模拟生成故障注入项（与后端 SimulateRequest.FaultInjection 对齐） */
export interface FaultInjection {
  metricId: number;
  fromHour?: number;
  toHour?: number;
  /** warn/fault，默认 warn */
  severity?: string;
}

/** 模拟生成数据集请求（与后端 SimulateRequest 对齐） */
export interface SimulateDatasetRequest {
  deviceId: number;
  name?: string;
  hours?: number;
  intervalSec?: number;
  faultInjections?: FaultInjection[];
}