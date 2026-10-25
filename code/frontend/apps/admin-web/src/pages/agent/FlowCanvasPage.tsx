import { ArrowLeftOutlined, SaveOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { App, Button, Drawer, Empty, Form, Input, InputNumber, Popconfirm, Select, Space, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Auth } from "@hwc/shared-auth";
import { EmptyState, Panel, StatusTag } from "@hwc/shared-ui";
import { ADMIN_PERM } from "@hwc/shared-types";
import type { AgentDefinition, AgentFlowNode, AgentSummary, FlowValidationError } from "@hwc/shared-types";
import * as agentApi from "../../api/agent";

const TEMPLATE_META: Record<string, { label: string; color: string; fields: { value: string; label: string; numeric?: boolean }[] }> = {
  monitor: {
    label: "监测",
    color: "#0E6E8C",
    fields: [
      { value: "deviceStatus", label: "设备状态(normal/abnormal)" },
      { value: "severity", label: "严重度(low/medium/high)" },
    ],
  },
  root_cause: {
    label: "根因",
    color: "#1D4ED8",
    fields: [
      { value: "topCause", label: "首要根因(文本)" },
      { value: "confidence", label: "置信度(数值)", numeric: true },
    ],
  },
  spare_cost: {
    label: "备件",
    color: "#B45309",
    fields: [
      { value: "downtimeLoss", label: "停机损失(数值)", numeric: true },
      { value: "costLevel", label: "成本等级(low/medium/high)" },
    ],
  },
  safety: {
    label: "安全",
    color: "#15803D",
    fields: [
      { value: "checkResult", label: "核查结论(pass/fail)" },
      { value: "riskLevel", label: "风险等级(low/medium/high)" },
    ],
  },
  work_order: {
    label: "工单",
    color: "#7C3AED",
    fields: [
      { value: "orderTitle", label: "工单标题(文本)" },
      { value: "priority", label: "优先级(low/medium/high)" },
    ],
  },
};

const OPERATORS = [
  { value: "!=", label: "≠ 不等于" },
  { value: "==", label: "= 等于" },
  { value: ">", label: "> 大于" },
  { value: "<", label: "< 小于" },
  { value: ">=", label: "≥ 大于等于" },
  { value: "<=", label: "≤ 小于等于" },
];

interface CanvasNodeData extends Record<string, unknown> {
  nodeName: string;
  agentSummary: AgentSummary;
  template: string;
  timeoutSeconds: number;
  disabled?: boolean;
}

function AgentNodeCard({ data }: NodeProps) {
  const meta = TEMPLATE_META[data.template as string] ?? { label: "未知", color: "#94A3B8", fields: [] };
  const canvasData = data as CanvasNodeData;
  return (
    <div
      style={{
        minWidth: 170,
        maxWidth: 210,
        borderRadius: 8,
        border: `2px solid ${meta.color}`,
        background: "#fff",
        boxShadow: "0 2px 8px rgba(15,36,55,.08)",
        opacity: canvasData.disabled ? 0.55 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ padding: "8px 10px", borderBottom: "1px solid #E2E8F0" }}>
        <Space size={6}>
          <Tag color={meta.color} style={{ margin: 0 }}>
            {meta.label}
          </Tag>
          <Typography.Text strong style={{ fontSize: 13 }} ellipsis>
            {canvasData.nodeName as string}
          </Typography.Text>
        </Space>
      </div>
      <div style={{ padding: "6px 10px", fontSize: 11, color: "#64748B" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{canvasData.agentSummary?.name}</span>
          <span>{canvasData.timeoutSeconds as number}s</span>
        </div>
        {canvasData.disabled && <div style={{ color: "#DC2626" }}>Agent 已停用</div>}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { agent: AgentNodeCard };

/** 画布编排编辑器：节点=Agent 实例，边=触发条件（存目标节点 upstream+condition） */
export default function FlowCanvasPage() {
  const { message } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const flowId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [bizNodes, setBizNodes] = useState<Partial<AgentFlowNode>[]>([]);
  const [flowName, setFlowName] = useState("");
  const [flowDesc, setFlowDesc] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const { data: canvas, isLoading } = useQuery({
    queryKey: ["admin", "flow-canvas", flowId],
    queryFn: () => agentApi.getFlowCanvas(flowId),
  });

  const agentMap = useMemo(
    () => new Map<number, AgentSummary>((canvas?.agentSnapshots ?? []).map((a) => [a.id, a])),
    [canvas],
  );

  if (canvas && !loaded) {
    setFlowName(canvas.flow.name);
    setFlowDesc(canvas.flow.description ?? "");
    setBizNodes(
      (canvas.nodes ?? []).map((n) => ({
        ...n,
        positionX: n.positionX ?? 80,
        positionY: n.positionY ?? 80,
      })),
    );
    setLoaded(true);
  }

  const { data: allAgents } = useQuery({
    queryKey: ["admin", "definitions", "for-canvas"],
    queryFn: () => agentApi.pageDefinitions({ current: 1, size: 100 }),
  });

  const rfNodes: Node[] = useMemo(
    () =>
      bizNodes.map((n, i) => {
        const summary = agentMap.get(n.agentId ?? -1);
        const template = summary?.baseTemplate ?? "monitor";
        return {
          id: n.instanceKey ?? `tmp-${i}`,
          type: "agent",
          position: { x: n.positionX ?? 80, y: n.positionY ?? 80 },
          data: {
            nodeName: n.nodeName ?? summary?.name ?? "未命名",
            agentSummary: summary ?? { id: n.agentId ?? 0, code: "?", name: "未知 Agent", baseTemplate: template, status: 1 },
            template,
            timeoutSeconds: n.timeoutSeconds ?? 120,
            disabled: summary ? summary.status !== 1 : true,
          } satisfies CanvasNodeData,
        };
      }),
    [bizNodes, agentMap],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      bizNodes
        .filter((n) => n.upstreamInstanceKey)
        .map((n, i) => ({
          id: `e-${n.upstreamInstanceKey}-${n.instanceKey ?? i}`,
          source: n.upstreamInstanceKey!,
          target: n.instanceKey ?? `tmp-${i}`,
          animated: true,
        })),
    [bizNodes],
  );

  const onConnect = (connection: Connection) => {
    setBizNodes((prev) =>
      prev.map((n, i) => {
        const key = n.instanceKey ?? `tmp-${i}`;
        if (key === connection.target && key !== connection.source) {
          return { ...n, upstreamInstanceKey: connection.source };
        }
        return n;
      }),
    );
  };

  const onNodesDelete = (deleted: Node[]) => {
    const keys = new Set(deleted.map((n) => n.id));
    setBizNodes((prev) =>
      prev
        .filter((n, i) => !keys.has(n.instanceKey ?? `tmp-${i}`))
        .map((n) => (n.upstreamInstanceKey && keys.has(n.upstreamInstanceKey) ? { ...n, upstreamInstanceKey: undefined } : n)),
    );
  };

  const onEdgesDelete = (deleted: Edge[]) => {
    const targets = new Set(deleted.map((e) => e.target));
    setBizNodes((prev) =>
      prev.map((n, i) => (targets.has(n.instanceKey ?? `tmp-${i}`) ? { ...n, upstreamInstanceKey: undefined } : n)),
    );
  };

  const onNodeDragStop = (_: unknown, node: Node) => {
    setBizNodes((prev) =>
      prev.map((n, i) =>
        (n.instanceKey ?? `tmp-${i}`) === node.id
          ? { ...n, positionX: Math.round(node.position.x), positionY: Math.round(node.position.y) }
          : n,
      ),
    );
  };

  const addNode = (agent: AgentDefinition) => {
    let key = agent.code;
    let suffix = 2;
    while (bizNodes.some((n) => n.instanceKey === key)) {
      key = `${agent.code}_${suffix++}`;
    }
    const maxPos = bizNodes.reduce((acc, n) => Math.max(acc, n.positionX ?? 0), 40);
    setBizNodes((prev) => [
      ...prev,
      {
        instanceKey: key,
        agentId: agent.id,
        nodeName: agent.name,
        timeoutSeconds: 120,
        positionX: maxPos + 260,
        positionY: 60 + Math.random() * 240,
        sortSeq: prev.length + 1,
        triggerCondition: undefined,
        upstreamInstanceKey: undefined,
      },
    ]);
  };

  const selectedNode = bizNodes.find((n, i) => (n.instanceKey ?? `tmp-${i}`) === selectedKey) ?? null;

  const save = useMutation({
    mutationFn: () =>
      agentApi.saveFlow(flowId, {
        flow: { name: flowName, description: flowDesc },
        nodes: bizNodes.map((n, i) => ({
          ...n,
          instanceKey: n.instanceKey ?? `tmp-${i}`,
          sortSeq: n.sortSeq ?? i + 1,
        })),
      }),
    onSuccess: () => {
      message.success("画布已保存");
      qc.invalidateQueries({ queryKey: ["admin", "flow-canvas", flowId] });
      qc.invalidateQueries({ queryKey: ["admin", "flows"] });
    },
    onError: (e: Error) => showValidationError(e.message),
  });

  const publish = useMutation({
    mutationFn: () => agentApi.publishFlow(flowId),
    onSuccess: () => {
      message.success("流程已发布（其他已发布流程自动暂停）");
      qc.invalidateQueries({ queryKey: ["admin", "flows"] });
      qc.invalidateQueries({ queryKey: ["admin", "flow-canvas", flowId] });
    },
    onError: (e: Error) => showValidationError(e.message),
  });

  const showValidationError = (raw: string) => {
    try {
      const errors: FlowValidationError[] = JSON.parse(raw);
      if (Array.isArray(errors) && errors.length > 0) {
        message.error(errors.map((e) => `【${e.nodeInstanceKey || "流程"}】${e.message}`).join("；"), 8);
        return;
      }
    } catch {
      /* 非 JSON 数组直接展示 */
    }
    message.error(raw || "保存失败");
  };

  if (isLoading) return <EmptyState title="画布加载中..." />;
  if (!canvas) return <EmptyState description="流程不存在" />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 14, alignItems: "start" }}>
      <Panel title="Agent 面板" subtitle="点击添加到画布">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 640, overflow: "auto" }}>
          {(allAgents?.records ?? []).length === 0 && <Empty description="暂无可用 Agent" />}
          {(allAgents?.records ?? []).map((a) => (
            <div
              key={a.id}
              onClick={() => addNode(a)}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: `1px solid ${TEMPLATE_META[a.baseTemplate || a.code]?.color ?? "#CBD5E1"}55`,
                cursor: "pointer",
                background: a.status === 1 ? "#fff" : "#F8FAFC",
                opacity: a.status === 1 ? 1 : 0.6,
              }}
            >
              <Space size={6}>
                <Tag color={TEMPLATE_META[a.baseTemplate || a.code]?.color ?? "default"} style={{ margin: 0 }}>
                  {TEMPLATE_META[a.baseTemplate || a.code]?.label ?? a.code}
                </Tag>
                <Typography.Text strong style={{ fontSize: 12 }}>
                  {a.name}
                </Typography.Text>
              </Space>
              <Typography.Paragraph ellipsis style={{ margin: "2px 0 0", fontSize: 11, color: "#64748B" }}>
                {a.code} · {a.responsibility}
              </Typography.Paragraph>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/agent")} />
            <Input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              style={{ width: 220 }}
              placeholder="流程名称"
            />
            <StatusTag status={canvas.flow.status} label={{ draft: "草稿", published: "已发布", paused: "已暂停" }[canvas.flow.status] ?? canvas.flow.status} />
          </Space>
        }
        subtitle={`版本 v${canvas.flow.version} · ${bizNodes.length} 节点 · ${rfEdges.length} 连线`}
        extra={
          <Auth code={ADMIN_PERM.AGENT_FLOW_WRITE}>
            <Space>
              <Button icon={<SaveOutlined />} loading={save.isPending} onClick={() => save.mutate()}>
                保存
              </Button>
              <Popconfirm title="发布后生效（其他已发布流程自动暂停），确认？" onConfirm={() => publish.mutate()}>
                <Button type="primary" icon={<ThunderboltOutlined />} loading={publish.isPending}>
                  发布
                </Button>
              </Popconfirm>
            </Space>
          </Auth>
        }
        bodyStyle={{ padding: 8 }}
      >
        <Input.TextArea
          value={flowDesc}
          onChange={(e) => setFlowDesc(e.target.value)}
          rows={1}
          placeholder="流程说明（可选）"
          style={{ marginBottom: 8 }}
        />
        <div style={{ height: 560, borderRadius: 8, border: "1px solid #E2E8F0" }}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onConnect={onConnect}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={(_, node) => setSelectedKey(node.id)}
            onPaneClick={() => setSelectedKey(null)}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          拖入 Agent → 从左侧端口拖线到目标节点建立触发关系 → 点击节点在右侧抽屉编辑属性与条件 → 保存 / 发布
        </Typography.Text>
      </Panel>

      <NodePropertyDrawer
        node={selectedNode}
        nodes={bizNodes}
        agentMap={agentMap}
        onClose={() => setSelectedKey(null)}
        onChange={(patch) =>
          setBizNodes((prev) => prev.map((n, i) => ((n.instanceKey ?? `tmp-${i}`) === selectedKey ? { ...n, ...patch } : n)))
        }
      />
    </div>
  );
}

function NodePropertyDrawer({
  node,
  nodes,
  agentMap,
  onClose,
  onChange,
}: {
  node: Partial<AgentFlowNode> | null;
  nodes: Partial<AgentFlowNode>[];
  agentMap: Map<number, AgentSummary>;
  onClose: () => void;
  onChange: (patch: Partial<AgentFlowNode>) => void;
}) {
  const { message } = App.useApp();
  const [condValue, setCondValue] = useState<string>("");
  const cond = useMemo(() => {
    if (!node?.triggerCondition) return null;
    try {
      const expr = JSON.parse(node.triggerCondition).expr ?? "";
      const m = expr.match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*(==|!=|>=|<=|>|<)\s*'([^']*)'$/);
      return m ? { source: m[1], field: m[2], op: m[3], value: m[4] } : null;
    } catch {
      return null;
    }
  }, [node?.triggerCondition]);

  if (!node) return null;
  const summary = agentMap.get(node.agentId ?? -1);
  const template = summary?.baseTemplate ?? "monitor";
  const upstreamTemplate = (() => {
    const up = nodes.find((n) => n.instanceKey === node.upstreamInstanceKey);
    return up ? agentMap.get(up.agentId ?? -1)?.baseTemplate ?? null : null;
  })();
  const allowedFields = upstreamTemplate ? (TEMPLATE_META[upstreamTemplate]?.fields ?? []) : [];

  const buildCondition = (source: string, field: string, op: string, value: string) => {
    if (!source || !field) return undefined;
    return JSON.stringify({ expr: `${source}.${field} ${op} '${value}'` });
  };

  return (
    <Drawer
      title={`节点属性 · ${node.nodeName ?? ""}`}
      open={node != null}
      onClose={onClose}
      width={360}
      destroyOnClose
    >
      <Form layout="vertical">
        <Form.Item label="节点名称">
          <Input value={node.nodeName} onChange={(e) => onChange({ nodeName: e.target.value })} />
        </Form.Item>
        <Form.Item label="实例键（流程内唯一）">
          <Input value={node.instanceKey} disabled style={{ fontFamily: "monospace" }} />
        </Form.Item>
        <Form.Item label="基础模板">
          <Tag color={TEMPLATE_META[template]?.color ?? "default"}>{TEMPLATE_META[template]?.label ?? template}</Tag>
          <span style={{ marginLeft: 8, fontSize: 12, color: "#64748B" }}>{summary?.name}</span>
        </Form.Item>
        <Form.Item label="超时（秒，1-300）">
          <InputNumber
            min={1}
            max={300}
            value={node.timeoutSeconds ?? 120}
            onChange={(v) => onChange({ timeoutSeconds: v ?? 120 })}
            style={{ width: "100%" }}
          />
        </Form.Item>
        <Typography.Title level={5} style={{ fontSize: 14 }}>
          触发条件（连线语义）
        </Typography.Title>
        {node.upstreamInstanceKey ? (
          <>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              上游 {node.upstreamInstanceKey}（模板 {upstreamTemplate ?? "?"}）输出满足以下条件时执行本节点：
            </Typography.Text>
            <Space direction="vertical" size={8} style={{ display: "flex", marginTop: 8 }}>
              <Select
                placeholder="选择字段"
                style={{ width: "100%" }}
                value={cond?.field}
                options={allowedFields.map((f) => ({ value: f.value, label: f.label }))}
                onChange={(field) =>
                  onChange({
                    triggerCondition: buildCondition(node.upstreamInstanceKey!, field, cond?.op ?? "!=", cond?.value ?? ""),
                  })
                }
              />
              <Space>
                <Select
                  placeholder="操作符"
                  style={{ width: 140 }}
                  value={cond?.op}
                  options={OPERATORS}
                  onChange={(op) =>
                    onChange({
                      triggerCondition: buildCondition(node.upstreamInstanceKey!, cond?.field ?? "", op, cond?.value ?? ""),
                    })
                  }
                />
                <Input
                  placeholder="比较值"
                  style={{ width: 160 }}
                  value={condValue || cond?.value || ""}
                  onChange={(e) => setCondValue(e.target.value)}
                  onBlur={() =>
                    onChange({
                      triggerCondition: buildCondition(
                        node.upstreamInstanceKey!,
                        cond?.field ?? "",
                        cond?.op ?? "!=",
                        condValue || cond?.value || "",
                      ),
                    })
                  }
                />
              </Space>
              <Button
                size="small"
                danger
                onClick={() => {
                  onChange({ triggerCondition: undefined });
                  setCondValue("");
                  message.info("已清除触发条件（将无条件执行）");
                }}
              >
                清除条件
              </Button>
            </Space>
          </>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            起点节点：无上游，始终执行。从上游节点右侧端口拖线到本节点可设置触发条件。
          </Typography.Text>
        )}
      </Form>
    </Drawer>
  );
}