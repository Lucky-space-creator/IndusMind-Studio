import type { CSSProperties } from "react";
import type { TimeRangePreset } from "@hwc/shared-types";
import { tokens } from "./tokens";

export interface TimeRange {
  preset: TimeRangePreset;
  /** 毫秒时间戳 */
  from: number;
  to: number;
}

const PRESETS: { key: TimeRangePreset; label: string; hours: number }[] = [
  { key: "1h", label: "近 1 小时", hours: 1 },
  { key: "6h", label: "近 6 小时", hours: 6 },
  { key: "24h", label: "近 24 小时", hours: 24 },
  { key: "7d", label: "近 7 天", hours: 24 * 7 },
  { key: "30d", label: "近 30 天", hours: 24 * 30 },
];

/** 按预设计算时间范围 */
export function rangeOf(preset: TimeRangePreset): TimeRange {
  const conf = PRESETS.find((p) => p.key === preset) ?? PRESETS[2];
  const to = Date.now();
  return { preset, from: to - conf.hours * 3600_000, to };
}

/** 时间范围选择器（Grafana Variables 范式：快捷区间切换，无需编辑面板） */
export function TimeRangePicker({
  value,
  onChange,
  style,
}: {
  value: TimeRangePreset;
  onChange: (preset: TimeRangePreset) => void;
  style?: CSSProperties;
}) {
  return (
    <div
      role="group"
      aria-label="时间范围"
      style={{ display: "inline-flex", border: `1px solid ${tokens.border}`, borderRadius: tokens.radiusSm, overflow: "hidden", background: "#fff", ...style }}
    >
      {PRESETS.map((p) => {
        const active = p.key === value;
        return (
          <button
            key={p.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(p.key)}
            style={{
              padding: "5px 12px",
              minHeight: 32,
              border: "none",
              borderRight: `1px solid ${tokens.border}`,
              background: active ? tokens.primary : "#fff",
              color: active ? "#fff" : tokens.textSecondary,
              fontSize: tokens.fontSm,
              cursor: "pointer",
              font: "inherit",

            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export interface DeviceOption {
  id: number;
  code: string;
  name: string;
  lineName?: string;
}

/** 设备变量选择器（原生 select 实现，双端样式统一；受控组件） */
export function DeviceSelect({
  devices,
  value,
  onChange,
  placeholder = "全部设备",
  style,
  allowEmpty = true,
}: {
  devices: DeviceOption[];
  value?: number | null;
  onChange: (deviceId: number | null) => void;
  placeholder?: string;
  style?: CSSProperties;
  allowEmpty?: boolean;
}) {
  return (
    <select
      aria-label="设备选择"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      style={{
        minHeight: 32,
        minWidth: 160,
        padding: "4px 8px",
        border: `1px solid ${tokens.border}`,
        borderRadius: tokens.radiusSm,
        background: "#fff",
        color: tokens.text,
        fontSize: tokens.fontSm,
        cursor: "pointer",
        ...style,
      }}
    >
      {allowEmpty && <option value="">{placeholder}</option>}
      {devices.map((d) => (
        <option key={d.id} value={d.id}>
          {d.code} · {d.name}
          {d.lineName ? `（${d.lineName}）` : ""}
        </option>
      ))}
    </select>
  );
}