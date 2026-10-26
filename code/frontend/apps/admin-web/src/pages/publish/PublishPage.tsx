import { CloudUploadOutlined, EditOutlined, KeyOutlined, PauseCircleOutlined, PlayCircleOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Descriptions, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Statistic, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Auth } from "@hwc/shared-auth";
import { EmptyState, Panel, StatusTag } from "@hwc/shared-ui";
import { ADMIN_PERM } from "@hwc/shared-types";
import type { PubCallLog, PubCredential, PubService, PubVersion } from "@hwc/shared-types";
import * as publishApi from "../../api/publish";
import { genCode } from "../../utils/codegen";

/** 发布监控区：服务列表 + 上线/暂停 + 凭证 + 版本 + 调用日志 */
export default function PublishPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PubService | null>(null);
  const [detail, setDetail] = useState<PubService | null>(null);
  const [issued, setIssued] = useState<{ title: string; accessKey: string; secretKey: string } | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "services", page, keyword, status],
    queryFn: () => publishApi.pageServices({ current: page, size: 10, keyword: keyword || undefined, status }),
  });

  const { data: flows } = useQuery({
    queryKey: ["admin", "flows", "for-publish"],
    queryFn: () => import("../../api/agent").then((m) => m.pageFlows({ current: 1, size: 100 })),
  });

  const create = useMutation({
    mutationFn: (values: Partial<PubService>) => publishApi.createService(values),
    onSuccess: () => {
      message.success("服务已创建（默认暂停状态，上线后签发凭证）");
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "services"] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<PubService> }) =>
      publishApi.updateService(id, body),
    onSuccess: () => {
      message.success("服务配置已更新");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "services"] });
    },
  });

  const publish = useMutation({
    mutationFn: (id: number) => publishApi.publishService(id),
    onSuccess: (r) => {
      message.success("服务已上线，凭证已签发（仅本次展示，请妥善保存）");
      setIssued({ title: "上线签发凭证", accessKey: r.accessKey, secretKey: r.secretKey });
      qc.invalidateQueries({ queryKey: ["admin", "services"] });
    },
  });

  const pause = useMutation({
    mutationFn: (id: number) => publishApi.pauseService(id),
    onSuccess: () => {
      message.success("服务已暂停（调用方将收到服务暂停提示）");
      qc.invalidateQueries({ queryKey: ["admin", "services"] });
    },
  });

  const rotate = useMutation({
    mutationFn: (id: number) => publishApi.rotateCredential(id),
    onSuccess: (r) => {
      message.success("凭证已轮换（旧凭证即刻失效）");
      setIssued({ title: "轮换后的新凭证", accessKey: r.accessKey, secretKey: r.secretKey });
      qc.invalidateQueries({ queryKey: ["admin", "service-credentials", detail?.id] });
    },
  });

  const columns: ColumnsType<PubService> = [
    { title: "服务编码", dataIndex: "code", width: 130 },
    { title: "服务名称", dataIndex: "name" },
    { title: "流程 ID", dataIndex: "flowId", width: 80 },
    { title: "当前版本", dataIndex: "currentVersion", width: 90, render: (v) => v ?? "-" },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (s) => <StatusTag status={s} label={s === "online" ? "上线" : "暂停"} />,
    },
    {
      title: "操作",
      width: 300,
      render: (_, record) => (
        <Space size={0} wrap>
          <Button type="link" size="small" onClick={() => setDetail(record)}>
            详情
          </Button>
          <Auth code={ADMIN_PERM.PUBLISH_SERVICE_WRITE}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                editForm.setFieldsValue({
                  name: record.name,
                  flowId: record.flowId,
                  description: record.description,
                });
                setEditing(record);
              }}
            >
              编辑
            </Button>
          </Auth>
          <Auth code={ADMIN_PERM.PUBLISH_SERVICE_PUBLISH}>
            {record.status !== "online" ? (
              <Popconfirm title="上线将签发凭证并生成版本快照，确认？" onConfirm={() => publish.mutate(record.id)}>
                <Button type="link" size="small" icon={<CloudUploadOutlined />}>
                  上线
                </Button>
              </Popconfirm>
            ) : (
              <Button type="link" size="small" icon={<PauseCircleOutlined />} onClick={() => pause.mutate(record.id)}>
                暂停
              </Button>
            )}
          </Auth>
          <Auth code={ADMIN_PERM.PUBLISH_CREDENTIAL_WRITE}>
            <Popconfirm title="轮换后旧凭证立即失效，确认？" onConfirm={() => rotate.mutate(record.id)}>
              <Button type="link" size="small" icon={<KeyOutlined />}>
                轮换凭证
              </Button>
            </Popconfirm>
          </Auth>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Panel
        title="已发布服务"
        subtitle="开放 API：POST /api/open/v1/{服务编码}/invoke（Bearer Base64(ak:sk)）"
        extra={
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="按编码/名称搜索"
              style={{ width: 180 }}
              onPressEnter={(e) => {
                setKeyword((e.target as HTMLInputElement).value);
                setPage(1);
              }}
              onChange={(e) => !e.target.value && setKeyword("")}
            />
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 100 }}
              options={[
                { value: "online", label: "上线" },
                { value: "paused", label: "暂停" },
              ]}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            />
            <Auth code={ADMIN_PERM.PUBLISH_SERVICE_WRITE}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  form.resetFields();
                  form.setFieldsValue({ code: genCode("svc-") });
                  setCreateOpen(true);
                }}
              >
                新建服务
              </Button>
            </Auth>
          </Space>
        }
      >
        <Table<PubService>
          rowKey="id"
          size="middle"
          loading={isLoading}
          columns={columns}
          dataSource={data?.records ?? []}
          locale={{ emptyText: <EmptyState description="暂无发布服务" /> }}
          pagination={{
            current: page,
            pageSize: 10,
            total: data?.total ?? 0,
            showTotal: (t) => `共 ${t} 条`,
            onChange: setPage,
          }}
        />
      </Panel>

      <Modal
        title="新建发布服务"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)}>
          <Form.Item
            name="code"
            label="服务编码"
            rules={[
              { required: true, message: "请输入服务编码" },
              { pattern: /^[a-z0-9-]+$/, message: "仅允许小写字母、数字与连字符（用于对外 URL）" },
            ]}
          >
            <Input placeholder="自动生成，可修改" />
          </Form.Item>
          <Form.Item name="name" label="服务名称" rules={[{ required: true, message: "请输入服务名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="flowId" label="绑定协同流程" rules={[{ required: true, message: "请选择协同流程" }]}>
            <Select
              options={(flows?.records ?? []).map((f) => ({ value: f.id, label: `${f.name}（v${f.version}）` }))}
            />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改发布服务"
        open={editing != null}
        onCancel={() => setEditing(null)}
        onOk={() => editForm.submit()}
        confirmLoading={update.isPending}
        okText="保存"
        forceRender
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) => editing && update.mutate({ id: editing.id, body: v })}
        >
          <Form.Item label="服务编码">
            <div>
              <Input value={editing?.code} disabled />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                对外调用地址为 /api/open/v1/{editing?.code}/invoke，编码不可修改
              </Typography.Text>
            </div>
          </Form.Item>
          <Form.Item name="name" label="服务名称" rules={[{ required: true, message: "请输入服务名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="flowId"
            label="绑定协同流程"
            rules={[{ required: true, message: "请选择协同流程" }]}
            extra={
              editing?.status === "online"
                ? "服务上线中，不可更换关联流程；如需更换请先暂停服务"
                : undefined
            }
          >
            <Select
              disabled={editing?.status === "online"}
              options={(flows?.records ?? []).map((f) => ({ value: f.id, label: `${f.name}（v${f.version}）` }))}
            />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <ServiceDetail service={detail} onClose={() => setDetail(null)} />

      <Modal
        title={issued?.title}
        open={issued != null}
        onCancel={() => setIssued(null)}
        footer={<Button type="primary" onClick={() => setIssued(null)}>我已保存</Button>}
        destroyOnClose
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="AccessKey">
            <Typography.Text copyable code>
              {issued?.accessKey}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="SecretKey">
            <Typography.Text copyable code>
              {issued?.secretKey}
            </Typography.Text>
          </Descriptions.Item>
        </Descriptions>
        <Typography.Paragraph type="warning" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
          密钥仅此一次展示；调用方式：Authorization: Bearer base64(accessKey:secretKey)
        </Typography.Paragraph>
      </Modal>
    </>
  );
}

/* ==================== 服务详情（凭证/版本/调用日志） ==================== */

function ServiceDetail({ service, onClose }: { service: PubService | null; onClose: () => void }) {
  const [tab, setTab] = useState<"callLogs" | "versions" | "credentials">("callLogs");
  const [logPage, setLogPage] = useState(1);

  const { data: logs } = useQuery({
    queryKey: ["admin", "call-logs", service?.id, logPage],
    queryFn: () => publishApi.pageCallLogs({ current: logPage, size: 10, serviceId: service?.id }),
    enabled: service != null && tab === "callLogs",
  });

  const { data: versions } = useQuery({
    queryKey: ["admin", "service-versions", service?.id],
    queryFn: () => publishApi.listVersions(service!.id),
    enabled: service != null && tab === "versions",
  });

  const { data: credentials } = useQuery({
    queryKey: ["admin", "service-credentials", service?.id],
    queryFn: () => publishApi.listCredentials(service!.id),
    enabled: service != null && tab === "credentials",
  });

  const successCount = (logs?.records ?? []).filter((l) => l.success === 1).length;
  const totalCount = logs?.records?.length ?? 0;
  const avgLatency =
    totalCount > 0
      ? Math.round((logs?.records ?? []).reduce((s, l) => s + (l.latencyMs ?? 0), 0) / totalCount)
      : 0;

  const logColumns: ColumnsType<PubCallLog> = [
    { title: "时间", dataIndex: "callTime", width: 170 },
    {
      title: "结果",
      dataIndex: "success",
      width: 80,
      render: (v) => (v === 1 ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>),
    },
    { title: "HTTP", dataIndex: "httpStatus", width: 70 },
    { title: "耗时(ms)", dataIndex: "latencyMs", width: 90 },
    { title: "traceId", dataIndex: "traceId", ellipsis: true, render: (v) => <code style={{ fontSize: 11 }}>{v ?? "-"}</code> },
    { title: "错误", dataIndex: "errorMsg", ellipsis: true },
  ];

  return (
    <Drawer
      title={`服务详情 · ${service?.name ?? ""}`}
      open={service != null}
      onClose={onClose}
      width={720}
      destroyOnClose
    >
      {service && (
        <>
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="编码">{service.code}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <StatusTag status={service.status} label={service.status === "online" ? "上线" : "暂停"} />
            </Descriptions.Item>
            <Descriptions.Item label="当前版本">{service.currentVersion ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="绑定流程">{service.flowId}</Descriptions.Item>
            <Descriptions.Item label="说明" span={2}>
              {service.description ?? "-"}
            </Descriptions.Item>
          </Descriptions>

          {tab === "callLogs" && (
            <Space size={24} style={{ marginBottom: 16 }}>
              <Statistic title="近页调用" value={totalCount} />
              <Statistic title="近页成功率" value={totalCount ? `${Math.round((successCount / totalCount) * 100)}%` : "-"} />
              <Statistic title="近页平均耗时" value={avgLatency ? `${avgLatency} ms` : "-"} />
            </Space>
          )}

          <Tabs
            activeKey={tab}
            onChange={(k) => setTab(k as typeof tab)}
            items={[
              {
                key: "callLogs",
                label: (
                  <span>
                    <PlayCircleOutlined /> 调用日志
                  </span>
                ),
                children: (
                  <Table<PubCallLog>
                    rowKey="id"
                    size="small"
                    dataSource={logs?.records ?? []}
                    columns={logColumns}
                    locale={{ emptyText: <EmptyState description="暂无调用记录" /> }}
                    pagination={{
                      current: logPage,
                      pageSize: 10,
                      total: logs?.total ?? 0,
                      size: "small",
                      onChange: setLogPage,
                    }}
                  />
                ),
              },
              {
                key: "versions",
                label: "版本快照",
                children: (
                  <Table<PubVersion>
                    rowKey="id"
                    size="small"
                    dataSource={versions ?? []}
                    locale={{ emptyText: <EmptyState description="暂无版本" /> }}
                    pagination={false}
                    columns={[
                      { title: "版本", dataIndex: "version", width: 90 },
                      { title: "变更说明", dataIndex: "changelog", ellipsis: true },
                      { title: "发布人", dataIndex: "publishedBy", width: 100 },
                      { title: "发布时间", dataIndex: "publishedAt", width: 170 },
                    ]}
                  />
                ),
              },
              {
                key: "credentials",
                label: (
                  <span>
                    <KeyOutlined /> 凭证
                  </span>
                ),
                children: (
                  <Table<PubCredential>
                    rowKey="id"
                    size="small"
                    dataSource={credentials ?? []}
                    locale={{ emptyText: <EmptyState description="暂无凭证" /> }}
                    pagination={false}
                    columns={[
                      { title: "AccessKey", dataIndex: "accessKey", render: (v) => <code style={{ fontSize: 11 }}>{v}</code> },
                      { title: "SecretKey", dataIndex: "secretKey" },
                      {
                        title: "状态",
                        dataIndex: "status",
                        width: 90,
                        render: (s) => <StatusTag status={s} />,
                      },
                      { title: "过期时间", dataIndex: "expireTime", width: 170 },
                    ]}
                  />
                ),
              },
            ]}
          />
        </>
      )}
    </Drawer>
  );
}