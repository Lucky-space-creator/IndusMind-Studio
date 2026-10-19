import { CheckOutlined, CloseOutlined, PlusOutlined, SyncOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Tree, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DataNode } from "antd/es/tree";
import * as echarts from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Auth } from "@hwc/shared-auth";
import { EmptyState, Panel, StatusTag } from "@hwc/shared-ui";
import { ADMIN_PERM } from "@hwc/shared-types";
import type { KbGraphEdge, KbGraphNode } from "@hwc/shared-types";
import * as graphApi from "../../api/docgraph";
import * as kbApi from "../../api/knowledge";

const RELATIONS = ["引用", "替代", "补充", "前置", "同设备", "同故障"];

/** 文档关联区：左节点树 + 中关联图（ECharts）+ 右关系边管理（自动/人工区分） */
export default function DocGraphPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [kbId, setKbId] = useState<number | null>(null);
  const [edgePage, setEdgePage] = useState(1);
  const [relationFilter, setRelationFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [sourceFilter, setSourceFilter] = useState<string | undefined>();
  const [editOpen, setEditOpen] = useState(false);
  const [editingEdge, setEditingEdge] = useState<KbGraphEdge | null>(null);
  const [form] = Form.useForm();
  const chartRef = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [selectedNode, setSelectedNode] = useState<KbGraphNode | null>(null);

  const { data: kbs } = useQuery({
    queryKey: ["admin", "kbs", "for-graph"],
    queryFn: () => kbApi.pageKbs({ current: 1, size: 100 }),
  });

  const { data: nodes } = useQuery({
    queryKey: ["admin", "graph-nodes", kbId],
    queryFn: () => graphApi.listNodes({ kbId: kbId ?? undefined }),
    enabled: kbId != null,
  });

  const { data: edges, isLoading: edgeLoading } = useQuery({
    queryKey: ["admin", "graph-edges", kbId, edgePage, relationFilter, statusFilter, sourceFilter],
    queryFn: () =>
      graphApi.pageEdges({
        current: edgePage,
        size: 10,
        kbId: kbId ?? undefined,
        relationType: relationFilter,
        status: statusFilter,
        source: sourceFilter,
      }),
    enabled: kbId != null,
  });

  const nodeMap = useMemo(() => new Map((nodes ?? []).map((n) => [n.id, n])), [nodes]);

  /** ECharts 关系图渲染 */
  useEffect(() => {
    if (!chartRef.current) return;
    if (!chart.current) {
      chart.current = echarts.init(chartRef.current);
    }
    const list = edges?.records ?? [];
    chart.current.setOption({
      tooltip: { formatter: (p: { data?: { name?: string; relation?: string } }) => p.data?.name ?? "" },
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          draggable: true,
          force: { repulsion: 220, edgeLength: 90 },
          label: { show: true, fontSize: 10, color: "#1E293B", width: 90, overflow: "truncate" },
          edgeLabel: { show: true, fontSize: 9, color: "#64748B", formatter: (p: { data?: { relation?: string } }) => p.data?.relation ?? "" },
          data: (nodes ?? []).slice(0, 60).map((n) => ({
            id: String(n.id),
            name: n.title,
            symbolSize: n.nodeType === "doc" ? 40 : n.nodeType === "section" ? 26 : 18,
            itemStyle: { color: n.nodeType === "doc" ? "#0E6E8C" : n.nodeType === "section" ? "#1D4ED8" : "#94A3B8" },
          })),
          links: list
            .filter((e) => nodeMap.has(e.fromNodeId) && nodeMap.has(e.toNodeId))
            .map((e) => ({
              source: String(e.fromNodeId),
              target: String(e.toNodeId),
              relation: e.relationType,
              lineStyle: {
                color: e.status === "confirmed" ? "#15803D" : e.status === "rejected" ? "#CBD5E1" : "#C2410C",
                type: e.source === "manual" ? "solid" : "dashed",
                width: e.status === "confirmed" ? 2 : 1,
              },
            })),
        },
      ],
    });
    return undefined as unknown as void;
  }, [nodes, edges, nodeMap]);

  useEffect(() => {
    const onResize = () => chart.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  const extract = useMutation({
    mutationFn: () => graphApi.extractEdges(kbId!),
    onSuccess: (r) => {
      message.success(`已触发自动抽取，新增 ${r.addedEdges} 条候选边`);
      qc.invalidateQueries({ queryKey: ["admin", "graph-edges", kbId] });
    },
  });

  const sync = useMutation({
    mutationFn: () => graphApi.syncGraph(kbId!),
    onSuccess: () => {
      message.success("关联图重建同步完成");
      qc.invalidateQueries({ queryKey: ["admin", "graph-edges", kbId] });
    },
  });

  const saveEdge = useMutation({
    mutationFn: async (values: Partial<KbGraphEdge>) => {
      if (editingEdge) await graphApi.updateEdge(editingEdge.id, values);
      else await graphApi.createEdge(values);
      },
    onSuccess: () => {
      message.success("关系边已保存");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "graph-edges", kbId] });
    },
  });

  const confirmEdge = useMutation({
    mutationFn: (id: number) => graphApi.confirmEdge(id),
    onSuccess: () => {
      message.success("已确认该自动抽取边");
      qc.invalidateQueries({ queryKey: ["admin", "graph-edges", kbId] });
    },
  });

  const rejectEdge = useMutation({
    mutationFn: (id: number) => graphApi.rejectEdge(id),
    onSuccess: () => {
      message.success("已拒绝该候选边");
      qc.invalidateQueries({ queryKey: ["admin", "graph-edges", kbId] });
    },
  });

  const removeEdge = useMutation({
    mutationFn: (id: number) => graphApi.deleteEdge(id),
    onSuccess: () => {
      message.success("关系边已删除");
      qc.invalidateQueries({ queryKey: ["admin", "graph-edges", kbId] });
    },
  });

  const treeData: DataNode[] = useMemo(() => {
    const byType: Record<string, KbGraphNode[]> = { doc: [], section: [], segment: [] };
    (nodes ?? []).forEach((n) => {
      (byType[n.nodeType] ??= []).push(n);
    });
    return [
      {
        title: `文档节点（${byType.doc.length}）`,
        key: "doc",
        children: byType.doc.map((n) => ({ title: n.title, key: `n-${n.id}` })),
      },
      {
        title: `章节节点（${byType.section.length}）`,
        key: "section",
        children: byType.section.map((n) => ({ title: n.title, key: `n-${n.id}` })),
      },
      {
        title: `片段节点（${byType.segment.length}）`,
        key: "segment",
        children: byType.segment.map((n) => ({ title: n.title, key: `n-${n.id}` })),
      },
    ];
  }, [nodes]);

  /** 关系边表单的节点下拉选项：按节点类型分组，label 显示节点名称 */
  const nodeSelectOptions = useMemo(() => {
    const byType: Record<string, KbGraphNode[]> = { doc: [], section: [], segment: [] };
    (nodes ?? []).forEach((n) => {
      (byType[n.nodeType] ??= []).push(n);
    });
    const toOpts = (list: KbGraphNode[]) => list.map((n) => ({ value: n.id, label: n.title }));
    return [
      { label: `文档节点（${byType.doc.length}）`, options: toOpts(byType.doc) },
      { label: `章节节点（${byType.section.length}）`, options: toOpts(byType.section) },
      { label: `片段节点（${byType.segment.length}）`, options: toOpts(byType.segment) },
    ];
  }, [nodes]);

  const edgeColumns: ColumnsType<KbGraphEdge> = [
    {
      title: "起点",
      dataIndex: "fromNodeId",
      ellipsis: true,
      render: (id) => nodeMap.get(id)?.title ?? `节点 ${id}`,
    },
    {
      title: "关系",
      dataIndex: "relationType",
      width: 90,
      render: (v) => <Tag color="cyan">{v}</Tag>,
    },
    {
      title: "终点",
      dataIndex: "toNodeId",
      ellipsis: true,
      render: (id) => nodeMap.get(id)?.title ?? `节点 ${id}`,
    },
    {
      title: "来源",
      dataIndex: "source",
      width: 80,
      render: (v) => (v === "manual" ? <Tag color="blue">人工</Tag> : <Tag color="orange">自动</Tag>),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (s: string) => (
        <StatusTag
          status={s}
          label={{ pending: "待确认", confirmed: "已确认", rejected: "已拒绝" }[s] ?? s}
        />
      ),
    },
    {
      title: "操作",
      width: 220,
      render: (_, record) => (
        <Auth code={ADMIN_PERM.DOCGRAPH_WRITE}>
          <Space size={0} wrap>
            {record.status === "pending" && record.source === "auto" && (
              <>
                <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => confirmEdge.mutate(record.id)}>
                  确认
                </Button>
                <Button type="link" size="small" icon={<CloseOutlined />} onClick={() => rejectEdge.mutate(record.id)}>
                  拒绝
                </Button>
              </>
            )}
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditingEdge(record);
                form.setFieldsValue(record);
                setEditOpen(true);
              }}
            >
              编辑
            </Button>
            <Popconfirm title="确认删除该关系边？" onConfirm={() => removeEdge.mutate(record.id)}>
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
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
      <Panel title="文档/片段树">
        <Select
          placeholder="选择知识库"
          style={{ width: "100%", marginBottom: 12 }}
          showSearch
          optionFilterProp="label"
          options={(kbs?.records ?? []).map((k) => ({ value: k.id, label: k.name }))}
          onChange={(v) => {
            setKbId(v);
            setEdgePage(1);
          }}
        />
        {kbId == null ? (
          <EmptyState description="先选择知识库" />
        ) : (
          <Tree
            treeData={treeData}
            defaultExpandAll
            selectedKeys={selectedNode ? [`n-${selectedNode.id}`] : []}
            onSelect={(keys) => {
              const key = String(keys[0] ?? "");
              if (key.startsWith("n-")) {
                const node = nodeMap.get(Number(key.slice(2)));
                setSelectedNode(node ?? null);
              } else {
                setSelectedNode(null);
              }
            }}
          />
        )}
        {selectedNode && (
          <div style={{ marginTop: 12, borderTop: "1px solid #E2E8F0", paddingTop: 10, fontSize: 12 }}>
            <Typography.Text type="secondary">选中节点</Typography.Text>
            <div style={{ marginTop: 4, fontWeight: 600 }}>{selectedNode.title}</div>
            <div style={{ color: "#64748B", marginTop: 2 }}>
              类型 {selectedNode.nodeType} · refId {selectedNode.refId}
            </div>
          </div>
        )}
      </Panel>

      <div>
        <Panel
          title="关联图"
          subtitle="实线=人工边，虚线=自动边；绿色=已确认，橙色=待确认"
          extra={
            <Space>
              <Auth code={ADMIN_PERM.DOCGRAPH_WRITE}>
                <Button icon={<ThunderboltOutlined />} disabled={!kbId} loading={extract.isPending} onClick={() => extract.mutate()}>
                  自动抽取候选边
                </Button>
                <Button icon={<SyncOutlined />} disabled={!kbId} loading={sync.isPending} onClick={() => sync.mutate()}>
                  重建同步
                </Button>
              </Auth>
            </Space>
          }
          bodyStyle={{ padding: 8 }}
        >
          <div ref={chartRef} style={{ height: 320, background: "#F8FAFC", borderRadius: 6 }}>
            {kbId == null && (
              <EmptyState description="选择知识库后展示文档关联图（可拖拽、缩放）" style={{ padding: "120px 16px" }} />
            )}
          </div>
        </Panel>

        <Panel
          title="关系边管理"
          extra={
            <Space wrap>
              <Select
                allowClear
                placeholder="关系类型"
                style={{ width: 120 }}
                options={RELATIONS.map((r) => ({ value: r, label: r }))}
                value={relationFilter}
                onChange={(v) => {
                  setRelationFilter(v);
                  setEdgePage(1);
                }}
              />
              <Select
                allowClear
                placeholder="状态"
                style={{ width: 110 }}
                options={[
                  { value: "pending", label: "待确认" },
                  { value: "confirmed", label: "已确认" },
                  { value: "rejected", label: "已拒绝" },
                ]}
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  setEdgePage(1);
                }}
              />
              <Select
                allowClear
                placeholder="来源"
                style={{ width: 100 }}
                options={[
                  { value: "auto", label: "自动" },
                  { value: "manual", label: "人工" },
                ]}
                value={sourceFilter}
                onChange={(v) => {
                  setSourceFilter(v);
                  setEdgePage(1);
                }}
              />
              <Auth code={ADMIN_PERM.DOCGRAPH_WRITE}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={!kbId}
                  onClick={() => {
                    setEditingEdge(null);
                    form.resetFields();
                    setEditOpen(true);
                  }}
                >
                  新增边
                </Button>
              </Auth>
            </Space>
          }
        >
          <Table<KbGraphEdge>
            rowKey="id"
            size="middle"
            loading={edgeLoading}
            columns={edgeColumns}
            dataSource={edges?.records ?? []}
            locale={{ emptyText: <EmptyState description="暂无关系边，可尝试「自动抽取候选边」" /> }}
            pagination={{
              current: edgePage,
              pageSize: 10,
              total: edges?.total ?? 0,
              showTotal: (t) => `共 ${t} 条`,
              onChange: setEdgePage,
            }}
          />
        </Panel>
      </div>

      <Modal
        title={editingEdge ? "编辑关系边" : "新增人工关系边"}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveEdge.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveEdge.mutate(v)}>
          <Form.Item name="fromNodeId" label="起点节点" rules={[{ required: true, message: "请选择起点节点" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择起点节点"
              options={nodeSelectOptions}
              disabled={!kbId}
            />
          </Form.Item>
          <Form.Item name="toNodeId" label="终点节点" rules={[{ required: true, message: "请选择终点节点" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择终点节点"
              options={nodeSelectOptions}
              disabled={!kbId}
            />
          </Form.Item>
          <Form.Item name="relationType" label="关系类型" rules={[{ required: true, message: "请选择关系类型" }]}>
            <Select options={RELATIONS.map((r) => ({ value: r, label: r }))} />
          </Form.Item>
          <Form.Item name="confidence" label="置信度（0-1，人工边可为空）">
            <InputNumber style={{ width: "100%" }} min={0} max={1} step={0.1} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}