import type { CSSProperties, ReactNode } from "react";
import { tokens } from "./tokens";

export interface PanelProps {
  title?: ReactNode;
  /** 标题右侧说明文字 */
  subtitle?: ReactNode;
  /** 标题行右侧操作区（按钮/选择器） */
  extra?: ReactNode;
  children: ReactNode;
  /** 无外边距（嵌入其他容器时使用） */
  flat?: boolean;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}

/** Panel 容器：标题 + 操作区 + 内容（Grafana 面板范式；白底单层卡片，不套娃） */
export function Panel({ title, subtitle, extra, children, flat, style, bodyStyle }: PanelProps) {
  return (
    <section
      style={{
        background: "#fff",
        border: `1px solid ${tokens.border}`,
        borderRadius: tokens.radius,
        marginBottom: flat ? 0 : 16,
        ...style,
      }}
    >
      {(title || extra) && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 16px",
            borderBottom: `1px solid ${tokens.border}`,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            {title && (
              <h3 style={{ margin: 0, fontSize: tokens.fontMd, fontWeight: 600, color: tokens.text }}>{title}</h3>
            )}
            {subtitle && <span style={{ fontSize: tokens.fontSm, color: tokens.textSecondary }}>{subtitle}</span>}
          </div>
          {extra && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{extra}</div>}
        </header>
      )}
      <div style={{ padding: 16, ...bodyStyle }}>{children}</div>
    </section>
  );
}