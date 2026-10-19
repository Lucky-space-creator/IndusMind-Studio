import type { ReactNode } from "react";
import type { EndType } from "@hwc/shared-types";
import { useEffect } from "react";
import { useAuthStore } from "./store";

export interface PermissionProviderProps {
  /** 当前应用所属端：用户端与管理端登录态隔离 */
  end: EndType;
  children: ReactNode;
}

/**
 * 权限上下文 Provider：
 * 1. 校验本地登录态的端类型与本应用一致（用户端 token 不可进入管理端，反之亦然）；
 * 2. zustand store 已持久化登录态（roles/menus/permissions/dataScope），此处仅做端隔离守卫。
 */
export function PermissionProvider({ end, children }: PermissionProviderProps) {
  const token = useAuthStore((s) => s.token);
  const authEnd = useAuthStore((s) => s.end);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    if (token && authEnd && authEnd !== end) {
      clearAuth();
    }
  }, [token, authEnd, end, clearAuth]);

  return <>{children}</>;
}