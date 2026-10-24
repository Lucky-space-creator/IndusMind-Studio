/** ===== 账号权限与审计域（hwc-security）===== */

export interface SysUser {
  id: number;
  username: string;
  nickname: string;
  phone?: string;
  email?: string;
  /** 1/0 */
  status: number;
  lastLoginTime?: string;
  remark?: string;
  roleIds?: number[];
}

export interface SysRole {
  id: number;
  code: string;
  name: string;
  /** user/admin/both */
  endType: string;
  builtIn: number;
  sort: number;
  description?: string;
  /** 已绑定的权限点 ID（权限树回显用） */
  permissionIds?: number[];
}

export interface SysPermission {
  id: number;
  code: string;
  name: string;
  module: string;
  resource: string;
  /** read/write/publish/delete/export */
  action: string;
  endType: string;
  sort: number;
}

export interface SysRoleDataScope {
  id: number;
  roleId: number;
  scopeType: string;
  scopeId: number;
  remark?: string;
}

export interface SysAuditLog {
  id: number;
  operatorId: number;
  operatorName: string;
  endpoint?: string;
  module: string;
  action: string;
  targetType?: string;
  targetId?: string;
  beforeValue?: string;
  afterValue?: string;
  /** 1/0 */
  result: number;
  errorMsg?: string;
  ip?: string;
  traceId?: string;
  operateTime: string;
}