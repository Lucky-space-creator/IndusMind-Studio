import type { DashboardMetric } from "@hwc/shared-types";

/** 解析看板快照的 metricSnapshot（JSON：指标名→值） */
export function parseMetricSnapshot(raw?: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export type { DashboardMetric };