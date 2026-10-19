/**
 * 权限码常量（唯一权威来源，禁止在业务代码中硬编码字符串）
 * 与后端 sys_permission 初始化数据（V2__init_data.sql）逐条对齐。
 * 编码规范：<模块>:<资源>:<动作>，动作 read/write/publish/delete/export
 */

/** 管理端权限码 */
export const ADMIN_PERM = {
  /** 设备配置 */
  DEVICE_TYPE_READ: "device:type:read",
  DEVICE_TYPE_WRITE: "device:type:write",
  DEVICE_INFO_READ: "device:info:read",
  DEVICE_INFO_WRITE: "device:info:write",
  DEVICE_METRIC_READ: "device:metric:read",
  DEVICE_METRIC_WRITE: "device:metric:write",
  DEVICE_ALARM_RULE_READ: "device:alarm-rule:read",
  DEVICE_ALARM_RULE_WRITE: "device:alarm-rule:write",
  DEVICE_SPARE_PART_READ: "device:spare-part:read",
  DEVICE_SPARE_PART_WRITE: "device:spare-part:write",
  DEVICE_DOWNTIME_COST_READ: "device:downtime-cost:read",
  DEVICE_DOWNTIME_COST_WRITE: "device:downtime-cost:write",
  /** 知识库 */
  KB_READ: "knowledge:kb:read",
  KB_WRITE: "knowledge:kb:write",
  KB_DOCUMENT_READ: "knowledge:document:read",
  KB_DOCUMENT_WRITE: "knowledge:document:write",
  KB_DOCUMENT_PUBLISH: "knowledge:document:publish",
  KB_DOCUMENT_DELETE: "knowledge:document:delete",
  KB_SEGMENT_READ: "knowledge:segment:read",
  KB_SEGMENT_WRITE: "knowledge:segment:write",
  KB_INDEX_READ: "knowledge:index:read",
  KB_INDEX_WRITE: "knowledge:index:write",
  /** 文档关联 */
  DOCGRAPH_READ: "docgraph:graph:read",
  DOCGRAPH_WRITE: "docgraph:graph:write",
  /** 数据管理 */
  DATA_DATASET_READ: "data:dataset:read",
  DATA_DATASET_WRITE: "data:dataset:write",
  DATA_DATASET_DELETE: "data:dataset:delete",
  DATA_CLEAN_READ: "data:clean:read",
  DATA_CLEAN_WRITE: "data:clean:write",
  DATA_ANOMALY_READ: "data:anomaly:read",
  DATA_ANOMALY_EXPORT: "data:anomaly:export",
  /** Agent 与流程 */
  AGENT_DEFINITION_READ: "agent:definition:read",
  AGENT_DEFINITION_WRITE: "agent:definition:write",
  AGENT_BINDING_READ: "agent:binding:read",
  AGENT_BINDING_WRITE: "agent:binding:write",
  AGENT_FLOW_READ: "agent:flow:read",
  AGENT_FLOW_WRITE: "agent:flow:write",
  /** 发布监控 */
  PUBLISH_SERVICE_READ: "publish:service:read",
  PUBLISH_SERVICE_WRITE: "publish:service:write",
  PUBLISH_SERVICE_PUBLISH: "publish:service:publish",
  PUBLISH_CREDENTIAL_READ: "publish:credential:read",
  PUBLISH_CREDENTIAL_WRITE: "publish:credential:write",
  PUBLISH_CALL_LOG_READ: "publish:call-log:read",
  /** 审计日志 */
  AUDIT_LOG_READ: "audit:log:read",
  AUDIT_LOG_EXPORT: "audit:log:export",
  /** 账号权限 */
  ACCOUNT_USER_READ: "account:user:read",
  ACCOUNT_USER_WRITE: "account:user:write",
  ACCOUNT_USER_DELETE: "account:user:delete",
  ACCOUNT_ROLE_READ: "account:role:read",
  ACCOUNT_ROLE_WRITE: "account:role:write",
} as const;

/** 用户端权限码 */
export const USER_PERM = {
  DASHBOARD_READ: "dashboard:read",
  CHAT_READ: "chat:read",
  CHAT_WRITE: "chat:write",
  DIAGNOSIS_READ: "diagnosis:read",
  DIAGNOSIS_WRITE: "diagnosis:write",
  TRACE_READ: "trace:read",
  WORKORDER_READ: "workorder:read",
  WORKORDER_EXPORT: "workorder:export",
  KNOWLEDGE_SEARCH_READ: "knowledge:search:read",
} as const;

/** 全部权限码（供调试/权限矩阵展示） */
export const ALL_PERMISSIONS: readonly string[] = Object.freeze([
  ...Object.values(ADMIN_PERM),
  ...Object.values(USER_PERM),
]);