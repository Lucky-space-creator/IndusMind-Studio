import type { UserProfile } from "@hwc/shared-types";
import { useAuthStore } from "./store";

export interface RefreshProfileOptions {
  /** 忽略节流立即同步（保存权限后主动调用） */
  force?: boolean;
  /** 最小同步间隔（毫秒）；未设置或为 0 表示不节流 */
  minIntervalMs?: number;
}

/** 权限集变化回调（用于清空业务数据缓存，让列表按新范围重新拉取） */
type ProfileChangedListener = () => void;

const listeners = new Set<ProfileChangedListener>();

let inFlight: Promise<boolean> | null = null;
let lastSyncedAt = 0;

/** 订阅"权限集确实发生变化"事件，返回取消订阅函数 */
export function onProfileChanged(listener: ProfileChangedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function permissionKey(): string {
  const { permissions } = useAuthStore.getState();
  return [...permissions].sort().join(",");
}

/**
 * 从后端重新拉取当前用户的权限档案并写入登录态。
 *
 * 登录时拿到的角色/权限/数据范围是持久化快照，管理员调整权限后不会自动更新；
 * 这里提供"重新取快照"的通道，让菜单、按钮、路由守卫无需重新登录即可跟随变化。
 *
 * 失败一律静默：权限同步是增强能力，不能打扰用户或阻断业务请求。
 */
export async function refreshProfile(options: RefreshProfileOptions = {}): Promise<boolean> {
  const { token, end } = useAuthStore.getState();
  if (!token || !end) return false;

  const minInterval = options.minIntervalMs ?? 0;
  if (!options.force && minInterval > 0 && Date.now() - lastSyncedAt < minInterval) {
    return false;
  }
  // 并发调用合并为一次请求（StrictMode 双执行、focus 与 visibility 同时触发时常见）
  if (inFlight) return inFlight;

  const before = permissionKey();
  inFlight = (async () => {
    try {
      const resp = await fetch(`/api/${end}/auth/profile`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (resp.status === 401 || resp.status === 403) {
        // 账号被停用或端不匹配：直接清理登录态，交由路由守卫跳登录
        useAuthStore.getState().clearAuth();
        return false;
      }
      if (!resp.ok) return false;
      const payload = (await resp.json()) as { code: number; data?: UserProfile };
      if (payload.code !== 0 || !payload.data) return false;

      useAuthStore.getState().setProfile(payload.data);
      lastSyncedAt = Date.now();

      if (permissionKey() !== before) {
        listeners.forEach((fn) => {
          try {
            fn();
          } catch {
            /* 单个订阅者异常不影响其他订阅者 */
          }
        });
      }
      return true;
    } catch {
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** 强制下一次同步不受节流影响（如切换账号后） */
export function resetProfileSyncClock() {
  lastSyncedAt = 0;
}
