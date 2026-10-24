import type { ReactNode } from "react";
import { tokens } from "./tokens";

/**
 * JSON 结构化展示（双端共用，不依赖任何 UI 框架）
 * - 字段名 → 中文label；枚举值 → 中文；嵌套对象/数组递归渲染
 * - 无法解析为 JSON 时回退为纯文本（保留换行）
 * - 同时提供审计场景的字段级 diff 视图
 */

const FIELD_LABELS: Record<string, string> = {
  // 通用
  id: "ID",
  name: "名称",
  code: "编码",
  status: "状态",
  enabled: "是否启用",
  remark: "备注",
  sort: "排序",
  type: "类型",
  value: "值",
  time: "时间",
  summary: "摘要",
  detail: "详情",
  reason: "说明",
  result: "结果",
  message: "消息",
  // 设备/数据
  deviceId: "设备ID",
  deviceName: "设备名称",
  deviceStatus: "设备状态",
  devTypeId: "设备类型",
  lineName: "产线",
  metricId: "指标ID",
  metricName: "指标名称",
  severity: "严重程度",
  anomalyType: "异常类型",
  startTime: "开始时间",
  endTime: "结束时间",
  peakValue: "峰值",
  avgValue: "均值",
  datasetId: "数据集ID",
  // 诊断
  confirmedAnomalies: "确认异常",
  anomalies: "异常清单",
  rootCauses: "候选根因",
  topCause: "首要根因",
  confidence: "置信度",
  cause: "根因描述",
  evidence: "证据",
  citations: "引用溯源",
  docName: "文档",
  docId: "文档ID",
  segmentId: "片段ID",
  chapter: "章节",
  pageNo: "页码",
  score: "相关度",
  content: "内容",
  // 备件成本
  spareParts: "备件清单",
  partName: "备件名称",
  partModel: "型号",
  quantity: "数量",
  unitPrice: "单价（元）",
  stock: "库存",
  sparePartId: "备件ID",
  downtimeLoss: "停机损失（元）",
  costLevel: "成本等级",
  costPerHour: "每小时停机损失",
  // 安全
  checkResult: "核查结论",
  safetyRequirements: "安全要求",
  safetyNotes: "安全注意事项",
  riskLevel: "风险等级",
  // 工单
  orderTitle: "工单标题",
  orderNo: "工单号",
  priority: "优先级",
  steps: "维修步骤",
  action: "操作",
  step: "步骤",
  tools: "工具",
  duration: "耗时",
  repairSteps: "维修步骤",
  faultSummary: "故障摘要",
  rootCause: "根因结论",
  estDowntimeHours: "预计停机（小时）",
  downtimeCost: "停机损失（元）",
  partsCost: "备件成本（元）",
  totalCost: "总成本（元）",
  generatedBy: "生成人",
  generatedTime: "生成时间",
  // 流程/节点
  phase: "阶段",
  agentCode: "Agent",
  agentName: "Agent 名称",
  stepOrder: "顺序",
  durationMs: "耗时（ms）",
  triggerCondition: "触发条件",
  timeoutSeconds: "超时（秒）",
  kbIds: "知识库",
  tools_bound: "绑定工具",
  // 审计
  beforeValue: "变更前",
  afterValue: "变更后",
  operateTime: "操作时间",
  operatorName: "操作人",
  endpoint: "接口",
  ip: "IP",
  errorMsg: "错误信息",
  traceId: "traceId",
};

const ENUM_LABELS: Record<string, string> = {
  normal: "正常",
  abnormal: "异常",
  warn: "警告",
  warning: "预警",
  fault: "故障",
  offline: "离线",
  low: "低",
  medium: "中",
  high: "高",
  pass: "通过",
  fail: "未通过",
  true: "是",
  false: "否",
  success: "成功",
  failed: "失败",
  skipped: "已跳过",
  running: "执行中",
  timeout: "超时",
  degraded: "降级完成",
  pending: "待处理",
  confirmed: "已确认",
  rejected: "已驳回",
  enabled: "启用",
  disabled: "停用",
  generated: "已生成",
  exported: "已导出",
  closed: "已关闭",
  threshold_breach: "阈值越限",
  sudden_fluctuation: "突发波动",
  continuous_trend: "持续趋势",
  missing_data: "数据缺失",
  monitor: "设备监测",
  root_cause: "根因诊断",
  spare_cost: "备件成本",
  safety: "安全规范",
  work_order: "工单",
  auto: "自动",
  manual: "人工",
};

/** 字段名 → 中文；未收录则原样返回 */
export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? FIELD_LABELS[toCamel(field)] ?? field;
}

/** 枚举值 → 中文；未收录则原样返回 */
export function enumLabel(value: string): string {
  return ENUM_LABELS[value] ?? value;
}

function toCamel(field: string): string {
  return field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** 安全解析 JSON，失败返回 undefined */
export function parseJsonSafe(raw?: string | null): unknown {
  if (raw == null) return undefined;
  const text = raw.trim();
  if (!text || (text[0] !== "{" && text[0] !== "[" && text[0] !== '"')) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) return Object.keys(value).length === 0;
  return false;
}

function scalarText(value: unknown): string {
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "-";
  if (typeof value === "string") return enumLabel(value);
  return String(value);
}

const labelStyle = { color: tokens.textSecondary, fontSize: 12, lineHeight: "20px" };
const valueStyle = { color: tokens.text, fontSize: 12, lineHeight: "20px", wordBreak: "break-word" } as const;

function Empty({ text }: { text: string }) {
  return <span style={{ color: tokens.textWeak, fontSize: 12 }}>{text}</span>;
}

function Scalar({ value }: { value: unknown }) {
  const text = scalarText(value);
  const isLong = text.length > 80;
  if (isLong) {
    return <div style={{ ...valueStyle, whiteSpace: "pre-wrap" }}>{text}</div>;
  }
  return <span style={valueStyle}>{text}</span>;
}

/** 数组：对象元素→卡片，标量元素→编号条目 */
function ArrayView({ items, emptyText }: { items: unknown[]; emptyText: string }) {
  if (items.length === 0) return <Empty text={emptyText} />;
  const allScalar = items.every((item) => !isRecord(item) && !Array.isArray(item));
  if (allScalar) {
    return (
      <ol style={{ margin: 0, paddingLeft: 18, display: "grid", rowGap: 2 }}>
        {items.map((item, i) => (
          <li key={i} style={{ ...valueStyle, listStyleType: items.length > 1 ? "decimal" : "none", marginLeft: items.length > 1 ? 0 : -18 }}>
            {scalarText(item)}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div style={{ display: "grid", rowGap: 4 }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            padding: "6px 8px",
            background: "#fff",
            border: `1px solid ${tokens.border}`,
            borderRadius: tokens.radiusSm,
          }}
        >
          <div style={{ color: tokens.textWeak, fontSize: 11, marginBottom: 2 }}>#{i + 1}</div>
          {isRecord(item) || Array.isArray(item) ? (
            <JsonValueView data={item} emptyText={emptyText} />
          ) : (
            <Scalar value={item} />
          )}
        </div>
      ))}
    </div>
  );
}

/** 任意 JSON 值的结构化渲染入口 */
export function JsonValueView({ data, emptyText = "无" }: { data: unknown; emptyText?: string }): ReactNode {
  if (isEmptyValue(data)) return <Empty text={emptyText} />;
  if (Array.isArray(data)) return <ArrayView items={data} emptyText={emptyText} />;
  if (!isRecord(data)) return <Scalar value={data} />;

  const entries = Object.entries(data).filter(([, v]) => !isEmptyValue(v));
  if (entries.length === 0) return <Empty text={emptyText} />;

  return (
    <div style={{ display: "grid", rowGap: 4 }}>
      {entries.map(([key, value]) => {
        const nested = isRecord(value) || Array.isArray(value);
        return (
          <div
            key={key}
            style={
              nested
                ? { display: "grid", rowGap: 2 }
                : { display: "grid", gridTemplateColumns: "104px 1fr", columnGap: 8, alignItems: "start" }
            }
          >
            <span style={labelStyle}>
              {fieldLabel(key)}
              {Array.isArray(value) ? `（${value.length}）` : ""}
            </span>
            {nested ? (
              <div
                style={{
                  paddingLeft: 8,
                  borderLeft: `2px solid ${tokens.border}`,
                  marginLeft: 2,
                }}
              >
                <JsonValueView data={value} emptyText={emptyText} />
              </div>
            ) : (
              <Scalar value={value} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface JsonTextViewProps {
  /** 原始字符串（可能是 JSON、JSON 字符串套 JSON，或纯文本） */
  raw?: string | null;
  emptyText?: string;
  /** 最大高度，超出滚动 */
  maxHeight?: number;
}

/** 字符串输入的结构化展示：能解析就结构化，不能解析按原文展示 */
export function JsonTextView({ raw, emptyText = "无", maxHeight }: JsonTextViewProps) {
  const parsed = parseJsonSafe(raw);
  const body =
    parsed !== undefined ? (
      <JsonValueView data={parsed} emptyText={emptyText} />
    ) : (
      <div style={{ ...valueStyle, whiteSpace: "pre-wrap" }}>{raw?.trim() ? raw : emptyText}</div>
    );
  return <div style={maxHeight ? { maxHeight, overflow: "auto" } : undefined}>{body}</div>;
}

export interface JsonDiffViewProps {
  before?: string | null;
  after?: string | null;
}

/** 审计变更对比：字段级 diff（旧值删除线红、新值绿、新增标注） */
export function JsonDiffView({ before, after }: JsonDiffViewProps) {
  const beforeParsed = parseJsonSafe(before);
  const afterParsed = parseJsonSafe(after);
  const beforeRecord = isRecord(beforeParsed) ? beforeParsed : null;
  const afterRecord = isRecord(afterParsed) ? afterParsed : null;

  if (!beforeRecord && !afterRecord) {
    return (
      <div style={{ display: "grid", rowGap: 8 }}>
        {before && (
          <div>
            <div style={labelStyle}>变更前</div>
            <JsonTextView raw={before} />
          </div>
        )}
        {after && (
          <div>
            <div style={labelStyle}>变更后</div>
            <JsonTextView raw={after} />
          </div>
        )}
        {!before && !after && <Empty text="无变更内容" />}
      </div>
    );
  }

  const keys = Array.from(new Set([...Object.keys(beforeRecord ?? {}), ...Object.keys(afterRecord ?? {})]));
  const changedRows = keys.filter(
    (key) => JSON.stringify(beforeRecord?.[key]) !== JSON.stringify(afterRecord?.[key]),
  );
  if (changedRows.length === 0) return <Empty text="无字段变更" />;

  return (
    <div style={{ display: "grid", rowGap: 6 }}>
      {changedRows.map((key) => {
        const oldVal = beforeRecord?.[key];
        const newVal = afterRecord?.[key];
        const isAdd = oldVal === undefined && newVal !== undefined;
        const isRemove = oldVal !== undefined && newVal === undefined;
        return (
          <div key={key} style={{ display: "grid", gridTemplateColumns: "104px 1fr", columnGap: 8, alignItems: "start" }}>
            <span style={labelStyle}>{fieldLabel(key)}</span>
            <div style={{ display: "grid", rowGap: 2 }}>
              {oldVal !== undefined && (
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: "20px",
                    color: isRemove ? tokens.danger : tokens.textWeak,
                    textDecoration: isRemove ? "line-through" : "none",
                    wordBreak: "break-word",
                  }}
                >
                  {isRecord(oldVal) || Array.isArray(oldVal) ? JSON.stringify(oldVal) : scalarText(oldVal)}
                </div>
              )}
              {newVal !== undefined && (
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: "20px",
                    color: tokens.success,
                    fontWeight: 600,
                    wordBreak: "break-word",
                  }}
                >
                  {isAdd && <span style={{ fontSize: 11, marginRight: 4, color: tokens.success }}>新增</span>}
                  {isRecord(newVal) || Array.isArray(newVal) ? JSON.stringify(newVal) : scalarText(newVal)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
