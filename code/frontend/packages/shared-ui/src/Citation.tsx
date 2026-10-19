import type { Citation } from "@hwc/shared-types";
import { tokens } from "./tokens";

export interface CitationCardProps {
  citation: Citation;
  index: number;
  /** 点击引用卡片（弹出原文抽屉） */
  onClick?: (citation: Citation, index: number) => void;
}

/** 引用角标卡片：来源文档 + 章节页码 + 相关度 */
export function CitationCard({ citation, index, onClick }: CitationCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(citation, index)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        background: tokens.bg,
        border: `1px solid ${tokens.border}`,
        borderRadius: tokens.radiusSm,
        cursor: "pointer",
        font: "inherit",
        color: tokens.text,
      }}
    >
      <span
        aria-label={`引用 ${index + 1}`}
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          borderRadius: 4,
          background: tokens.primaryLight,
          color: tokens.primaryDark,
          fontSize: 12,
          lineHeight: "20px",
          textAlign: "center",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {index + 1}
      </span>
      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {citation.docName}
        </span>
        <span style={{ fontSize: 12, color: tokens.textSecondary }}>
          {[citation.chapter, citation.pageNo != null ? `第 ${citation.pageNo} 页` : null]
            .filter(Boolean)
            .join(" · ") || "未标注来源位置"}
          {citation.score != null && <span style={{ marginLeft: 6, color: tokens.primary }}>相关度 {(citation.score * 100).toFixed(0)}%</span>}
        </span>
      </span>
    </button>
  );
}

/** 引用列表 */
export function CitationList({
  citations,
  onClick,
  columns = 2,
}: {
  citations: Citation[];
  onClick?: (c: Citation, i: number) => void;
  columns?: number;
}) {
  if (!citations.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8 }}>
      {citations.map((c, i) => (
        <CitationCard key={`${c.segmentId}-${i}`} citation={c} index={i} onClick={onClick} />
      ))}
    </div>
  );
}

/** 从 JSON 字符串解析引用（后端 citations 字段为 JSON 数组字符串） */
export function parseCitations(raw?: string | null): Citation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Citation[]) : [];
  } catch {
    return [];
  }
}