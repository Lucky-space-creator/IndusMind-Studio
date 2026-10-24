import type { DataScopeInfo, EndType, LoginResult, MenuInfo, PermissionItem, UserProfile } from "@hwc/shared-types";
import { create } from "zustand";

interface AuthState {
  token: string | null;
  userId: number | null;
  username: string | null;
  realName: string | null;
  end: EndType | null;
  roles: string[];
  menus: MenuInfo[];
  permissions: string[];
  /** 权限点明细（含中文名称），仅用于界面展示 */
  permissionDetails: PermissionItem[];
  dataScope: DataScopeInfo | null;
  setAuth: (result: LoginResult) => void;
  /** 用最新权限档案覆盖登录态中的角色/权限/数据范围（token 不变） */
  setProfile: (profile: UserProfile) => void;
  clearAuth: () => void;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  hasAllPermissions: (codes: string[]) => boolean;
}

const STORAGE_KEY = "hwc-auth";

interface PersistShape {
  token: string;
  userId: number;
  username: string;
  realName: string;
  end: EndType;
  roles?: string[];
  menus?: MenuInfo[];
  permissions?: string[];
  permissionDetails?: PermissionItem[];
  dataScope?: DataScopeInfo | null;
}

function loadInitial(): Pick<
  AuthState,
  | "token"
  | "userId"
  | "username"
  | "realName"
  | "end"
  | "roles"
  | "menus"
  | "permissions"
  | "permissionDetails"
  | "dataScope"
> {
  const empty = {
    token: null,
    userId: null,
    username: null,
    realName: null,
    end: null,
    roles: [],
    menus: [],
    permissions: [],
    permissionDetails: [],
    dataScope: null,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistShape;
      return {
        token: parsed.token,
        userId: parsed.userId,
        username: parsed.username,
        realName: parsed.realName,
        end: parsed.end,
        roles: parsed.roles ?? [],
        menus: parsed.menus ?? [],
        permissions: parsed.permissions ?? [],
        permissionDetails: parsed.permissionDetails ?? [],
        dataScope: parsed.dataScope ?? null,
      };
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return empty;
}

const initial = loadInitial();

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initial,
  setAuth: (result) => {
    const persist: PersistShape = {
      token: result.token,
      userId: result.userId,
      username: result.username,
      realName: result.realName,
      end: result.end,
      roles: result.roles,
      menus: result.menus,
      permissions: result.permissions,
      permissionDetails: result.permissionDetails ?? [],
      dataScope: result.dataScope ?? null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
    set({
      token: result.token,
      userId: result.userId,
      username: result.username,
      realName: result.realName,
      end: result.end,
      roles: result.roles ?? [],
      menus: result.menus ?? [],
      permissions: result.permissions ?? [],
      permissionDetails: result.permissionDetails ?? [],
      dataScope: result.dataScope ?? null,
    });
  },
  /**
   * 刷新权限快照：只更新角色/权限/数据范围与账号资料，保留 token 与后端下发菜单。
   * 内容无变化时直接返回，避免轮询同步造成无谓的重渲染。
   */
  setProfile: (profile) => {
    const current = get();
    if (!current.token) return;
    const roles = profile.roles ?? [];
    const permissions = profile.permissions ?? [];
    const permissionDetails = profile.permissionDetails ?? current.permissionDetails;
    const dataScope = profile.dataScope ?? null;
    const unchanged =
      current.username === profile.username &&
      current.realName === profile.realName &&
      current.roles.join(",") === roles.join(",") &&
      current.permissions.join(",") === permissions.join(",") &&
      current.permissionDetails.map((p) => p.name).join(",") ===
        permissionDetails.map((p) => p.name).join(",") &&
      JSON.stringify(current.dataScope) === JSON.stringify(dataScope);
    if (unchanged) return;

    const persist: PersistShape = {
      token: current.token,
      userId: profile.userId,
      username: profile.username,
      realName: profile.realName,
      end: profile.end,
      roles,
      menus: current.menus,
      permissions,
      permissionDetails,
      dataScope,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
    set({
      userId: persist.userId,
      username: persist.username,
      realName: persist.realName,
      end: persist.end,
      roles,
      permissions,
      permissionDetails,
      dataScope,
    });
  },
  clearAuth: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      token: null,
      userId: null,
      username: null,
      realName: null,
      end: null,
      roles: [],
      menus: [],
      permissions: [],
      permissionDetails: [],
      dataScope: null,
    });
  },
  hasPermission: (code) => get().permissions.includes(code),
  hasAnyPermission: (codes) => codes.some((c) => get().permissions.includes(c)),
  hasAllPermissions: (codes) => codes.every((c) => get().permissions.includes(c)),
}));