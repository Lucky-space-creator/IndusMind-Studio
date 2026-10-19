import type { CSSProperties, ReactNode } from "react";
import { tokens } from "./tokens";

/** 进度条（索引进度/上传进度等；支持中文状态文案） */
export function ProgressBar({
  percent,
  status = "processing",
  showLabel = true,
  height = 8,
  style,
}: {
  percent?: number | null;
  status?: "processing" | "success" | "failed";
  showLabel?: boolean;
  height?: number;
  style?: CSSProperties;
}) {
  const p = Math.max(0, Math.min(100, percent ?? 0));
  const color =
    status === "success" ? tokens.success : status === "failed" ? tokens.danger : tokens.primary;
  const statusText = status === "success" ? "完成" : status === "failed" ? "失败" : `${p.toFixed(0)}%`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120, ...style }}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(p)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          flex: 1,
          height,
          background: "#EEF2F6",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${p}%`, height: "100%", background: color, transition: "width .4s ease" }} />
      </div>
      {showLabel && (
        <span style={{ fontSize: tokens.fontSm, color: tokens.textSecondary, fontVariantNumeric: "tabular-nums" }}>
          {statusText}
        </span>
      )}
    </div>
  );
}

/** 骨架屏块 */
export function Skeleton({ width = "100%", height = 16, radius = 4, style }: { width?: number | string; height?: number | string; radius?: number; style?: CSSProperties }) {
  return (
    <span
      className="hwc-skeleton"
      style={{ display: "block", width, height, borderRadius: radius, ...style }}
    />
  );
}

/** 骨架屏面板（Panel 形状的加载占位） */
export function SkeletonPanel({ rows = 3, height = 200 }: { rows?: number; height?: number }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${tokens.border}`,
        borderRadius: tokens.radius,
        padding: 16,
        height,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <Skeleton width="30%" height={18} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={14} />
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  style?: CSSProperties;
}

/** 空状态（统一图标 + 说明 + 建议操作） */
export function EmptyState({ title = "暂无数据", description, action, style }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "40px 16px",
        color: tokens.textSecondary,
        ...style,
      }}
    >
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={tokens.textWeak} strokeWidth="1.4" aria-hidden>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <path d="M3.5 9.5h17M9 4.5v15" />
      </svg>
      <div style={{ fontSize: tokens.fontMd, color: tokens.text, fontWeight: 500 }}>{title}</div>
      {description && <div style={{ fontSize: tokens.fontSm, textAlign: "center", maxWidth: 360 }}>{description}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

/** 全局骨架屏动画样式（在 app 根部渲染一次） */
export function SkeletonStyle() {
  const css = `
@keyframes hwc-skeleton-wave { 0% { background-position: 100% 50% } 100% { background-position: 0 50% } }
.hwc-skeleton {
  background: linear-gradient(90deg, #EEF2F6 25%, #F8FAFC 37%, #EEF2F6 63%);
  background-size: 400% 100%;
  animation: hwc-skeleton-wave 1.4s ease infinite;
}
@media (prefers-reduced-motion: reduce) { .hwc-skeleton { animation: none } }
`;
  return <style>{css}</style>;
}