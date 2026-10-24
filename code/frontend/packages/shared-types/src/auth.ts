/** 端类型：用户端 / 管理端（角色 end_type: user/admin/both） */
export type EndType = "user" | "admin";

/** 登录接口返回（Java 详设 §7：roles/menus/permissions/dataScope） */
export interface LoginResult {
  token: string;
  userId: number;
  username: string;
  realName: string;
  end: EndType;
  roles: string[];
  permissions: string[];
  /** 权限点明细（含中文名称），供界面展示「当前账号拥有哪些权限」 */
  permissionDetails?: PermissionItem[];
  /** 后端下发菜单（可选；缺省时前端按本地菜单配置 + permissions 过滤） */
  menus?: MenuInfo[];
  /** 数据范围（可选）：角色可见设备/知识库范围 */
  dataScope?: DataScopeInfo;
}

/** 权限点明细：code 用于鉴权，其余字段仅用于展示 */
export interface PermissionItem {
  code: string;
  /** 中文名称，如「知识库查看」 */
  name: string;
  /** 所属模块，如 knowledge / device */
  module: string;
  /** 动作：read/write/publish/delete/export */
  action: string;
}

/** 菜单信息（后端下发或前端本地配置统一结构） */
export interface MenuInfo {
  key: string;
  title: string;
  path?: string;
  icon?: string;
  /** 进入该菜单所需权限码（任一满足即可） */
  permissions?: string[];
  children?: MenuInfo[];
}

/** 数据范围 */
export interface DataScopeInfo {
  /** ALL=全部 / LINE=指定产线 / DEVICE=指定设备 / KB=指定知识库 */
  scopeType: "ALL" | "LINE" | "DEVICE" | "KB";
  scopeValue?: string;
  remark?: string;
  /** 授权对象总数（多选数据范围时使用） */
  count?: number;
}

/**
 * 当前用户权限档案（`GET /api/{end}/auth/profile`）。
 * 与登录返回同源但不含 token，用于权限被调整后同步界面展示。
 */
export interface UserProfile {
  userId: number;
  username: string;
  realName: string;
  end: EndType;
  roles: string[];
  permissions: string[];
  /** 权限点明细（含中文名称） */
  permissionDetails?: PermissionItem[];
  dataScope?: DataScopeInfo | null;
}

/** 登录请求 */
export interface LoginRequest {
  username: string;
  password: string;
}