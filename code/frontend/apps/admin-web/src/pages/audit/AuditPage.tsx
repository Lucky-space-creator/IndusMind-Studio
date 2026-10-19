import { DownloadOutlined, FileSearchOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Alert, Button, DatePicker, Drawer, Input, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Dayjs } from "dayjs";
import { Auth } from "@hwc/shared-auth";
import { EmptyState, Panel } from "@hwc/shared-ui";
import { ADMIN_PERM } from "@hwc/shared-types";
import type { SysAuditLog } from "@hwc/shared-types";
import * as systemApi from "../../api/system";

/**
 * 审计日志区：操作流水查询 + 详情查看 + CSV 导出。
 * 后端审计查询接口上线前显示中文降级提示。
 */

const MODULE_OPTIONS = [
  { value: "auth", label: "认证" },
  { value: "device", label: "设备配置" },
  { value: "knowledge", label: "知识库" },
  { value: "docgraph", label: "文档关联" },
  { value: "data", label: "数据管理" },
  { value: "agent", label: "Agent与流程" },
  { value: "publish", label: "发布监控" },
  { value: "account", label: "账号权限" },
  { value: "audit", label: "审计" },
];

const ACTION_COLOR: Record<string, string> = {
  create: "green",
  update: "blue",
  delete: "red",
  read: "default",
  export: "purple",
  login: "cyan",
  logout: "default",
};

export default function AuditPage() {
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [operator, setOperator] = useState("");
  const [module, setModule] = useState<string | undefined>();
  const [action, setAction] = useState("");
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [detail, setDetail] = useState<SysAuditLog | null>(null);
  const [exporting, setExporting] = useState(false);

  const queryParams = {
    current: page,
    size: 15,
    operatorName: operator || undefined,
    module,
    action: action || undefined,
    beginTime: range?.[0]?.format("YYYY-MM-DD 00:00:00"),
    endTime: range?.[1]?.format("YYYY-MM-DD 23:59:59"),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "audit-logs", queryParams],
    queryFn: () => systemApi.pageAuditLogs(queryParams),
    retry: false,
  });

  const handleExport = async () => {
    try {
      setExporting(true);
      await systemApi.exportAuditLogs({
        beginTime: queryParams.beginTime,
        endTime: queryParams.endTime,
      });
      message.success("审计日志已导出");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  if (error) {
    return (
      <Panel title="审计日志">
        <Alert
          type="warning"
          showIcon
          message="审计查询接口暂未开放"
          description={
            <>
              <p style={{ margin: 0 }}>
                后端审计日志查询/导出接口尚未实现；页面按接口契约已就绪，接口上线后即可直接使用。
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748B" }}>
                请求失败原因：{error instanceof Error ? error.message : "网络异常"}
              </p>
            </>
          }
        />
      </Panel>
    );
  }

  const columns: ColumnsType<SysAuditLog> = [
    { title: "时间", dataIndex: "operateTime", width: 170 },
    { title: "操作人", dataIndex: "operatorName", width: 110 },
    {
      title: "模块",
      dataIndex: "module",
      width: 100,
      render: (v) => MODULE_OPTIONS.find((m) => m.value === v)?.label ?? v,
    },
    {
      title: "动作",
      dataIndex: "action",
      width: 90,
      render: (v) => <Tag color={ACTION_COLOR[v] ?? "default"}>{v}</Tag>,
    },
    {
      title: "对象",
      width: 180,
      ellipsis: true,
      render: (_, r) => (r.targetType ? `${r.targetType}${r.targetId ? `#${r.targetId}` : ""}` : "-"),
    },
    {
      title: "结果",
      dataIndex: "result",
      width: 80,
      render: (v) => (v === 1 ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>),
    },
    { title: "IP", dataIndex: "ip", width: 120 },
    {
      title: "操作",
      width: 90,
      render: (_, record) => (
        <Button type="link" size="small" icon={<FileSearchOutlined />} onClick={() => setDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <Panel
      title="审计日志"
      subtitle="记录管理端全部敏感操作（增删改/导出/登录），支持按操作人、模块、时间检索"
      extra={
        <Auth code={ADMIN_PERM.AUDIT_LOG_EXPORT}>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
            导出 CSV
          </Button>
        </Auth>
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="操作人"
          style={{ width: 150 }}
          onPressEnter={(e) => {
            setOperator((e.target as HTMLInputElement).value);
            setPage(1);
          }}
          onChange={(e) => !e.target.value && setOperator("")}
        />
        <Select
          allowClear
          placeholder="模块"
          style={{ width: 130 }}
          options={MODULE_OPTIONS}
          value={module}
          onChange={(v) => {
            setModule(v);
            setPage(1);
          }}
        />
        <Input
          allowClear
          placeholder="动作（如 create/delete）"
          style={{ width: 160 }}
          onPressEnter={(e) => {
            setAction((e.target as HTMLInputElement).value);
            setPage(1);
          }}
          onChange={(e) => !e.target.value && setAction("")}
        />
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => {
            setRange(v as [Dayjs | null, Dayjs | null] | null);
            setPage(1);
          }}
          allowEmpty={[true, true]}
        />
      </Space>

      <Table<SysAuditLog>
        rowKey="id"
        size="middle"
        loading={isLoading}
        columns={columns}
        dataSource={data?.records ?? []}
        locale={{ emptyText: <EmptyState description="暂无审计记录" /> }}
        pagination={{
          current: page,
          pageSize: 15,
          total: data?.total ?? 0,
          showTotal: (t) => `共 ${t} 条`,
          onChange: setPage,
        }}
      />

      <Drawer
        title="审计详情"
        width={480}
        open={detail != null}
        onClose={() => setDetail(null)}
        styles={{ body: { paddingTop: 8 } }}
      >
        {detail && (
          <div style={{ display: "grid", rowGap: 12 }}>
            <Field label="操作时间" value={detail.operateTime} />
            <Field label="操作人" value={`${detail.operatorName}（ID: ${detail.operatorId}）`} />
            <Field label="接口" value={detail.endpoint} />
            <Field label="模块 / 动作" value={`${detail.module} / ${detail.action}`} />
            <Field
              label="对象"
              value={detail.targetType ? `${detail.targetType}${detail.targetId ? ` #${detail.targetId}` : ""}` : undefined}
            />
            <Field label="IP" value={detail.ip} />
            <Field label="traceId" value={detail.traceId} monospace />
            <Field label="执行结果" value={detail.result === 1 ? "成功" : "失败"} />
            {detail.errorMsg && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  错误信息
                </Typography.Text>
                <pre
                  style={{
                    margin: "4px 0 0",
                    padding: 8,
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#B91C1C",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {detail.errorMsg}
                </pre>
              </div>
            )}
            {detail.beforeValue && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  变更前
                </Typography.Text>
                <pre style={preStyle}>{prettyJson(detail.beforeValue)}</pre>
              </div>
            )}
            {detail.afterValue && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  变更后
                </Typography.Text>
                <pre style={preStyle}>{prettyJson(detail.afterValue)}</pre>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </Panel>
  );
}

const preStyle: React.CSSProperties = {
  margin: "4px 0 0",
  padding: 8,
  background: "#F8FAFC",
  border: "1px solid #E2E8F0",
  borderRadius: 4,
  fontSize: 12,
  color: "#334155",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

function Field({ label, value, monospace }: { label: string; value?: string; monospace?: boolean }) {
  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
      <div style={monospace ? { fontFamily: "monospace", fontSize: 12 } : undefined}>
        {value ?? "-"}
      </div>
    </div>
  );
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
