import type { ReactNode } from "react";
import { usePermission } from "./usePermission";

export interface AuthProps {
  /** 所需权限码；数组时任一满足即渲染 */
  code: string | string[];
  children: ReactNode;
  /** 无权限时的替代内容（默认不渲染任何内容） */
  fallback?: ReactNode;
}

/**
 * 按钮/操作级权限包裹组件：无权限时不渲染（而非置灰）。
 * 仅控制展示，安全由后端强制校验兜底。
 */
export function Auth({ code, children, fallback = null }: AuthProps) {
  const { has, hasAny } = usePermission();
  const ok = Array.isArray(code) ? hasAny(code) : has(code);
  if (!ok) return <>{fallback}</>;
  return <>{children}</>;
}