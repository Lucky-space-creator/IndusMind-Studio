/** ===== 通用业务枚举 ===== */

/** 设备状态 */
export type DeviceStatus = "normal" | "warning" | "fault" | "offline";

/** 告警/风险等级 */
export type RiskLevel = "low" | "medium" | "high";

/** 文档状态 */
export type DocStatus = "enabled" | "disabled";

/** 知识库索引状态 */
export type KbIndexStatus = "init" | "indexing" | "ready" | "error";

/** 时间范围快捷项 */
export type TimeRangePreset = "1h" | "6h" | "24h" | "7d" | "30d";

export type * from "./api";
export type * from "./auth";
export type * from "./device";
export type * from "./knowledge";
export type * from "./data";
export type * from "./agent";
export type * from "./workorder";
export type * from "./publish";
export type * from "./system";

export { ADMIN_PERM, USER_PERM, ALL_PERMISSIONS } from "./permission";