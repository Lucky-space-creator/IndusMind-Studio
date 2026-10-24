import { PERMISSION_ACTION_LABEL, PERMISSION_MODULE_LABEL, type PermissionItem } from "@hwc/shared-types";
import { tokens } from "./tokens";

export interface PermissionListProps {
  items: PermissionItem[];
  /** 无权限时的提示文案 */
  emptyHint?: string;
  /** 是否在名称下方显示权限码（排查用） */
  showCode?: boolean;
}

const ACTION_TONE: Record<string, { color: string; bg: string }> = {
  read: { color: tokens.textSecondary, bg: "#F1F5F9" },
  write: { color: tokens.warning, bg: tokens.warningBg },
  publish: { color: "#6D28D9", bg: "#F3E8FF" },
  delete: { color: tokens.danger, bg: tokens.dangerBg },
  export: { color: tokens.success, bg: tokens.successBg },
};

/** 按模块分组，保持后端返回顺序（sort 升序） */
function groupByModule(items: PermissionItem[]): [string, PermissionItem[]][] {
  const map = new Map<string, PermissionItem[]>();
  for (const item of items) {
    const key = item.module || "other";
    const list = map.get(key);
    if (list) {
      list.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return [...map.entries()];
}

/**
 * 权限清单（双端共用，内联样式不依赖任何 UI 框架）。
 * 用于个人中心「我的权限」与管理端顶栏的权限明细，让账号具体拥有哪些权限可见。
 */
export function PermissionList({ items, emptyHint = "当前账号暂无已授权的权限点", showCode = false }: PermissionListProps) {
  if (!items.length) {
    return (
      <div
        style={{
          padding: "20px 12px",
          textAlign: "center",
          fontSize: tokens.fontSm,
          color: tokens.textWeak,
          border: `1px dashed ${tokens.border}`,
          borderRadius: tokens.radius,
        }}
      >
        {emptyHint}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {groupByModule(items).map(([module, list]) => (
        <div
          key={module}
          style={{
            border: `1px solid ${tokens.border}`,
            borderRadius: tokens.radius,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: tokens.bg,
              borderBottom: `1px solid ${tokens.border}`,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: tokens.text }}>
              {PERMISSION_MODULE_LABEL[module] ?? module}
            </span>
            <span style={{ fontSize: tokens.fontSm, color: tokens.textWeak }}>{list.length} 项</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12 }}>
            {list.map((p) => {
              const tone = ACTION_TONE[p.action] ?? { color: tokens.textSecondary, bg: "#F1F5F9" };
              return (
                <span
                  key={p.code}
                  title={p.code}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px",
                    borderRadius: tokens.radiusSm,
                    border: `1px solid ${tokens.border}`,
                    background: "#fff",
                    fontSize: tokens.fontSm,
                    color: tokens.text,
                    lineHeight: 1.5,
                  }}
                >
                  <span>{p.name || p.code}</span>
                  <span
                    style={{
                      padding: "0 5px",
                      borderRadius: 3,
                      background: tone.bg,
                      color: tone.color,
                      fontSize: 11,
                    }}
                  >
                    {PERMISSION_ACTION_LABEL[p.action] ?? p.action}
                  </span>
                  {showCode && (
                    <code style={{ fontSize: 11, color: tokens.textWeak }}>{p.code}</code>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
