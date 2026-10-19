import { api, downloadFile, saveBlob } from "@hwc/shared-api";
import type { PageResult, SysAuditLog, SysPermission, SysRole, SysRoleDataScope, SysUser } from "@hwc/shared-types";

/**
 * 账号权限 / 审计日志接口。
 * 注意：后端 hwc-security 当前仅实现登录（AuthController），以下管理接口按契约预留；
 * 后端接口上线前，页面会展示统一的中文降级提示（ApiError）。
 */

export const pageUsers = (params: { current?: number; size?: number; keyword?: string; status?: number }) =>
  api.get<PageResult<SysUser>>("/api/admin/account/users", params);

export const createUser = (body: Partial<SysUser> & { password?: string; roleIds?: number[] }) =>
  api.post<SysUser>("/api/admin/account/users", body);

export const updateUser = (id: number, body: Partial<SysUser> & { roleIds?: number[] }) =>
  api.put<void>(`/api/admin/account/users/${id}`, body);

export const deleteUser = (id: number) => api.delete<void>(`/api/admin/account/users/${id}`);

export const listRoles = () => api.get<SysRole[]>("/api/admin/account/roles");

export const createRole = (body: Partial<SysRole> & { permissionIds?: number[] }) =>
  api.post<SysRole>("/api/admin/account/roles", body);

export const updateRole = (id: number, body: Partial<SysRole> & { permissionIds?: number[] }) =>
  api.put<void>(`/api/admin/account/roles/${id}`, body);

export const listPermissions = () => api.get<SysPermission[]>("/api/admin/account/permissions");

export const listRoleDataScopes = (roleId: number) =>
  api.get<SysRoleDataScope[]>(`/api/admin/account/roles/${roleId}/data-scopes`);

export const saveRoleDataScope = (roleId: number, body: Partial<SysRoleDataScope>) =>
  api.put<void>(`/api/admin/account/roles/${roleId}/data-scopes`, body);

export const pageAuditLogs = (params: {
  current?: number;
  size?: number;
  operatorName?: string;
  module?: string;
  action?: string;
  beginTime?: string;
  endTime?: string;
}) => api.get<PageResult<SysAuditLog>>("/api/admin/audit/logs", params);

export const exportAuditLogs = async (params: { beginTime?: string; endTime?: string }) => {
  const blob = await downloadFile("/api/admin/audit/logs/export", params);
  saveBlob(blob, `audit-logs-${Date.now()}.csv`);
};