import type { DataScopeInfo, EndType, LoginResult, MenuInfo } from "@hwc/shared-types";
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
  dataScope: DataScopeInfo | null;
  setAuth: (result: LoginResult) => void;
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
  dataScope?: DataScopeInfo | null;
}

function loadInitial(): Pick<
  AuthState,
  "token" | "userId" | "username" | "realName" | "end" | "roles" | "menus" | "permissions" | "dataScope"
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
      dataScope: result.dataScope ?? null,
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
      dataScope: null,
    });
  },
  hasPermission: (code) => get().permissions.includes(code),
  hasAnyPermission: (codes) => codes.some((c) => get().permissions.includes(c)),
  hasAllPermissions: (codes) => codes.every((c) => get().permissions.includes(c)),
}));