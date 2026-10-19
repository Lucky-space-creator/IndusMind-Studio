import {
  CloudDownloadOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { App, Button, Drawer, Descriptions, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Auth } from "@hwc/shared-auth";
import { EmptyState, Panel, RiskTag, StatusTag, ThresholdLineChart } from "@hwc/shared-ui";
import { ADMIN_PERM } from "@hwc/shared-types";
import type { DataAnomaly, DataDataset, FaultInjection } from "@hwc/shared-types";
import * as dataApi from "../../api/data";
import * as deviceApi from "../../api/device";
import { Upload as AntUpload } from "antd";

const DS_STATUS: Record<string, string> = {
  raw: "原始",
  cleaned: "已清洗",
  analyzed: "已分析",
  error: "失败",
};

/** 数据管理区：数据集列表 + 导入/模拟生成 + 清洗对照 + 异常清单 */
export default function DataPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [sourceType, setSourceType] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [detail, setDetail] = useState<DataDataset | null>(null);
  const [importForm] = Form.useForm();
  const [simForm] = Form.useForm();

  const { data: datasets, isLoading } = useQuery({
    queryKey: ["admin", "datasets", page, keyword, sourceType, status],
    queryFn: () =>
      dataApi.pageDatasets({
        current: page,
        size: 10,
        keyword: keyword || undefined,
        sourceType,
        status,
      }),
  });

  const { data: devices } = useQuery({
    queryKey: ["admin", "devices", "for-data"],
    queryFn: () => deviceApi.pageDevices({ current: 1, size: 200 }),
  });
  const deviceMap = new Map((devices?.records ?? []).map((d) => [d.id, d]));

  const importMutation = useMutation({
    mutationFn: async () => {
      const values = await importForm.validateFields();
      const file = values.file?.[0]?.originFileObj;
      if (!file) throw new Error("请选择 CSV 文件");
      return dataApi.importDataset(file, values.deviceId, values.name);
    },
    onSuccess: () => {
      message.success("数据集导入成功");
      setImportOpen(false);
      importForm.resetFields();
      qc.invalidateQueries({ queryKey: ["admin", "datasets"] });
    },
  });

  const simulate = useMutation({
    mutationFn: async (values: { deviceId: number; name?: string; hours: number; injectFault: boolean }) => {
      let faultInjections: FaultInjection[] = [];
      if (values.injectFault) {
        const device = await deviceApi.getDevice(values.deviceId);
        const metrics = await deviceApi.pageMetrics({ typeId: device.typeId, current: 1, size: 50 });
        faultInjections = (metrics?.records ?? []).slice(0, 2).map((m, i) => ({
          metricId: m.id,
          fromHour: Math.round(values.hours * (0.3 + i * 0.2)),
          toHour: Math.round(values.hours * (0.5 + i * 0.2)),
          severity: i === 0 ? "warn" : "fault",
        }));
      }
      return dataApi.simulateDataset({
        deviceId: values.deviceId,
        name: values.name,
        hours: values.hours,
        faultInjections,
      });
    },
    onSuccess: (ds) => {
      message.success(`模拟数据集已生成${ds.anomalyCount ? `，检出 ${ds.anomalyCount} 项异常` : ""}`);
      setSimOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "datasets"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => dataApi.deleteDataset(id),
    onSuccess: () => {
      message.success("数据集已删除");
      qc.invalidateQueries({ queryKey: ["admin", "datasets"] });
    },
  });

  const columns: ColumnsType<DataDataset> = [
    { title: "数据集", dataIndex: "name", ellipsis: true },
    {
      title: "设备",
      dataIndex: "deviceId",
      width: 150,
      render: (id) => {
        const d = deviceMap.get(id);
        return d ? `${d.code} · ${d.name}` : `设备 ${id}`;
      },
    },
    {
      title: "来源",
      dataIndex: "sourceType",
      width: 80,
      render: (v) => (v === "import" ? <Tag>导入</Tag> : <Tag color="cyan">模拟</Tag>),
    },
    { title: "记录数", dataIndex: "recordCount", width: 90, render: (v) => v?.toLocaleString() },
    { title: "异常数", dataIndex: "anomalyCount", width: 80, render: (v) => (v ? <b style={{ color: "#C2410C" }}>{v}</b> : 0) },
    { title: "状态", dataIndex: "status", width: 90, render: (s) => <StatusTag status={s} label={DS_STATUS[s] ?? s} /> },
    {
      title: "时间范围",
      width: 190,
      render: (_, r) => (
        <span style={{ fontSize: 12, color: "#64748B" }}>
          {r.timeStart ?? "-"} ~ {r.timeEnd ?? "-"}
        </span>
      ),
    },
    {
      title: "操作",
      width: 200,
      render: (_, record) => (
        <Space size={0} wrap>
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => setDetail(record)}>
            详情
          </Button>
          <Auth code={ADMIN_PERM.DATA_DATASET_DELETE}>
            <Popconfirm title="删除数据集将级联删除清洗与异常数据，确认？" onConfirm={() => remove.mutate(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Auth>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Panel
        title="设备数据集"
        subtitle="支持 CSV 导入与基于阈值注入故障的模拟生成"
        extra={
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="按名称搜索"
              style={{ width: 180 }}
              onPressEnter={(e) => {
                setKeyword((e.target as HTMLInputElement).value);
                setPage(1);
              }}
              onChange={(e) => !e.target.value && setKeyword("")}
            />
            <Select
              allowClear
              placeholder="来源"
              style={{ width: 100 }}
              options={[
                { value: "import", label: "导入" },
                { value: "simulate", label: "模拟" },
              ]}
              value={sourceType}
              onChange={(v) => {
                setSourceType(v);
                setPage(1);
              }}
            />
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 100 }}
              options={Object.entries(DS_STATUS).map(([v, l]) => ({ value: v, label: l }))}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            />
            <Auth code={ADMIN_PERM.DATA_DATASET_WRITE}>
              <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                导入 CSV
              </Button>
              <Button type="primary" icon={<ExperimentOutlined />} onClick={() => setSimOpen(true)}>
                模拟生成
              </Button>
            </Auth>
          </Space>
        }
      >
        <Table<DataDataset>
          rowKey="id"
          size="middle"
          loading={isLoading}
          columns={columns}
          dataSource={datasets?.records ?? []}
          locale={{ emptyText: <EmptyState description="暂无数据集，可通过「导入 CSV」或「模拟生成」创建" /> }}
          pagination={{
            current: page,
            pageSize: 10,
            total: datasets?.total ?? 0,
            showTotal: (t) => `共 ${t} 条`,
            onChange: setPage,
          }}
        />
      </Panel>

      {/* 导入 CSV */}
      <Modal
        title="导入 CSV 数据集"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        onOk={() => importMutation.mutate()}
        confirmLoading={importMutation.isPending}
        destroyOnClose
      >
        <Form form={importForm} layout="vertical">
          <Form.Item name="deviceId" label="设备" rules={[{ required: true, message: "请选择设备" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={(devices?.records ?? []).map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` }))}
            />
          </Form.Item>
          <Form.Item name="name" label="数据集名称（留空自动命名）">
            <Input />
          </Form.Item>
          <Form.Item
            name="file"
            label="CSV 文件（列：collectTime,metricId,metricValue）"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
            rules={[{ required: true, message: "请选择 CSV 文件" }]}
          >
            <AntUpload beforeUpload={() => false} maxCount={1} accept=".csv">
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </AntUpload>
          </Form.Item>
        </Form>
      </Modal>

      {/* 模拟生成 */}
      <Modal
        title="模拟生成数据集"
        open={simOpen}
        onCancel={() => setSimOpen(false)}
        onOk={() => simForm.submit()}
        confirmLoading={simulate.isPending}
        destroyOnClose
      >
        <Form
          form={simForm}
          layout="vertical"
          initialValues={{ hours: 24, injectFault: true }}
          onFinish={(v) => simulate.mutate(v)}
        >
          <Form.Item name="deviceId" label="设备" rules={[{ required: true, message: "请选择设备" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={(devices?.records ?? []).map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` }))}
            />
          </Form.Item>
          <Form.Item name="name" label="数据集名称（留空自动命名）">
            <Input placeholder="如 注入故障-主轴温度异常" />
          </Form.Item>
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item name="hours" label="模拟时长（小时）" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} min={1} max={720} />
            </Form.Item>
            <Form.Item name="injectFault" label="注入故障样本" valuePropName="checked" style={{ flex: 1 }}>
              <Switch checkedChildren="注入" unCheckedChildren="不注入" />
            </Form.Item>
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            模拟数据将按指标阈值自动清洗并提取异常，生成后即可在看板查看设备健康快照。
          </Typography.Text>
        </Form>
      </Modal>

      {/* 数据集详情 */}
      <DatasetDetail dataset={detail} onClose={() => setDetail(null)} />
    </>
  );
}

/* ==================== 数据集详情抽屉（清洗对照 + 异常清单） ==================== */

function DatasetDetail({ dataset, onClose }: { dataset: DataDataset | null; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"records" | "clean" | "anomalies">("records");

  const { data: records } = useQuery({
    queryKey: ["admin", "ds-records", dataset?.id],
    queryFn: () => dataApi.pageRecords(dataset!.id, { current: 1, size: 200 }),
    enabled: dataset != null && tab === "records",
  });

  const { data: cleaned, refetch: refetchCleaned } = useQuery({
    queryKey: ["admin", "ds-cleaned", dataset?.id],
    queryFn: () => dataApi.pageCleaned(dataset!.id, { current: 1, size: 200 }),
    enabled: dataset != null && tab === "clean",
  });

  const { data: anomalies, refetch: refetchAnomalies } = useQuery({
    queryKey: ["admin", "ds-anomalies", dataset?.id],
    queryFn: () => dataApi.pageAnomalies(dataset!.id, { current: 1, size: 50 }),
    enabled: dataset != null && tab === "anomalies",
  });

  const clean = useMutation({
    mutationFn: () => dataApi.cleanDataset(dataset!.id),
    onSuccess: () => {
      message.success("清洗完成（缺失填补 / 越界坏点剔除 / 去重）");
      refetchCleaned();
      qc.invalidateQueries({ queryKey: ["admin", "datasets"] });
    },
  });

  const extract = useMutation({
    mutationFn: () => dataApi.extractAnomalies(dataset!.id),
    onSuccess: () => {
      message.success("异常提取完成（三级区间 + 持续/波动规则），看板快照已刷新");
      refetchAnomalies();
      qc.invalidateQueries({ queryKey: ["admin", "datasets"] });
    },
  });

  const exportAnomalies = useMutation({
    mutationFn: () => dataApi.exportAnomalies(dataset!.id),
    onSuccess: () => message.success("异常清单已导出下载"),
  });

  /** 清洗前后对照曲线 */
  const chartSeries = (() => {
    if (tab !== "clean" || !cleaned?.records?.length) return [];
    const raw = cleaned.records.map((r) => ({ x: new Date(r.collectTime).getTime(), y: Number(r.rawValue) }));
    const cleanedPts = cleaned.records.map((r) => ({
      x: new Date(r.collectTime).getTime(),
      y: Number(r.cleanedValue),
    }));
    return [
      { name: "清洗前", points: raw, color: "#94A3B8" },
      { name: "清洗后", points: cleanedPts, color: "#0E6E8C" },
    ];
  })();

  return (
    <Drawer
      title={`数据集详情 · ${dataset?.name ?? ""}`}
      open={dataset != null}
      onClose={onClose}
      width={760}
      destroyOnClose
    >
      {dataset && (
        <>
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="设备">{dataset.deviceId}</Descriptions.Item>
            <Descriptions.Item label="来源">
              {dataset.sourceType === "import" ? "导入" : "模拟"}
            </Descriptions.Item>
            <Descriptions.Item label="记录数">{dataset.recordCount?.toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="已清洗">{dataset.cleanedCount?.toLocaleString() ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="时间范围" span={2}>
              {dataset.timeStart ?? "-"} ~ {dataset.timeEnd ?? "-"}
            </Descriptions.Item>
          </Descriptions>

          <Space style={{ marginBottom: 12 }}>
            <Button
              type={tab === "records" ? "primary" : "default"}
              size="small"
              onClick={() => setTab("records")}
            >
              原始记录
            </Button>
            <Button type={tab === "clean" ? "primary" : "default"} size="small" onClick={() => setTab("clean")}>
              清洗对照
            </Button>
            <Button type={tab === "anomalies" ? "primary" : "default"} size="small" onClick={() => setTab("anomalies")}>
              异常清单
            </Button>
            <Auth code={ADMIN_PERM.DATA_CLEAN_WRITE}>
              <Button size="small" icon={<PlayCircleOutlined />} loading={clean.isPending} onClick={() => clean.mutate()}>
                执行清洗
              </Button>
            </Auth>
            <Auth code={ADMIN_PERM.DATA_CLEAN_WRITE}>
              <Button size="small" icon={<Thunderbolt />} loading={extract.isPending} onClick={() => extract.mutate()}>
                提取异常
              </Button>
            </Auth>
            <Auth code={ADMIN_PERM.DATA_ANOMALY_EXPORT}>
              <Button
                size="small"
                icon={<CloudDownloadOutlined />}
                loading={exportAnomalies.isPending}
                onClick={() => exportAnomalies.mutate()}
              >
                导出异常
              </Button>
            </Auth>
          </Space>

          {tab === "records" && (
            <Table
              rowKey="id"
              size="small"
              dataSource={records?.records ?? []}
              locale={{ emptyText: <EmptyState description="暂无原始记录" /> }}
              pagination={{ pageSize: 10, size: "small" }}
              columns={[
                { title: "采集时间", dataIndex: "collectTime", width: 170 },
                { title: "指标 ID", dataIndex: "metricId", width: 80 },
                { title: "数值", dataIndex: "metricValue" },
              ]}
            />
          )}

          {tab === "clean" &&
            (chartSeries.length ? (
              <Panel title="清洗前后曲线对照" flat>
                <ThresholdLineChart series={chartSeries} height={260} />
              </Panel>
            ) : (
              <EmptyState
                title="暂无清洗数据"
                description="点击「执行清洗」后可对照查看清洗前后的曲线差异（灰色=清洗前，蓝色=清洗后）"
              />
            ))}

          {tab === "anomalies" && (
            <Table<DataAnomaly>
              rowKey="id"
              size="small"
              dataSource={anomalies?.records ?? []}
              locale={{ emptyText: <EmptyState description="暂无异常记录，可点击「提取异常」" /> }}
              pagination={{ pageSize: 10, size: "small" }}
              columns={[
                {
                  title: "等级",
                  dataIndex: "severity",
                  width: 90,
                  render: (v) => <RiskTag level={v === "fault" ? "high" : "medium"} />,
                },
                {
                  title: "类型",
                  dataIndex: "anomalyType",
                  width: 110,
                  render: (v: string) =>
                    ({
                      over_limit: "超限",
                      sustained_rise: "持续上升",
                      sustained_fall: "持续下降",
                      abnormal_fluctuation: "异常波动",
                    }[v] ?? v),
                },
                { title: "摘要", dataIndex: "summary", ellipsis: true },
                {
                  title: "峰值/均值",
                  width: 120,
                  render: (_, r) => (
                    <span style={{ fontSize: 12 }}>
                      {r.peakValue ?? "-"} / {r.avgValue ?? "-"}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </>
      )}
    </Drawer>
  );
}

function Thunderbolt() {
  return <ExperimentOutlined />;
}