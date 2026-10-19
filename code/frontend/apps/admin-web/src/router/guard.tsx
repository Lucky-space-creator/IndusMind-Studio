import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore, usePermission } from "@hwc/shared-auth";

/** 登录守卫：未登录跳登录页（记录来源路径） */
export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

/** 权限守卫：路由级校验，无权限跳 403（菜单层已过滤，此处防直链越权） */
export function RequirePermission({ codes, children }: { codes?: string[]; children: ReactNode }) {
  const { hasAny } = usePermission();
  if (codes && codes.length > 0 && !hasAny(codes)) {
    return <Navigate to="/403" replace />;
  }
  return <>{children}</>;
}