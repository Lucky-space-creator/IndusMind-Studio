import type { MenuInfo } from "@hwc/shared-types";
import { ADMIN_PERM } from "@hwc/shared-types";

/** 管理端侧边菜单配置（权限驱动过滤；与后端 sys_permission 对齐） */
export const ADMIN_MENUS: MenuInfo[] = [
  {
    key: "device",
    title: "设备配置",
    path: "/device",
    icon: "AppstoreOutlined",
    permissions: [ADMIN_PERM.DEVICE_TYPE_READ, ADMIN_PERM.DEVICE_INFO_READ, ADMIN_PERM.DEVICE_METRIC_READ],
  },
  {
    key: "knowledge",
    title: "知识库",
    path: "/knowledge",
    icon: "BookOutlined",
    permissions: [ADMIN_PERM.KB_READ, ADMIN_PERM.KB_DOCUMENT_READ],
  },
  {
    key: "docgraph",
    title: "文档关联",
    path: "/docgraph",
    icon: "ShareAltOutlined",
    permissions: [ADMIN_PERM.DOCGRAPH_READ],
  },
  {
    key: "data",
    title: "数据管理",
    path: "/data",
    icon: "DatabaseOutlined",
    permissions: [ADMIN_PERM.DATA_DATASET_READ],
  },
  {
    key: "agent",
    title: "Agent与流程",
    path: "/agent",
    icon: "RobotOutlined",
    permissions: [ADMIN_PERM.AGENT_DEFINITION_READ, ADMIN_PERM.AGENT_FLOW_READ],
  },
  {
    key: "publish",
    title: "发布监控",
    path: "/publish",
    icon: "CloudUploadOutlined",
    permissions: [ADMIN_PERM.PUBLISH_SERVICE_READ],
  },
  {
    key: "account",
    title: "账号权限",
    path: "/account",
    icon: "TeamOutlined",
    permissions: [ADMIN_PERM.ACCOUNT_USER_READ, ADMIN_PERM.ACCOUNT_ROLE_READ],
  },
  {
    key: "audit",
    title: "审计日志",
    path: "/audit",
    icon: "AuditOutlined",
    permissions: [ADMIN_PERM.AUDIT_LOG_READ],
  },
];