/** 设计系统 token（工业风：深蓝/青主色 + 语义状态色；双端共用，内联样式消费） */
export const tokens = {
  /** 主色：工业深青蓝 */
  primary: "#0E6E8C",
  primaryDark: "#0A4E64",
  primaryLight: "#E0F2F7",
  /** 语义状态色 */
  success: "#15803D",
  successBg: "#EAF6EE",
  warning: "#C2410C",
  warningBg: "#FDF0E7",
  danger: "#B91C1C",
  dangerBg: "#FBEAEA",
  info: "#1D4ED8",
  infoBg: "#E8EEFC",
  /** 中性色 */
  text: "#1E293B",
  textSecondary: "#64748B",
  textWeak: "#94A3B8",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  bg: "#F8FAFC",
  bgDark: "#0F2437",
  /** 字号 */
  fontSm: 12,
  fontMd: 14,
  fontLg: 16,
  /** 圆角 */
  radius: 6,
  radiusSm: 4,
} as const;

/** 设备/告警状态 → 语义色 */
export type StatusTone = "normal" | "warning" | "fault" | "offline" | "info" | "processing" | "done" | "neutral";

export const statusToneColor: Record<StatusTone, { color: string; bg: string; label: string }> = {
  normal: { color: tokens.success, bg: tokens.successBg, label: "正常" },
  warning: { color: tokens.warning, bg: tokens.warningBg, label: "预警" },
  fault: { color: tokens.danger, bg: tokens.dangerBg, label: "故障" },
  offline: { color: tokens.textSecondary, bg: "#F1F5F9", label: "离线" },
  info: { color: tokens.info, bg: tokens.infoBg, label: "信息" },
  processing: { color: tokens.info, bg: tokens.infoBg, label: "进行中" },
  done: { color: tokens.success, bg: tokens.successBg, label: "已完成" },
  neutral: { color: tokens.textSecondary, bg: "#F1F5F9", label: "-" },
};

/** 状态字符串 → 语义 tone 的统一映射（后端枚举值） */
export function toStatusTone(status?: string | null): StatusTone {
  switch (status) {
    case "normal":
    case "enabled":
    case "success":
    case "online":
    case "published":
    case "ready":
    case "confirmed":
    case "closed":
    case "done":
    case "exported":
    case "low":
      return "normal";
    case "warning":
    case "warn":
    case "indexing":
    case "pending":
    case "paused":
    case "medium":
      return "warning";
    case "fault":
    case "failed":
    case "error":
    case "high":
    case "rejected":
      return "fault";
    case "running":
    case "processing":
    case "generated":
      return "processing";
    case "offline":
    case "disabled":
    case "skipped":
    case "draft":
      return "offline";
    default:
      return "neutral";
  }
}