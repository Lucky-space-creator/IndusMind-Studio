import type { MenuInfo } from "@hwc/shared-types";
import { useAuthStore } from "./store";

export interface PermissionApi {
  /** 是否拥有单个权限码 */
  has: (code: string) => boolean;
  /** 任一权限码满足即通过 */
  hasAny: (codes: string[]) => boolean;
  /** 全部权限码满足才通过 */
  hasAll: (codes: string[]) => boolean;
  /** 后端下发的菜单（可能为空，此时使用本地菜单配置过滤） */
  serverMenus: MenuInfo[];
  /** 按权限过滤菜单配置（无权限的项不渲染） */
  filterMenus: (menus: MenuInfo[]) => MenuInfo[];
  /** 数据范围（用于界面提示，非安全边界） */
  dataScopeText: string;
}

/**
 * 权限判断钩子（按钮/路由/菜单四层中前三层的统一入口）。
 * 权限仅用于展示控制，不作为安全边界；后端仍强制校验。
 */
export function usePermission(): PermissionApi {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);
  const hasAllPermissions = useAuthStore((s) => s.hasAllPermissions);
  const permissions = useAuthStore((s) => s.permissions);
  const serverMenus = useAuthStore((s) => s.menus);
  const dataScope = useAuthStore((s) => s.dataScope);

  const filterMenus = (menus: MenuInfo[]): MenuInfo[] =>
    menus
      .map((menu) => {
        const children = menu.children ? filterMenus(menu.children) : undefined;
        const selfOk = !menu.permissions || menu.permissions.length === 0 || menu.permissions.some((p) => permissions.includes(p));
        if (!selfOk) return null;
        if (menu.children && children && children.length === 0) return null;
        return { ...menu, children } as MenuInfo;
      })
      .filter((m): m is MenuInfo => m !== null);

  const scopeText = (() => {
    if (!dataScope) return "全部数据";
    switch (dataScope.scopeType) {
      case "ALL":
        return "全部数据";
      case "LINE":
        return `仅 ${dataScope.scopeValue ?? "指定产线"}`;
      case "DEVICE":
        return `仅指定设备（${dataScope.scopeValue ?? "-"}）`;
      case "KB":
        return `仅指定知识库（${dataScope.scopeValue ?? "-"}）`;
      default:
        return dataScope.remark ?? "受数据范围限制";
    }
  })();

  return {
    has: hasPermission,
    hasAny: hasAnyPermission,
    hasAll: hasAllPermissions,
    serverMenus,
    filterMenus,
    dataScopeText: scopeText,
  };
}