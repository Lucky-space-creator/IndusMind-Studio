import type { MenuInfo } from "@hwc/shared-types";
import { USER_PERM } from "@hwc/shared-types";

/** 用户端一级导航（≤5）+ 辅助入口；permissions 任一满足即展示（无权限不渲染） */
export interface NavItem extends MenuInfo {
  children?: NavItem[];
}

export const USER_NAV: NavItem[] = [
  { key: "dashboard", title: "工作台", path: "/", permissions: [USER_PERM.DASHBOARD_READ] },
  {
    key: "device",
    title: "设备监控",
    path: "/device",
    permissions: [USER_PERM.DASHBOARD_READ],
    children: [
      { key: "device-overview", title: "设备总览", path: "/device" },
      { key: "device-list", title: "设备清单", path: "/device/list" },
    ],
  },
  { key: "alarm", title: "告警中心", path: "/alarm", permissions: [USER_PERM.DASHBOARD_READ] },
  {
    key: "diagnosis",
    title: "智能诊断",
    path: "/diagnosis",
    permissions: [USER_PERM.DIAGNOSIS_READ, USER_PERM.CHAT_READ],
    children: [
      { key: "diagnosis-chat", title: "智能问答", path: "/diagnosis/chat", permissions: [USER_PERM.CHAT_READ] },
      { key: "diagnosis-run", title: "协同诊断", path: "/diagnosis/run", permissions: [USER_PERM.DIAGNOSIS_READ] },
    ],
  },
  { key: "workorder", title: "维修工单", path: "/workorder", permissions: [USER_PERM.WORKORDER_READ] },
];

/** 顶部辅助入口（知识检索 / 个人中心） */
export const USER_AUX_NAV: NavItem[] = [
  { key: "knowledge", title: "知识检索", path: "/knowledge", permissions: [USER_PERM.KNOWLEDGE_SEARCH_READ] },
  { key: "profile", title: "个人中心", path: "/profile" },
];