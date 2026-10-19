import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Auth } from "@hwc/shared-auth";
import { EmptyState, Panel, StatusTag } from "@hwc/shared-ui";
import { ADMIN_PERM } from "@hwc/shared-types";
import type {
  DevAlarmRule,
  DevDowntimeCost,
  DevInfo,
  DevMetric,
  DevMetricThreshold,
  DevSparePart,
  DevType,
} from "@hwc/shared-types";
import * as deviceApi from "../../api/device";
import { genCode } from "../../utils/codegen";

/** 设备配置区：类型型号 / 台账 / 指标阈值 / 告警规则 / 备件 / 停机损失 分 Tab 管理 */
export default function DevicePage() {
  return (
    <Tabs
      defaultActiveKey="types"
      items={[
        { key: "types", label: "类型与型号", children: <TypeModelTab /> },
        { key: "infos", label: "设备台账", children: <DeviceTab /> },
        { key: "metrics", label: "指标与阈值", children: <MetricTab /> },
        { key: "rules", label: "告警规则", children: <RuleTab /> },
        { key: "parts", label: "备件", children: <SparePartTab /> },
        { key: "costs", label: "停机损失", children: <DowntimeCostTab /> },
      ]}
    />
  );
}

/* ==================== 类型与型号 ==================== */

function TypeModelTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<DevType | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "types", page, keyword],
    queryFn: () => deviceApi.pageTypes({ current: page, size: 10, keyword: keyword || undefined }),
  });

  const save = useMutation({
    mutationFn: async (values: Partial<DevType>) => {
      if (editing) await deviceApi.updateType(editing.id, values);
      else await deviceApi.createType(values);
      },
    onSuccess: () => {
      message.success(editing ? "类型已更新" : "类型已创建");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "types"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deviceApi.deleteType(id),
    onSuccess: () => {
      message.success("类型已删除");
      qc.invalidateQueries({ queryKey: ["admin", "types"] });
    },
  });

  const columns: ColumnsType<DevType> = [
    { title: "编码", dataIndex: "code", width: 120 },
    { title: "类型名称", dataIndex: "name" },
    { title: "厂商", dataIndex: "vendor" },
    { title: "说明", dataIndex: "description", ellipsis: true },
    {
      title: "操作",
      width: 150,
      render: (_, record) => (
        <Space>
          <Auth code={ADMIN_PERM.DEVICE_TYPE_WRITE}>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditing(record);
                form.setFieldsValue(record);
                setOpen(true);
              }}
            >
              编辑
            </Button>
            <Popconfirm title="确认删除该设备类型？" onConfirm={() => remove.mutate(record.id)}>
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Auth>
        </Space>
      ),
    },
  ];

  return (
    <Panel
      title="设备类型"
      extra={
        <Space>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="按编码/名称搜索"
            style={{ width: 220 }}
            onPressEnter={(e) => {
              setKeyword((e.target as HTMLInputElement).value);
              setPage(1);
            }}
            onChange={(e) => !e.target.value && setKeyword("")}
          />
          <Auth code={ADMIN_PERM.DEVICE_TYPE_WRITE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                form.resetFields();
                form.setFieldsValue({ code: genCode("TYPE-") });
                setOpen(true);
              }}
            >
              新增类型
            </Button>
          </Auth>
        </Space>
      }
    >
      <Table<DevType>
        rowKey="id"
        size="middle"
        loading={isLoading}
        columns={columns}
        dataSource={data?.records ?? []}
        locale={{ emptyText: <EmptyState description="暂无设备类型，点击右上角「新增类型」创建" /> }}
        pagination={{
          current: page,
          pageSize: 10,
          total: data?.total ?? 0,
          showTotal: (t) => `共 ${t} 条`,
          onChange: setPage,
        }}
      />
      <Modal
        title={editing ? "编辑设备类型" : "新增设备类型"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="code" label="类型编码" rules={[{ required: true, message: "请输入类型编码" }]}>
            <Input placeholder="自动生成，可修改" />
          </Form.Item>
          <Form.Item name="name" label="类型名称" rules={[{ required: true, message: "请输入类型名称" }]}>
            <Input placeholder="如 数控主轴" />
          </Form.Item>
          <Form.Item name="vendor" label="厂商">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Panel>
  );
}

/* ==================== 设备台账 ==================== */

function DeviceTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DevInfo | null>(null);
  /** 表单中当前选中的设备类型 ID，用于级联加载可选型号 */
  const [modelTypeId, setModelTypeId] = useState<number | undefined>();
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "devices", page, keyword, status],
    queryFn: () =>
      deviceApi.pageDevices({ current: page, size: 10, keyword: keyword || undefined, status }),
  });

  const { data: types } = useQuery({
    queryKey: ["admin", "types", "all"],
    queryFn: () => deviceApi.pageTypes({ current: 1, size: 100 }),
  });

  const { data: models } = useQuery({
    queryKey: ["admin", "models", modelTypeId],
    queryFn: () => deviceApi.listModels(modelTypeId!),
    enabled: modelTypeId != null,
  });

  const save = useMutation({
    mutationFn: async (values: Partial<DevInfo>) => {
      if (editing) await deviceApi.updateDevice(editing.id, values);
      else await deviceApi.createDevice(values);
      },
    onSuccess: () => {
      message.success(editing ? "设备已更新" : "设备已创建");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "devices"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deviceApi.deleteDevice(id),
    onSuccess: () => {
      message.success("设备已删除");
      qc.invalidateQueries({ queryKey: ["admin", "devices"] });
    },
  });

  const typeMap = new Map((types?.records ?? []).map((t) => [t.id, t.name]));

  const columns: ColumnsType<DevInfo> = [
    { title: "编号", dataIndex: "code", width: 130 },
    { title: "名称", dataIndex: "name" },
    { title: "类型", dataIndex: "typeId", width: 120, render: (id) => typeMap.get(id) ?? "-" },
    { title: "产线", dataIndex: "lineName", width: 110 },
    { title: "位置", dataIndex: "location", width: 130, ellipsis: true },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (s) => <StatusTag status={s} />,
    },
    {
      title: "操作",
      width: 150,
      render: (_, record) => (
        <Auth code={ADMIN_PERM.DEVICE_INFO_WRITE}>
          <Space>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditing(record);
                form.setFieldsValue(record);
                setModelTypeId(record.typeId);
                setOpen(true);
              }}
            >
              编辑
            </Button>
            <Popconfirm title="确认删除该设备？" onConfirm={() => remove.mutate(record.id)}>
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </Auth>
      ),
    },
  ];

  return (
    <Panel
      title="设备台账"
      extra={
        <Space>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="按编号/名称搜索"
            style={{ width: 200 }}
            onPressEnter={(e) => {
              setKeyword((e.target as HTMLInputElement).value);
              setPage(1);
            }}
            onChange={(e) => !e.target.value && setKeyword("")}
          />
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 110 }}
            options={[
              { value: "normal", label: "正常" },
              { value: "warning", label: "预警" },
              { value: "fault", label: "故障" },
              { value: "offline", label: "离线" },
            ]}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
          <Auth code={ADMIN_PERM.DEVICE_INFO_WRITE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                form.resetFields();
                form.setFieldsValue({ code: genCode("DEV-") });
                setModelTypeId(undefined);
                setOpen(true);
              }}
            >
              新增设备
            </Button>
          </Auth>
        </Space>
      }
    >
      <Table<DevInfo>
        rowKey="id"
        size="middle"
        loading={isLoading}
        columns={columns}
        dataSource={data?.records ?? []}
        locale={{ emptyText: <EmptyState description="暂无设备台账" /> }}
        pagination={{
          current: page,
          pageSize: 10,
          total: data?.total ?? 0,
          showTotal: (t) => `共 ${t} 条`,
          onChange: setPage,
        }}
      />
      <Modal
        title={editing ? "编辑设备" : "新增设备"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item name="code" label="设备编号" rules={[{ required: true, message: "请输入设备编号" }]} style={{ flex: 1 }}>
              <Input placeholder="自动生成，可修改" />
            </Form.Item>
            <Form.Item name="name" label="设备名称" rules={[{ required: true, message: "请输入设备名称" }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item name="typeId" label="设备类型" rules={[{ required: true, message: "请选择设备类型" }]} style={{ flex: 1 }}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="选择类型"
                options={(types?.records ?? []).map((t) => ({ value: t.id, label: `${t.code} · ${t.name}` }))}
                onChange={(v) => {
                  setModelTypeId(v);
                  form.setFieldValue("modelId", undefined);
                }}
              />
            </Form.Item>
            <Form.Item name="modelId" label="型号" style={{ flex: 1 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                disabled={modelTypeId == null}
                placeholder={modelTypeId == null ? "请先选择设备类型" : "选择型号（可选）"}
                options={(models ?? []).map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }))}
              />
            </Form.Item>
          </Space>
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item name="lineName" label="产线" style={{ flex: 1 }}>
              <Input placeholder="如 一号产线" />
            </Form.Item>
            <Form.Item name="location" label="安装位置" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="status" label="运行状态" initialValue="normal">
            <Select
              options={[
                { value: "normal", label: "正常" },
                { value: "warning", label: "预警" },
                { value: "fault", label: "故障" },
                { value: "offline", label: "离线" },
              ]}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Panel>
  );
}

/* ==================== 指标与阈值 ==================== */

function MetricTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DevMetric | null>(null);
  const [thresholdMetric, setThresholdMetric] = useState<DevMetric | null>(null);
  const [form] = Form.useForm();
  const [thForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "metrics", page, keyword],
    queryFn: () => deviceApi.pageMetrics({ current: page, size: 10, keyword: keyword || undefined }),
  });

  const { data: types } = useQuery({
    queryKey: ["admin", "types", "all"],
    queryFn: () => deviceApi.pageTypes({ current: 1, size: 100 }),
  });

  const { data: threshold, isLoading: thLoading } = useQuery({
    queryKey: ["admin", "threshold", thresholdMetric?.id],
    queryFn: () => deviceApi.getThreshold(thresholdMetric!.id),
    enabled: thresholdMetric != null,
  });

  const save = useMutation({
    mutationFn: async (values: Partial<DevMetric>) => {
      if (editing) await deviceApi.updateMetric(editing.id, values);
      else await deviceApi.createMetric(values);
      },
    onSuccess: () => {
      message.success(editing ? "指标已更新" : "指标已创建");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "metrics"] });
    },
  });

  const saveThreshold = useMutation({
    mutationFn: (values: Partial<DevMetricThreshold>) =>
      deviceApi.saveThreshold(thresholdMetric!.id, values),
    onSuccess: () => {
      message.success("阈值已保存（预警区间须位于故障区间之内）");
      qc.invalidateQueries({ queryKey: ["admin", "threshold", thresholdMetric?.id] });
    },
  });

  const columns: ColumnsType<DevMetric> = [
    { title: "指标编码", dataIndex: "code", width: 130 },
    { title: "指标名称", dataIndex: "name" },
    { title: "单位", dataIndex: "unit", width: 80 },
    { title: "采样间隔(秒)", dataIndex: "sampleInterval", width: 110 },
    {
      title: "操作",
      width: 200,
      render: (_, record) => (
        <Auth code={ADMIN_PERM.DEVICE_METRIC_WRITE}>
          <Space>
            <Button type="link" size="small" onClick={() => setThresholdMetric(record)}>
              阈值配置
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditing(record);
                form.setFieldsValue(record);
                setOpen(true);
              }}
            >
              编辑
            </Button>
          </Space>
        </Auth>
      ),
    },
  ];

  return (
    <Panel
      title="指标定义与阈值"
      subtitle="阈值用于看板异常判定与告警规则"
      extra={
        <Space>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="按编码/名称搜索"
            style={{ width: 200 }}
            onPressEnter={(e) => {
              setKeyword((e.target as HTMLInputElement).value);
              setPage(1);
            }}
            onChange={(e) => !e.target.value && setKeyword("")}
          />
          <Auth code={ADMIN_PERM.DEVICE_METRIC_WRITE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                form.resetFields();
                form.setFieldsValue({ code: genCode("MT-") });
                setOpen(true);
              }}
            >
              新增指标
            </Button>
          </Auth>
        </Space>
      }
    >
      <Table<DevMetric>
        rowKey="id"
        size="middle"
        loading={isLoading}
        columns={columns}
        dataSource={data?.records ?? []}
        locale={{ emptyText: <EmptyState description="暂无指标定义" /> }}
        pagination={{
          current: page,
          pageSize: 10,
          total: data?.total ?? 0,
          showTotal: (t) => `共 ${t} 条`,
          onChange: setPage,
        }}
      />

      <Modal
        title={editing ? "编辑指标" : "新增指标"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="typeId" label="所属设备类型" rules={[{ required: true, message: "请选择设备类型" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择设备类型"
              options={(types?.records ?? []).map((t) => ({ value: t.id, label: `${t.code} · ${t.name}` }))}
            />
          </Form.Item>
          <Form.Item name="code" label="指标编码" rules={[{ required: true, message: "请输入指标编码" }]}>
            <Input placeholder="自动生成，可修改" />
          </Form.Item>
          <Form.Item name="name" label="指标名称" rules={[{ required: true, message: "请输入指标名称" }]}>
            <Input placeholder="如 主轴温度" />
          </Form.Item>
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item name="unit" label="单位" style={{ flex: 1 }}>
              <Input placeholder="℃ / mm/s / A" />
            </Form.Item>
            <Form.Item name="sampleInterval" label="采样间隔(秒)" initialValue={60} style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} min={1} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={`阈值配置 · ${thresholdMetric?.name ?? ""}`}
        open={thresholdMetric != null}
        onCancel={() => setThresholdMetric(null)}
        onOk={() => thForm.submit()}
        confirmLoading={saveThreshold.isPending}
        destroyOnClose
        width={560}
      >
        {thLoading ? null : (
          <Form
            form={thForm}
            layout="vertical"
            initialValues={
              threshold ?? {
                normalMin: 0,
                normalMax: 100,
                warnMin: undefined,
                warnMax: undefined,
                faultMin: undefined,
                faultMax: undefined,
              }
            }
            onFinish={(v) => saveThreshold.mutate(v)}
          >
            <Space size={12} style={{ display: "flex", marginBottom: 4 }}>
              <Tag color="green">正常区间</Tag>
              <Form.Item name="normalMin" noStyle>
                <InputNumber placeholder="正常下限" style={{ width: 130 }} />
              </Form.Item>
              <span>~</span>
              <Form.Item name="normalMax" noStyle>
                <InputNumber placeholder="正常上限" style={{ width: 130 }} />
              </Form.Item>
            </Space>
            <Space size={12} style={{ display: "flex", marginBottom: 4 }}>
              <Tag color="orange">预警区间</Tag>
              <Form.Item name="warnMin" noStyle>
                <InputNumber placeholder="预警下限" style={{ width: 130 }} />
              </Form.Item>
              <span>~</span>
              <Form.Item name="warnMax" noStyle>
                <InputNumber placeholder="预警上限" style={{ width: 130 }} />
              </Form.Item>
            </Space>
            <Space size={12} style={{ display: "flex", marginBottom: 12 }}>
              <Tag color="red">故障区间</Tag>
              <Form.Item name="faultMin" noStyle>
                <InputNumber placeholder="故障下限" style={{ width: 130 }} />
              </Form.Item>
              <span>~</span>
              <Form.Item name="faultMax" noStyle>
                <InputNumber placeholder="故障上限" style={{ width: 130 }} />
              </Form.Item>
            </Space>
            <Form.Item name="remark" label="备注">
              <Input.TextArea rows={2} placeholder="阈值依据（手册章节等）" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </Panel>
  );
}

/* ==================== 告警规则 ==================== */

function RuleTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [metricId, setMetricId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DevAlarmRule | null>(null);
  const [form] = Form.useForm();

  const { data: metrics } = useQuery({
    queryKey: ["admin", "metrics", "all"],
    queryFn: () => deviceApi.pageMetrics({ current: 1, size: 100 }),
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ["admin", "alarm-rules", metricId],
    queryFn: () => deviceApi.listAlarmRules(metricId!),
    enabled: metricId != null,
  });


  const save = useMutation({
    mutationFn: async (values: Partial<DevAlarmRule>) => {
      if (editing) await deviceApi.updateAlarmRule(editing.id, values);
      else await deviceApi.createAlarmRule(values);
      },
    onSuccess: () => {
      message.success("告警规则已保存");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "alarm-rules", metricId] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deviceApi.deleteAlarmRule(id),
    onSuccess: () => {
      message.success("规则已删除");
      qc.invalidateQueries({ queryKey: ["admin", "alarm-rules", metricId] });
    },
  });

  const columns: ColumnsType<DevAlarmRule> = [
    { title: "等级", dataIndex: "level", width: 80, render: (l) => <StatusTag status={l === "fault" ? "fault" : "warning"} label={l === "fault" ? "故障" : l === "warn" ? "预警" : "信息"} /> },
    { title: "触发条件类型", dataIndex: "conditionType", width: 130 },
    { title: "阈值表达式", dataIndex: "thresholdExpr", ellipsis: true },
    { title: "持续次数", dataIndex: "durationCount", width: 90 },
    {
      title: "启用",
      dataIndex: "enabled",
      width: 80,
      render: (v) => (v === 1 ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: "操作",
      width: 150,
      render: (_, record) => (
        <Auth code={ADMIN_PERM.DEVICE_ALARM_RULE_WRITE}>
          <Space>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditing(record);
                form.setFieldsValue(record);
                setOpen(true);
              }}
            >
              编辑
            </Button>
            <Popconfirm title="确认删除该规则？" onConfirm={() => remove.mutate(record.id)}>
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </Auth>
      ),
    },
  ];

  return (
    <Panel
      title="告警规则"
      subtitle="按指标配置触发条件与等级"
      extra={
        <Space>
          <Select
            placeholder="选择指标"
            style={{ width: 220 }}
            showSearch
            optionFilterProp="label"
            options={(metrics?.records ?? []).map((m) => ({ value: m.id, label: `${m.name}（${m.code}）` }))}
            onChange={(v) => setMetricId(v)}
          />
          <Auth code={ADMIN_PERM.DEVICE_ALARM_RULE_WRITE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={metricId == null}
              onClick={() => {
                setEditing(null);
                form.resetFields();
                form.setFieldValue("metricId", metricId);
                setOpen(true);
              }}
            >
              新增规则
            </Button>
          </Auth>
        </Space>
      }
    >
      {metricId == null ? (
        <EmptyState title="请先选择指标" description="在右上角选择要配置告警规则的指标" />
      ) : (
        <Table<DevAlarmRule>
          rowKey="id"
          size="middle"
          loading={isLoading}
          columns={columns}
          dataSource={rules ?? []}
          locale={{ emptyText: <EmptyState description="该指标暂无告警规则" /> }}
          pagination={false}
        />
      )}
      <Modal
        title={editing ? "编辑告警规则" : "新增告警规则"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="metricId" label="指标 ID" rules={[{ required: true, message: "请输入指标 ID" }]}>
            <InputNumber style={{ width: "100%" }} min={1} disabled />
          </Form.Item>
          <Form.Item name="level" label="等级" initialValue="warn" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "info", label: "信息" },
                { value: "warn", label: "预警" },
                { value: "fault", label: "故障" },
              ]}
            />
          </Form.Item>
          <Form.Item name="conditionType" label="触发条件类型" initialValue="threshold" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "threshold", label: "越限触发" },
                { value: "sustained", label: "持续越限" },
                { value: "fluctuation", label: "异常波动" },
              ]}
            />
          </Form.Item>
          <Form.Item name="thresholdExpr" label="阈值表达式" rules={[{ required: true, message: "请输入阈值表达式" }]}>
            <Input placeholder="如 value > warnMax 持续 3 次" />
          </Form.Item>
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item name="durationCount" label="持续次数" initialValue={1} style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} min={1} />
            </Form.Item>
            <Form.Item name="enabled" label="是否启用" initialValue={1} valuePropName="checked" style={{ flex: 1 }}>
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Panel>
  );
}

/* ==================== 备件 ==================== */

function SparePartTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DevSparePart | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "spare-parts", page, keyword],
    queryFn: () => deviceApi.pageSpareParts({ current: page, size: 10, keyword: keyword || undefined }),
  });

  const save = useMutation({
    mutationFn: async (values: Partial<DevSparePart>) => {
      if (editing) await deviceApi.updateSparePart(editing.id, values);
      else await deviceApi.createSparePart(values);
      },
    onSuccess: () => {
      message.success("备件已保存");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "spare-parts"] });
    },
  });

  const columns: ColumnsType<DevSparePart> = [
    { title: "编码", dataIndex: "code", width: 120 },
    { title: "名称", dataIndex: "name" },
    { title: "型号", dataIndex: "model", width: 120 },
    {
      title: "库存 / 安全库存",
      width: 150,
      render: (_, r) => (
        <span>
          <b style={{ color: r.stock <= r.safetyStock ? "#C2410C" : undefined }}>{r.stock}</b>
          <span style={{ color: "#64748B" }}> / {r.safetyStock}</span>
        </span>
      ),
    },
    { title: "单价(元)", dataIndex: "unitPrice", width: 100, render: (v) => v ?? "-" },
    {
      title: "状态",
      dataIndex: "status",
      width: 80,
      render: (v) => (v === 1 ? <Tag color="green">在用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: "操作",
      width: 150,
      render: (_, record) => (
        <Auth code={ADMIN_PERM.DEVICE_SPARE_PART_WRITE}>
          <Space>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditing(record);
                form.setFieldsValue(record);
                setOpen(true);
              }}
            >
              编辑
            </Button>
          </Space>
        </Auth>
      ),
    },
  ];

  return (
    <Panel
      title="备件台账"
      subtitle="库存低于安全库存时橙色提示"
      extra={
        <Space>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="按编码/名称搜索"
            style={{ width: 200 }}
            onPressEnter={(e) => {
              setKeyword((e.target as HTMLInputElement).value);
              setPage(1);
            }}
            onChange={(e) => !e.target.value && setKeyword("")}
          />
          <Auth code={ADMIN_PERM.DEVICE_SPARE_PART_WRITE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                form.resetFields();
                form.setFieldsValue({ code: genCode("SP-") });
                setOpen(true);
              }}
            >
              新增备件
            </Button>
          </Auth>
        </Space>
      }
    >
      <Table<DevSparePart>
        rowKey="id"
        size="middle"
        loading={isLoading}
        columns={columns}
        dataSource={data?.records ?? []}
        locale={{ emptyText: <EmptyState description="暂无备件记录" /> }}
        pagination={{
          current: page,
          pageSize: 10,
          total: data?.total ?? 0,
          showTotal: (t) => `共 ${t} 条`,
          onChange: setPage,
        }}
      />
      <Modal
        title={editing ? "编辑备件" : "新增备件"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item name="code" label="编码" rules={[{ required: true, message: "请输入编码" }]} style={{ flex: 1 }}>
              <Input placeholder="自动生成，可修改" />
            </Form.Item>
            <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item name="model" label="型号" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="unit" label="单位" initialValue="件" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item name="stock" label="库存" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} min={0} />
            </Form.Item>
            <Form.Item name="safetyStock" label="安全库存" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} min={0} />
            </Form.Item>
          </Space>
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item name="unitPrice" label="单价(元)" style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} min={0} step={0.01} />
            </Form.Item>
            <Form.Item name="status" label="状态" initialValue={1} style={{ flex: 1 }}>
              <Select
                options={[
                  { value: 1, label: "在用" },
                  { value: 0, label: "停用" },
                ]}
              />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Panel>
  );
}

/* ==================== 停机损失 ==================== */

function DowntimeCostTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DevDowntimeCost | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "downtime-costs"],
    queryFn: () => deviceApi.listDowntimeCosts(),
  });

  const { data: devices } = useQuery({
    queryKey: ["admin", "devices", "all"],
    queryFn: () => deviceApi.pageDevices({ current: 1, size: 100 }),
  });

  const deviceMap = new Map((devices?.records ?? []).map((d) => [d.id, d]));

  const save = useMutation({
    mutationFn: async (values: Partial<DevDowntimeCost>) => {
      if (editing) await deviceApi.updateDowntimeCost(editing.id, values);
      else await deviceApi.createDowntimeCost(values);
      },
    onSuccess: () => {
      message.success("停机损失标准已保存");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "downtime-costs"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deviceApi.deleteDowntimeCost(id),
    onSuccess: () => {
      message.success("已删除");
      qc.invalidateQueries({ queryKey: ["admin", "downtime-costs"] });
    },
  });

  const columns: ColumnsType<DevDowntimeCost> = [
    { title: "核算维度", dataIndex: "scopeType", width: 110, render: (v) => (v === "device" ? "按设备" : "按产线") },
    {
      title: "对象",
      width: 200,
      render: (_, r) => (r.scopeType === "device" ? deviceMap.get(r.deviceId)?.name ?? `设备 ${r.deviceId}` : r.lineName),
    },
    { title: "每小时损失(元)", dataIndex: "costPerHour", width: 140, render: (v) => <b>{v}</b> },
    { title: "备注", dataIndex: "remark", ellipsis: true },
    {
      title: "操作",
      width: 150,
      render: (_, record) => (
        <Auth code={ADMIN_PERM.DEVICE_DOWNTIME_COST_WRITE}>
          <Space>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditing(record);
                form.setFieldsValue(record);
                setOpen(true);
              }}
            >
              编辑
            </Button>
            <Popconfirm title="确认删除？" onConfirm={() => remove.mutate(record.id)}>
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </Auth>
      ),
    },
  ];

  return (
    <Panel
      title="停机损失标准"
      subtitle="用于工单停机损失测算"
      extra={
        <Auth code={ADMIN_PERM.DEVICE_DOWNTIME_COST_WRITE}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            新增标准
          </Button>
        </Auth>
      }
    >
      <Table<DevDowntimeCost>
        rowKey="id"
        size="middle"
        loading={isLoading}
        columns={columns}
        dataSource={data ?? []}
        locale={{ emptyText: <EmptyState description="暂无停机损失标准" /> }}
        pagination={{
          pageSize: 10,
          showTotal: (t) => `共 ${t} 条`,
        }}
      />
      <Modal
        title={editing ? "编辑停机损失" : "新增停机损失"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="scopeType" label="核算维度" initialValue="device" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "device", label: "按设备" },
                { value: "line", label: "按产线" },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.scopeType !== c.scopeType}>
            {({ getFieldValue }) =>
              getFieldValue("scopeType") === "device" ? (
                <Form.Item name="deviceId" label="设备" rules={[{ required: true, message: "请选择设备" }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={(devices?.records ?? []).map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` }))}
                  />
                </Form.Item>
              ) : (
                <Form.Item name="lineName" label="产线名称" rules={[{ required: true, message: "请输入产线名称" }]}>
                  <Input placeholder="如 一号产线" />
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item name="costPerHour" label="每小时损失(元)" rules={[{ required: true, message: "请输入每小时损失" }]}>
            <InputNumber style={{ width: "100%" }} min={0} step={100} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Panel>
  );
}