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
  /** 后端下发菜单（可选；缺省时前端按本地菜单配置 + permissions 过滤） */
  menus?: MenuInfo[];
  /** 数据范围（可选）：角色可见设备/知识库范围 */
  dataScope?: DataScopeInfo;
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
}

/** 登录请求 */
export interface LoginRequest {
  username: string;
  password: string;
}