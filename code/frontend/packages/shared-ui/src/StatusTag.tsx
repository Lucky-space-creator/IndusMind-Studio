import type { CSSProperties } from "react";
import { statusToneColor, toStatusTone, type StatusTone, tokens } from "./tokens";

export interface StatusTagProps {
  /** 后端状态枚举值（normal/warning/fault/enabled/...），自动映射语义色 */
  status?: string | null;
  /** 覆盖显示文本 */
  label?: string;
  /** 直接指定 tone（优先于 status 推断） */
  tone?: StatusTone;
  style?: CSSProperties;
}

/** 状态标签：语义色映射（正常=绿 预警=橙 故障=红），不只靠颜色还带文字 */
export function StatusTag({ status, label, tone, style }: StatusTagProps) {
  const resolvedTone = tone ?? toStatusTone(status);
  const conf = statusToneColor[resolvedTone];
  const text = label ?? conf.label;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "1px 8px",
        borderRadius: 999,
        fontSize: tokens.fontSm,
        lineHeight: "20px",
        color: conf.color,
        background: conf.bg,
        border: `1px solid ${conf.color}33`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: conf.color, flexShrink: 0 }} />
      {text}
    </span>
  );
}

/** 风险等级标签（low/medium/high） */
export function RiskTag({ level }: { level?: string | null }) {
  const map: Record<string, { label: string; tone: StatusTone }> = {
    low: { label: "低风险", tone: "normal" },
    medium: { label: "中风险", tone: "warning" },
    high: { label: "高风险", tone: "fault" },
  };
  const conf = (level && map[level]) || { label: level ?? "-", tone: "neutral" as StatusTone };
  return <StatusTag tone={conf.tone} label={conf.label} />;
}

/** 健康分着色文字（0-100） */
export function HealthScore({ score }: { score?: number | null }) {
  const value = score ?? 0;
  const color = value >= 80 ? tokens.success : value >= 60 ? tokens.warning : tokens.danger;
  return (
    <span style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
      {score == null ? "-" : value.toFixed(0)}
      <span style={{ fontSize: 12, fontWeight: 400, color: tokens.textSecondary }}> / 100</span>
    </span>
  );
}