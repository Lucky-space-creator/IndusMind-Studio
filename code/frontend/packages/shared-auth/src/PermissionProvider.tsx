import type { ReactNode } from "react";
import type { EndType } from "@hwc/shared-types";
import { useEffect, useRef } from "react";
import { onProfileChanged, refreshProfile, resetProfileSyncClock } from "./profile";
import { useAuthStore } from "./store";

export interface PermissionProviderProps {
  /** 当前应用所属端：用户端与管理端登录态隔离 */
  end: EndType;
  children: ReactNode;
  /**
   * 是否自动同步权限（默认 true）。
   * 挂载时强制同步一次；窗口重新可见/聚焦时按间隔同步，管理员改完权限后无需重新登录。
   */
  autoSync?: boolean;
  /** 聚焦同步的最小间隔（毫秒），默认 30s，避免频繁请求 */
  syncIntervalMs?: number;
  /** 权限集确实发生变化时回调（通常用于清空数据缓存，让列表按新范围重新拉取） */
  onPermissionsChanged?: () => void;
}

/**
 * 权限上下文 Provider：
 * 1. 校验本地登录态的端类型与本应用一致（用户端 token 不可进入管理端，反之亦然）；
 * 2. zustand store 已持久化登录态（roles/menus/permissions/dataScope），此处仅做端隔离守卫；
 * 3. 权限快照自动同步：登录态里的权限是登录时的快照，管理员调整角色后在此刷新。
 */
export function PermissionProvider({
  end,
  children,
  autoSync = true,
  syncIntervalMs = 30_000,
  onPermissionsChanged,
}: PermissionProviderProps) {
  const token = useAuthStore((s) => s.token);
  const authEnd = useAuthStore((s) => s.end);
  const userId = useAuthStore((s) => s.userId);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  // 回调走 ref，避免调用方传内联函数导致每次渲染重复订阅
  const changedRef = useRef(onPermissionsChanged);
  changedRef.current = onPermissionsChanged;

  useEffect(() => {
    if (token && authEnd && authEnd !== end) {
      clearAuth();
    }
  }, [token, authEnd, end, clearAuth]);

  useEffect(() => {
    if (!token || !autoSync) return;
    // 账号切换后重新计时，保证第一次聚焦一定是新鲜的
    resetProfileSyncClock();
    void refreshProfile({ force: true });

    const syncIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshProfile({ minIntervalMs: syncIntervalMs });
    };
    document.addEventListener("visibilitychange", syncIfVisible);
    window.addEventListener("focus", syncIfVisible);
    // 两端都用 HashRouter：站内跳转即可顺带同步一次（节流后不会造成请求放大）
    window.addEventListener("hashchange", syncIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", syncIfVisible);
      window.removeEventListener("focus", syncIfVisible);
      window.removeEventListener("hashchange", syncIfVisible);
    };
  }, [token, userId, autoSync, syncIntervalMs]);

  useEffect(
    () =>
      onProfileChanged(() => {
        changedRef.current?.();
      }),
    [],
  );

  return <>{children}</>;
}
