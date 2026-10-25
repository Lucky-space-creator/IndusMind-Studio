import { CheckOutlined, PauseOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { App, Button, Card, Descriptions, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Auth } from "@hwc/shared-auth";
import { EmptyState, JsonTextView, Panel, StatusTag, parseCitations } from "@hwc/shared-ui";
import { ADMIN_PERM } from "@hwc/shared-types";
import type { AgentDefinition, AgentDefinitionCreateRequest, AgentFlow, AgentFlowCreateRequest, AgentFlowNode, AgentRun, AgentStep, AgentToolBinding } from "@hwc/shared-types";
import * as agentApi from "../../api/agent";
import * as kbApi from "../../api/knowledge";

/** Agent 可绑定工具全集（与后端种子数据 agent_tool_binding 中的工具名一致） */
const AGENT_TOOLS = [
  { value: "threshold_query", label: "threshold_query（阈值查询）" },
  { value: "anomaly_query", label: "anomaly_query（异常数据查询）" },
  { value: "spare_stock_query", label: "spare_stock_query（备件库存查询）" },
  { value: "downtime_cost_calc", label: "downtime_cost_calc（停机损失测算）" },
  { value: "safety_check", label: "safety_check（安全核查）" },
];

/** 兼容逗号分隔与 JSON 数组两种历史存储格式，解析为字符串数组 */
function parseList(raw?: string | null): string[] {
  const s = (raw ?? "").trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      // 非 JSON 格式则回退按逗号拆分
    }
  }
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** 解析 kbIds 存储串为数字数组（Select multiple 的 value 类型） */
function parseKbIds(raw?: string | null): number[] {
  return parseList(raw)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** Agent 与流程区：Agent 定义卡片 / 协同流程编排 / 执行记录 */
export default function AgentPage() {
  return (
    <Tabs
      defaultActiveKey="definitions"
      items={[
        { key: "definitions", label: "Agent 定义", children: <DefinitionTab /> },
        { key: "flows", label: "协同流程", children: <FlowTab /> },
        { key: "runs", label: "执行记录", children: <RunTab /> },
      ]}
    />
  );
}

/* ==================== Agent 定义（卡片 + 绑定编辑） ==================== */

const TEMPLATES = [
  { value: "monitor", label: "设备监测", desc: "确认异常与分级（输出 deviceStatus/severity）" },
  { value: "root_cause", label: "根因诊断", desc: "候选根因分析（输出 topCause/confidence）" },
  { value: "spare_cost", label: "备件成本", desc: "备件清单与损失（输出 costLevel/downtimeLoss）" },
  { value: "safety", label: "安全规范", desc: "安全核查（输出 checkResult/riskLevel）" },
  { value: "work_order", label: "工单编排", desc: "维修工单生成（输出 orderTitle/priority）" },
];

function DefinitionTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AgentDefinition | null>(null);
  const [bindingAgent, setBindingAgent] = useState<AgentDefinition | null>(null);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();
  const [bindingForm] = Form.useForm();
  const [createForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "definitions", page, keyword],
    queryFn: () => agentApi.pageDefinitions({ current: page, size: 9, keyword: keyword || undefined }),
  });

  const { data: binding } = useQuery({
    queryKey: ["admin", "binding", bindingAgent?.id],
    queryFn: () => agentApi.listBindings(bindingAgent!.id),
    enabled: bindingAgent != null,
  });

  const { data: kbs } = useQuery({
    queryKey: ["admin", "kbs", "for-binding"],
    queryFn: () => kbApi.pageKbs({ current: 1, size: 100 }),
  });

  const save = useMutation({
    mutationFn: (values: Partial<AgentDefinition>) => agentApi.updateDefinition(editing!.id, values),
    onSuccess: () => {
      message.success("Agent 定义已更新");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "definitions"] });
    },
  });

  const switchStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: number }) => agentApi.switchDefinition(id, status),
    onSuccess: () => {
      message.success("Agent 状态已变更");
      qc.invalidateQueries({ queryKey: ["admin", "definitions"] });
    },
  });

  const saveBinding = useMutation({
    mutationFn: (values: Partial<AgentToolBinding>) => agentApi.updateBinding(bindingAgent!.id, values),
    onSuccess: () => {
      message.success("绑定已保存（知识库范围与工具）");
      setBindingAgent(null);
      qc.invalidateQueries({ queryKey: ["admin", "binding", bindingAgent?.id] });
    },
  });

  const createAgent = useMutation({
    mutationFn: (values: AgentDefinitionCreateRequest) => agentApi.createDefinition(values),
    onSuccess: () => {
      message.success("Agent 已创建，可在流程编排中引用");
      setCreating(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ["admin", "definitions"] });
    },
  });

  const removeAgent = useMutation({
    mutationFn: (id: number) => agentApi.deleteDefinition(id),
    onSuccess: () => {
      message.success("Agent 已删除");
      qc.invalidateQueries({ queryKey: ["admin", "definitions"] });
    },
  });

  return (
    <>
      <Panel
        title="Agent 定义"
        subtitle="五领域 Agent：监测 / 根因诊断 / 备件成本 / 安全评估 / 工单汇总"
        extra={
          <Space>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="按名称/编码搜索"
              style={{ width: 200 }}
              onPressEnter={(e) => {
                setKeyword((e.target as HTMLInputElement).value);
                setPage(1);
              }}
              onChange={(e) => !e.target.value && setKeyword("")}
            />
            <Auth code={ADMIN_PERM.AGENT_DEFINITION_WRITE}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
                新增 Agent
              </Button>
            </Auth>
          </Space>
        }
      >
        {isLoading ? (
          <EmptyState title="加载中..." />
        ) : (data?.records ?? []).length === 0 ? (
          <EmptyState description="暂无 Agent 定义" />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {(data?.records ?? []).map((agent) => (
              <Card
                key={agent.id}
                size="small"
                title={
                  <Space>
                    <span>{agent.name}</span>
                    <Tag color="cyan">{agent.domain}</Tag>
                    <StatusTag status={agent.status === 1 ? "enabled" : "disabled"} label={agent.status === 1 ? "启用" : "停用"} />
                  </Space>
                }
                extra={
                  <Auth code={ADMIN_PERM.AGENT_DEFINITION_WRITE}>
                    <Space size={0}>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          setEditing(agent);
                          form.setFieldsValue(agent);
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        onClick={() =>
                          switchStatus.mutate({ id: agent.id, status: agent.status === 1 ? 0 : 1 })
                        }
                      >
                        {agent.status === 1 ? "停用" : "启用"}
                      </Button>
                      {!TEMPLATES.some((t) => t.value === agent.code) && (
                        <Popconfirm title="确认删除该 Agent？被流程引用时将拒绝。" onConfirm={() => removeAgent.mutate(agent.id)}>
                          <Button type="link" size="small" danger>
                            删除
                          </Button>
                        </Popconfirm>
                      )}
                    </Space>
                  </Auth>
                }
                styles={{ body: { padding: 12 } }}
              >
                <p style={{ margin: "0 0 6px", fontSize: 12, color: "#1E293B" }}>
                  <b>职责：</b>
                  {agent.responsibility || "-"}
                </p>
                <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: 12, color: "#64748B" }}>
                  <b>指令：</b>
                  {agent.instruction || "-"}
                </Typography.Paragraph>
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>{agent.code}</span>
                  <Auth code={ADMIN_PERM.AGENT_BINDING_READ}>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setBindingAgent(agent);
                        const current = (binding && bindingAgent?.id === agent.id ? binding[0] : null) ?? null;
                        bindingForm.setFieldsValue(
                          current
                            ? {
                                kbIds: parseKbIds(current.kbIds),
                                matchStrictness: current.matchStrictness,
                                tools: parseList(current.tools),
                              }
                            : { matchStrictness: "medium" },
                        );
                      }}
                    >
                      知识与工具绑定
                    </Button>
                  </Auth>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Panel>

      <Modal
        title="新增 Agent（基于基础模板派生）"
        open={creating}
        onCancel={() => setCreating(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createAgent.isPending}
        destroyOnClose
        width={600}
      >
        <Form form={createForm} layout="vertical" onFinish={(v) => createAgent.mutate(v as AgentDefinitionCreateRequest)}>
          <Form.Item name="baseTemplate" label="基础模板" rules={[{ required: true, message: "请选择基础模板" }]} initialValue="root_cause">
            <Select options={TEMPLATES.map((t) => ({ value: t.value, label: `${t.label} — ${t.desc}` }))} />
          </Form.Item>
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item name="code" label="编码" style={{ width: 220 }} rules={[{ required: true, message: "必填" }, { pattern: /^[a-z][a-z0-9_]{1,31}$/, message: "小写字母开头，2-32 位字母/数字/下划线" }]}>
              <Input placeholder="如 rc_vibration" />
            </Form.Item>
            <Form.Item name="name" label="名称" style={{ width: 220 }} rules={[{ required: true, message: "必填" }]}>
              <Input placeholder="如 振动根因专家" />
            </Form.Item>
          </Space>
          <Form.Item name="domain" label="领域（可选）">
            <Input placeholder="如 振动分析" />
          </Form.Item>
          <Form.Item name="responsibility" label="职责" rules={[{ required: true, message: "必填" }]}>
            <Input.TextArea rows={2} placeholder="专注振动类故障的根因定位" />
          </Form.Item>
          <Form.Item name="instruction" label="系统指令（Prompt）" rules={[{ required: true, message: "必填" }]}>
            <Input.TextArea rows={3} placeholder="针对振动频谱与轴承特征频率给出候选根因…" />
          </Form.Item>
          <Form.Item name="boundary" label="领域边界" rules={[{ required: true, message: "必填" }]}>
            <Input.TextArea rows={2} placeholder="仅回答振动领域问题，越界拒答" />
          </Form.Item>
          <Form.Item name="outputFormat" label="输出格式（JSON 契约）" rules={[{ required: true, message: "必填" }]} initialValue='{"topCause":"","confidence":null,"summary":""}'>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`编辑 Agent · ${editing?.name ?? ""}`}
        open={editing != null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="responsibility" label="职责">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="instruction" label="系统指令（Prompt）">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="boundary" label="领域边界（越界问题须拒答）">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="outputFormat" label="输出格式（JSON 契约）">
            <Input.TextArea rows={2} placeholder='如 {"summary":"...","evidence":[...]}' />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`知识与工具绑定 · ${bindingAgent?.name ?? ""}`}
        open={bindingAgent != null}
        onCancel={() => setBindingAgent(null)}
        onOk={() => bindingForm.submit()}
        confirmLoading={saveBinding.isPending}
        destroyOnClose
      >
        <Form
          form={bindingForm}
          layout="vertical"
          onFinish={(v) => {
            // 后端契约：kbIds / tools 均为逗号分隔字符串，多选数组需 join 适配
            saveBinding.mutate({
              ...v,
              kbIds: Array.isArray(v.kbIds) && v.kbIds.length > 0 ? v.kbIds.join(",") : "",
              tools: Array.isArray(v.tools) && v.tools.length > 0 ? v.tools.join(",") : "",
            });
          }}
        >
          <Form.Item name="kbIds" label="知识库范围">
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="选择该 Agent 可访问的知识库"
              options={(kbs?.records ?? []).map((k) => ({ value: k.id, label: `${k.id} · ${k.name}` }))}
            />
          </Form.Item>
          <Form.Item name="matchStrictness" label="检索匹配严格度" initialValue="medium">
            <Select
              options={[
                { value: "low", label: "宽松" },
                { value: "medium", label: "中等" },
                { value: "high", label: "严格" },
              ]}
            />
          </Form.Item>
          <Form.Item name="tools" label="启用工具">
            <Select
              mode="multiple"
              allowClear
              placeholder="选择该 Agent 可调用的工具"
              options={AGENT_TOOLS}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

/* ==================== 协同流程 ==================== */

function FlowTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [editingFlow, setEditingFlow] = useState<AgentFlow | null>(null);
  const [nodes, setNodes] = useState<Partial<AgentFlowNode>[]>([]);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "flows", page, keyword],
    queryFn: () => agentApi.pageFlows({ current: page, size: 10, keyword: keyword || undefined }),
  });

  const { data: definitions } = useQuery({
    queryKey: ["admin", "definitions", "for-flow"],
    queryFn: () => agentApi.pageDefinitions({ current: 1, size: 100 }),
  });
  const agentMap = new Map((definitions?.records ?? []).map((d) => [d.id, d]));

  const openEditor = async (flow: AgentFlow) => {
    setEditingFlow(flow);
    const flowNodes = await agentApi.listFlowNodes(flow.id);
    setNodes(flowNodes.map((n) => ({ ...n })));
  };

  const saveFlow = useMutation({
    mutationFn: () => {
      const flow = { name: editingFlow!.name, description: editingFlow!.description };
      return agentApi.saveFlow(editingFlow!.id, { flow, nodes });
    },
    onSuccess: () => {
      message.success("流程已保存（全量替换节点）");
      setEditingFlow(null);
      qc.invalidateQueries({ queryKey: ["admin", "flows"] });
    },
  });

  const publish = useMutation({
    mutationFn: (id: number) => agentApi.publishFlow(id),
    onSuccess: () => {
      message.success("流程已发布");
      qc.invalidateQueries({ queryKey: ["admin", "flows"] });
    },
  });

  const pause = useMutation({
    mutationFn: (id: number) => agentApi.pauseFlow(id),
    onSuccess: () => {
      message.success("流程已暂停");
      qc.invalidateQueries({ queryKey: ["admin", "flows"] });
    },
  });

  const createFlow = useMutation({
    mutationFn: (values: AgentFlowCreateRequest) => agentApi.createFlow(values),
    onSuccess: (flow) => {
      message.success("流程已创建，正在打开画布编排");
      setCreating(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ["admin", "flows"] });
      navigate(`/agent/flows/${flow.id}/canvas`);
    },
  });

  const removeFlow = useMutation({
    mutationFn: (id: number) => agentApi.deleteFlow(id),
    onSuccess: () => {
      message.success("流程已删除");
      qc.invalidateQueries({ queryKey: ["admin", "flows"] });
    },
  });

  const columns: ColumnsType<AgentFlow> = [
    { title: "流程编码", dataIndex: "code", width: 140 },
    { title: "名称", dataIndex: "name" },
    { title: "版本", dataIndex: "version", width: 70 },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (s: string) => (
        <StatusTag status={s} label={{ draft: "草稿", published: "已发布", paused: "已暂停" }[s] ?? s} />
      ),
    },
    { title: "说明", dataIndex: "description", ellipsis: true },
    {
      title: "操作",
      width: 220,
      render: (_, record) => (
        <Auth code={ADMIN_PERM.AGENT_FLOW_WRITE}>
          <Space size={0} wrap>
            <Button type="link" size="small" onClick={() => navigate(`/agent/flows/${record.id}/canvas`)}>
              画布编排
            </Button>
            <Button type="link" size="small" onClick={() => openEditor(record)}>
              表单编排
            </Button>
            {record.status !== "published" ? (
              <Popconfirm title="发布后生效（将自动暂停其他已发布流程），确认？" onConfirm={() => publish.mutate(record.id)}>
                <Button type="link" size="small" icon={<CheckOutlined />}>
                  发布
                </Button>
              </Popconfirm>
            ) : (
              <Button type="link" size="small" icon={<PauseOutlined />} onClick={() => pause.mutate(record.id)}>
                暂停
              </Button>
            )}
            {record.isPreset !== 1 && (
              <Popconfirm title="确认删除该流程？历史运行记录保留。" onConfirm={() => removeFlow.mutate(record.id)}>
                <Button type="link" size="small" danger>
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        </Auth>
      ),
    },
  ];

  return (
    <>
      <Panel
        title="协同流程"
        subtitle="画布编排：拖拽 Agent 节点、连线设置触发条件，发布后生效"
        extra={
          <Space>
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
            <Auth code={ADMIN_PERM.AGENT_FLOW_WRITE}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
                新增流程
              </Button>
            </Auth>
          </Space>
        }
      >
        <Table<AgentFlow>
          rowKey="id"
          size="middle"
          loading={isLoading}
          columns={columns}
          dataSource={data?.records ?? []}
          locale={{ emptyText: <EmptyState description="暂无协同流程" /> }}
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
        title="新增协同流程"
        open={creating}
        onCancel={() => setCreating(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createFlow.isPending}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={(v) => createFlow.mutate(v)}>
          <Form.Item name="code" label="流程编码" rules={[{ required: true, message: "必填" }, { pattern: /^[a-z][a-z0-9_]{1,31}$/, message: "小写字母开头，2-32 位字母/数字/下划线" }]}>
            <Input placeholder="如 vibration_flow" />
          </Form.Item>
          <Form.Item name="name" label="流程名称" rules={[{ required: true, message: "必填" }]}>
            <Input placeholder="如 振动专项诊断流程" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} placeholder="面向振动类故障的诊断编排" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`流程编排 · ${editingFlow?.name ?? ""}`}
        open={editingFlow != null}
        onClose={() => setEditingFlow(null)}
        width={620}
        destroyOnClose
        footer={
          <Space style={{ float: "right" }}>
            <Button onClick={() => setEditingFlow(null)}>取消</Button>
            <Auth code={ADMIN_PERM.AGENT_FLOW_WRITE}>
              <Button type="primary" loading={saveFlow.isPending} onClick={() => saveFlow.mutate()}>
                保存（全量替换）
              </Button>
            </Auth>
          </Space>
        }
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {nodes.map((node, idx) => (
            <Card
              key={idx}
              size="small"
              title={`节点 ${idx + 1}`}
              extra={
                <Button
                  type="link"
                  size="small"
                  danger
                  onClick={() => setNodes(nodes.filter((_, i) => i !== idx))}
                >
                  移除
                </Button>
              }
            >
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Select
                  placeholder="选择 Agent"
                  style={{ width: "100%" }}
                  value={node.agentId}
                  options={(definitions?.records ?? []).map((d) => ({ value: d.id, label: `${d.name}（${d.domain}）` }))}
                  onChange={(v) =>
                    setNodes(nodes.map((n, i) => (i === idx ? { ...n, agentId: v, nodeName: agentMap.get(v)?.name } : n)))
                  }
                />
                <Input
                  placeholder="节点名称"
                  value={node.nodeName}
                  onChange={(e) => setNodes(nodes.map((n, i) => (i === idx ? { ...n, nodeName: e.target.value } : n)))}
                />
                <Input
                  placeholder="触发条件（DSL，留空默认顺序执行）"
                  value={node.triggerCondition}
                  onChange={(e) => setNodes(nodes.map((n, i) => (i === idx ? { ...n, triggerCondition: e.target.value } : n)))}
                />
                <InputNumber
                  placeholder="超时（秒）"
                  min={1}
                  value={node.timeoutSeconds}
                  onChange={(v) => setNodes(nodes.map((n, i) => (i === idx ? { ...n, timeoutSeconds: v ?? undefined } : n)))}
                />
              </Space>
            </Card>
          ))}
          <Button block icon={<PlusOutlined />} onClick={() => setNodes([...nodes, { nodeOrder: nodes.length + 1 }])}>
            添加节点
          </Button>
        </Space>
      </Drawer>
    </>
  );
}

/* ==================== 执行记录 ==================== */

function RunTab() {
  const [page, setPage] = useState(1);
  const [runId, setRunId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "runs", page],
    queryFn: () => agentApi.pageRuns({ current: page, size: 10 }),
  });

  const { data: steps } = useQuery({
    queryKey: ["admin", "run-steps", runId],
    queryFn: () => agentApi.listRunSteps(runId!),
    enabled: runId != null,
  });

  const columns: ColumnsType<AgentRun> = [
    { title: "Run ID", dataIndex: "id", width: 80 },
    {
      title: "类型",
      dataIndex: "runType",
      width: 80,
      render: (v) => (v === "multi" ? <Tag color="cyan">协同</Tag> : <Tag>单轮</Tag>),
    },
    { title: "设备", dataIndex: "deviceId", width: 80 },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (s: string) => <StatusTag status={s} label={{ running: "执行中", success: "成功", failed: "失败" }[s] ?? s} />,
    },
    { title: "开始时间", dataIndex: "startedAt", width: 170 },
    { title: "耗时(ms)", dataIndex: "durationMs", width: 90 },
    {
      title: "结论",
      dataIndex: "conclusion",
      ellipsis: true,
    },
    {
      title: "操作",
      width: 90,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => setRunId(record.id)}>
          步骤详情
        </Button>
      ),
    },
  ];

  return (
    <>
      <Panel title="Agent 执行记录">
        <Table<AgentRun>
          rowKey="id"
          size="middle"
          loading={isLoading}
          columns={columns}
          dataSource={data?.records ?? []}
          locale={{ emptyText: <EmptyState description="暂无执行记录" /> }}
          pagination={{
            current: page,
            pageSize: 10,
            total: data?.total ?? 0,
            showTotal: (t) => `共 ${t} 条`,
            onChange: setPage,
          }}
        />
      </Panel>

      <Drawer title={`执行步骤 · Run ${runId ?? ""}`} open={runId != null} onClose={() => setRunId(null)} width={640}>
        {(steps ?? []).length === 0 ? (
          <EmptyState description="暂无步骤数据" />
        ) : (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {(steps ?? []).map((step: AgentStep) => (
              <Card key={step.id} size="small">
                <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 6 }}>
                  <Space>
                    <Tag color="cyan">{step.phase}</Tag>
                    <StatusTag status={step.status} />
                  </Space>
                  <span style={{ fontSize: 12, color: "#64748B" }}>{step.durationMs ?? "-"} ms</span>
                </Space>
                <Typography.Paragraph ellipsis={{ rows: 3, expandable: true }} style={{ marginBottom: 6, fontSize: 13 }}>
                  {step.summary ?? "-"}
                </Typography.Paragraph>
                {step.detail && (
                  <div style={{ marginBottom: 6, padding: 8, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 4 }}>
                    <JsonTextView raw={step.detail} maxHeight={220} />
                  </div>
                )}
                {parseCitations(step.citations).length > 0 && (
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="引用">
                      {parseCitations(step.citations)
                        .map((c) => `${c.docName}${c.pageNo != null ? ` P${c.pageNo}` : ""}`)
                        .join("；")}
                    </Descriptions.Item>
                  </Descriptions>
                )}
              </Card>
            ))}
          </Space>
        )}
      </Drawer>
    </>
  );
}