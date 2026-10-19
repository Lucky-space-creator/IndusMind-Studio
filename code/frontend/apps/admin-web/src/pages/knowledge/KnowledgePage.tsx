import {
  DeleteOutlined,
  FileSearchOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Drawer,
  Form,
  Input,

  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload as AntUpload,
} from "antd";
import type { UploadFile } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Auth } from "@hwc/shared-auth";
import { EmptyState, Panel, ProgressBar, StatusTag } from "@hwc/shared-ui";
import { ADMIN_PERM } from "@hwc/shared-types";
import type { KbDocument, KbKnowledgeBase, KbSegment } from "@hwc/shared-types";
import * as kbApi from "../../api/knowledge";
import * as deviceApi from "../../api/device";

const KB_DOC_STATUS: Record<string, string> = { enabled: "启用", disabled: "停用" };

/** 知识库区：左侧知识库列表 + 右侧文档管理（上传/启停/索引进度/片段/试搜） */
export default function KnowledgePage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [kbId, setKbId] = useState<number | null>(null);
  const [kbPage, setKbPage] = useState(1);
  const [docPage, setDocPage] = useState(1);
  const [docKeyword, setDocKeyword] = useState("");
  const [kbOpen, setKbOpen] = useState(false);
  const [editingKb, setEditingKb] = useState<KbKnowledgeBase | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [tasksDoc, setTasksDoc] = useState<KbDocument | null>(null);
  const [segmentsDoc, setSegmentsDoc] = useState<KbDocument | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [kbForm] = Form.useForm();
  const [uploadForm] = Form.useForm();
  const [searchForm] = Form.useForm();

  const { data: kbs, isLoading: kbLoading } = useQuery({
    queryKey: ["admin", "kbs", kbPage],
    queryFn: () => kbApi.pageKbs({ current: kbPage, size: 20 }),
  });

  const { data: devTypes } = useQuery({
    queryKey: ["admin", "types", "all"],
    queryFn: () => deviceApi.pageTypes({ current: 1, size: 100 }),
  });

  const { data: docs, isLoading: docLoading } = useQuery({
    queryKey: ["admin", "documents", kbId, docPage, docKeyword],
    queryFn: () =>
      kbApi.pageDocuments({ current: docPage, size: 10, kbId: kbId ?? undefined, keyword: docKeyword || undefined }),
    enabled: kbId != null,
  });

  const { data: tasks } = useQuery({
    queryKey: ["admin", "doc-tasks", tasksDoc?.id],
    queryFn: () => kbApi.listDocumentTasks(tasksDoc!.id),
    enabled: tasksDoc != null,
    refetchInterval: (q) =>
      q.state.data?.some((t) => t.status === "running" || t.status === "pending") ? 3000 : false,
  });

  const { data: segments, isLoading: segLoading } = useQuery({
    queryKey: ["admin", "segments", segmentsDoc?.id],
    queryFn: () => kbApi.listSegments(segmentsDoc!.id, { current: 1, size: 50 }),
    enabled: segmentsDoc != null,
  });

  const { data: searchHits, refetch: runSearch, isFetching: searching } = useQuery({
    queryKey: ["admin", "kb-search"],
    queryFn: () => kbApi.searchKnowledge(searchForm.getFieldsValue()),
    enabled: false,
  });

  const saveKb = useMutation({
    mutationFn: async (values: Partial<KbKnowledgeBase>) => {
      if (editingKb) await kbApi.updateKb(editingKb.id, values);
      else await kbApi.createKb(values);
    },
    onSuccess: () => {
      message.success("知识库已保存");
      setKbOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "kbs"] });
    },
  });

  const removeKb = useMutation({
    mutationFn: (id: number) => kbApi.deleteKb(id),
    onSuccess: (_data, id) => {
      message.success("知识库已删除");
      if (kbId === id) setKbId(null);
      qc.invalidateQueries({ queryKey: ["admin", "kbs"] });
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      const values = await uploadForm.validateFields();
      const file = values.file?.[0]?.originFileObj;
      if (!file) throw new Error("请选择文件");
      return kbApi.uploadDocument(file, kbId!, values.docName, values.docType);
    },
    onSuccess: () => {
      message.success("文档已上传，正在解析与构建索引");
      setUploadOpen(false);
      uploadForm.resetFields();
      qc.invalidateQueries({ queryKey: ["admin", "documents", kbId] });
      qc.invalidateQueries({ queryKey: ["admin", "kbs"] });
    },
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "enabled" | "disabled" }) =>
      kbApi.changeDocumentStatus(id, status),
    onSuccess: () => {
      message.success("文档状态已变更（同步生效于检索）");
      qc.invalidateQueries({ queryKey: ["admin", "documents", kbId] });
    },
  });

  const removeDoc = useMutation({
    mutationFn: (id: number) => kbApi.deleteDocument(id),
    onSuccess: () => {
      message.success("文档已删除");
      qc.invalidateQueries({ queryKey: ["admin", "documents", kbId] });
    },
  });

  const reindex = useMutation({
    mutationFn: (id: number) => kbApi.reindexDocument(id),
    onSuccess: (_data, id) => {
      message.success("已触发索引重建，可在「索引进度」中查看");
      qc.invalidateQueries({ queryKey: ["admin", "doc-tasks", id] });
    },
  });

  const docColumns: ColumnsType<KbDocument> = [
    { title: "文档名称", dataIndex: "docName", ellipsis: true },
    { title: "类型", dataIndex: "docType", width: 90 },
    { title: "版本", dataIndex: "version", width: 70 },
    { title: "片段数", dataIndex: "segmentCount", width: 80 },
    {
      title: "状态",
      dataIndex: "status",
      width: 80,
      render: (s) => <StatusTag status={s} label={KB_DOC_STATUS[s] ?? s} />,
    },
    {
      title: "操作",
      width: 300,
      render: (_, record) => (
        <Space size={0} wrap>
          <Auth code={ADMIN_PERM.KB_DOCUMENT_PUBLISH}>
            <Tooltip title={record.status === "enabled" ? "停用（检索时排除）" : "启用（纳入检索）"}>
              <Button
                type="link"
                size="small"
                onClick={() =>
                  changeStatus.mutate({ id: record.id, status: record.status === "enabled" ? "disabled" : "enabled" })
                }
              >
                {record.status === "enabled" ? "停用" : "启用"}
              </Button>
            </Tooltip>
          </Auth>
          <Auth code={ADMIN_PERM.KB_INDEX_WRITE}>
            <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => reindex.mutate(record.id)}>
              重建索引
            </Button>
          </Auth>
          <Button type="link" size="small" onClick={() => setTasksDoc(record)}>
            索引进度
          </Button>
          <Button type="link" size="small" onClick={() => setSegmentsDoc(record)}>
            片段
          </Button>
          <Auth code={ADMIN_PERM.KB_DOCUMENT_DELETE}>
            <Popconfirm title="删除后将同步清理向量索引，确认？" onConfirm={() => removeDoc.mutate(record.id)}>
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
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
      <Panel
        title="知识库"
        extra={
          <Auth code={ADMIN_PERM.KB_WRITE}>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingKb(null);
                kbForm.resetFields();
                setKbOpen(true);
              }}
            >
              新建
            </Button>
          </Auth>
        }
      >
        <List
          loading={kbLoading}
          dataSource={kbs?.records ?? []}
          locale={{ emptyText: <EmptyState description="暂无知识库" /> }}
          renderItem={(kb) => (
            <List.Item
              style={{
                cursor: "pointer",
                padding: "10px 12px",
                borderRadius: 6,
                border: kbId === kb.id ? "1px solid #0E6E8C" : "1px solid transparent",
                background: kbId === kb.id ? "#E0F2F7" : undefined,
              }}
              onClick={() => {
                setKbId(kb.id);
                setDocPage(1);
              }}
              actions={[
                <Auth code={ADMIN_PERM.KB_WRITE}>
                  <Space size={0}>
                    <Button
                      type="link"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingKb(kb);
                        kbForm.setFieldsValue(kb);
                        setKbOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="删除知识库将级联删除其文档与索引，确认？"
                      onConfirm={() => removeKb.mutate(kb.id)}
                      onPopupClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="link"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  </Space>
                </Auth>,
              ]}
            >
              <List.Item.Meta
                title={
                  <span>
                    {kb.name}{" "}
                    <StatusTag
                      status={kb.indexStatus}
                      label={
                        { init: "未构建", indexing: "构建中", ready: "已就绪", error: "构建失败" }[kb.indexStatus] ?? kb.indexStatus
                      }
                    />
                  </span>
                }
                description={
                  <span style={{ fontSize: 12 }}>
                    厂商 {kb.vendor || "-"} · 故障等级 {kb.faultLevel || "-"} · 文档 {kb.docCount} 篇
                  </span>
                }
              />
            </List.Item>
          )}
          pagination={{
            size: "small",
            current: kbPage,
            pageSize: 20,
            total: kbs?.total ?? 0,
            onChange: setKbPage,
          }}
        />
      </Panel>

      <Panel
        title="文档管理"
        subtitle={kbId == null ? "请先在左侧选择知识库" : "上传后自动解析、分段并构建向量索引"}
        extra={
          <Space>
            <Button icon={<FileSearchOutlined />} disabled={!kbId} onClick={() => setSearchOpen(true)}>
              试搜
            </Button>
            <Auth code={ADMIN_PERM.KB_DOCUMENT_WRITE}>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                disabled={!kbId}
                onClick={() => {
                  uploadForm.resetFields();
                  setUploadOpen(true);
                }}
              >
                上传文档
              </Button>
            </Auth>
          </Space>
        }
      >
        {kbId == null ? (
          <EmptyState title="未选择知识库" description="在左侧选择一个知识库后管理其文档" />
        ) : (
          <>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="按文档名称/备注搜索"
              style={{ width: 260, marginBottom: 12 }}
              onPressEnter={(e) => {
                setDocKeyword((e.target as HTMLInputElement).value);
                setDocPage(1);
              }}
              onChange={(e) => !e.target.value && setDocKeyword("")}
            />
            <Table<KbDocument>
              rowKey="id"
              size="middle"
              loading={docLoading}
              columns={docColumns}
              dataSource={docs?.records ?? []}
              locale={{ emptyText: <EmptyState description="该知识库暂无文档" /> }}
              pagination={{
                current: docPage,
                pageSize: 10,
                total: docs?.total ?? 0,
                showTotal: (t) => `共 ${t} 条`,
                onChange: setDocPage,
              }}
            />
          </>
        )}
      </Panel>

      {/* 知识库编辑 */}
      <Modal
        title={editingKb ? "编辑知识库" : "新建知识库"}
        open={kbOpen}
        onCancel={() => setKbOpen(false)}
        onOk={() => kbForm.submit()}
        confirmLoading={saveKb.isPending}
        destroyOnClose
      >
        <Form form={kbForm} layout="vertical" onFinish={(v) => saveKb.mutate(v)}>
          <Form.Item name="name" label="知识库名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input placeholder="如 主轴类设备维修手册库" />
          </Form.Item>
          <Form.Item name="devTypeId" label="适用设备类型">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="选择设备类型（可选）"
              options={(devTypes?.records ?? []).map((t) => ({ value: t.id, label: `${t.code} · ${t.name}` }))}
            />
          </Form.Item>
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item name="vendor" label="厂商" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="faultLevel" label="故障等级" style={{ flex: 1 }}>
              <Select
                allowClear
                options={[
                  { value: "common", label: "常见故障" },
                  { value: "severe", label: "严重故障" },
                  { value: "all", label: "全部" },
                ]}
              />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 文档上传 */}
      <Modal
        title="上传文档"
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        onOk={() => upload.mutate()}
        confirmLoading={upload.isPending}
        destroyOnClose
      >
        <Form form={uploadForm} layout="vertical">
          <Form.Item name="docName" label="文档名称（留空取文件名）">
            <Input placeholder="如 XX 主轴维护手册 V2" />
          </Form.Item>
          <Form.Item name="docType" label="文档类型" initialValue="manual">
            <Select
              options={[
                { value: "manual", label: "维修手册" },
                { value: "standard", label: "标准规范" },
                { value: "case", label: "故障案例" },
                { value: "other", label: "其他" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="file"
            label="文件（PDF / Word / Markdown / TXT）"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
            rules={[{ required: true, message: "请选择文件" }]}
          >
            <UploadButton />
          </Form.Item>
        </Form>
      </Modal>

      {/* 索引进度 */}
      <Drawer
        title={`索引进度 · ${tasksDoc?.docName ?? ""}`}
        open={tasksDoc != null}
        onClose={() => setTasksDoc(null)}
        width={520}
      >
        {tasks == null || tasks.length === 0 ? (
          <EmptyState description="暂无索引任务" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {tasks.map((t) => (
              <div key={t.id} style={{ borderBottom: "1px solid #E2E8F0", paddingBottom: 12 }}>
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Space>
                    <StatusTag
                      status={t.status}
                      label={{ pending: "等待中", running: "构建中", success: "成功", failed: "失败" }[t.status] ?? t.status}
                    />
                    <span style={{ fontSize: 12, color: "#64748B" }}>
                      {t.taskType} · 版本 {t.indexVersion ?? "-"}
                    </span>
                  </Space>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>{t.finishedAt ?? t.startedAt ?? ""}</span>
                </Space>
                <div style={{ marginTop: 8 }}>
                  <ProgressBar
                    percent={t.progress ?? 0}
                    status={t.status === "success" ? "success" : t.status === "failed" ? "failed" : "processing"}
                  />
                </div>
                {t.errorMsg && (
                  <Typography.Text type="danger" style={{ fontSize: 12 }}>
                    {t.errorMsg}
                  </Typography.Text>
                )}
              </div>
            ))}
          </Space>
        )}
      </Drawer>

      {/* 片段查看 */}
      <Drawer
        title={`片段列表 · ${segmentsDoc?.docName ?? ""}`}
        open={segmentsDoc != null}
        onClose={() => setSegmentsDoc(null)}
        width={620}
      >
        <Table<KbSegment>
          rowKey="id"
          size="small"
          loading={segLoading}
          dataSource={segments ?? []}
          locale={{ emptyText: <EmptyState description="暂无片段" /> }}
          pagination={{ pageSize: 8, size: "small" }}
          columns={[
            { title: "#", dataIndex: "seqNo", width: 50 },
            {
              title: "内容",
              dataIndex: "content",
              render: (v, r) => (
                <div style={{ fontSize: 12 }}>
                  <Tag style={{ marginBottom: 4 }}>
                    {r.chapter ?? "未标注"} {r.pageNo != null ? `P${r.pageNo}` : ""}
                  </Tag>
                  <Typography.Paragraph ellipsis={{ rows: 3, expandable: true }} style={{ marginBottom: 0 }}>
                    {v}
                  </Typography.Paragraph>
                </div>
              ),
            },
          ]}
        />
      </Drawer>

      {/* 管理端试搜 */}
      <Modal
        title="知识检索试搜"
        open={searchOpen}
        onCancel={() => setSearchOpen(false)}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Form
          form={searchForm}
          layout="inline"
          initialValues={{ topK: 5, strictness: "medium" }}
          onFinish={() => runSearch()}
          style={{ marginBottom: 16 }}
        >
          <Form.Item name="query" style={{ flex: 1 }} rules={[{ required: true, message: "请输入检索问题" }]}>
            <Input placeholder="输入检索问题，如：主轴过热的常见原因" />
          </Form.Item>
          <Form.Item name="strictness">
            <Select
              style={{ width: 110 }}
              options={[
                { value: "low", label: "宽松匹配" },
                { value: "medium", label: "中等匹配" },
                { value: "high", label: "严格匹配" },
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={searching} icon={<PlayCircleOutlined />}>
            检索
          </Button>
        </Form>
        {searchHits == null ? (
          <EmptyState description="输入问题后点击检索，验证知识库效果" />
        ) : searchHits.length === 0 ? (
          <EmptyState title="未命中" description="当前知识库中未检索到相关内容，可尝试放宽匹配严格度" />
        ) : (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {searchHits.map((hit, i) => (
              <div key={i} style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: 12 }}>
                <Space style={{ justifyContent: "space-between", width: "100%" }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {i + 1}. {hit.docName}
                  </span>
                  <Tag color="cyan">相关度 {(hit.score * 100).toFixed(0)}%</Tag>
                </Space>
                <div style={{ fontSize: 12, color: "#64748B", margin: "4px 0" }}>
                  {hit.chapter ?? ""} {hit.pageNo != null ? `· 第 ${hit.pageNo} 页` : ""}
                </div>
                <Typography.Paragraph ellipsis={{ rows: 4, expandable: true }} style={{ marginBottom: 0, fontSize: 13 }}>
                  {hit.content}
                </Typography.Paragraph>
              </div>
            ))}
          </Space>
        )}
      </Modal>
    </div>
  );
}

/** 上传按钮（限制单文件） */

function UploadButton({ value, onChange }: { value?: UploadFile[]; onChange?: (v: UploadFile[]) => void }) {
  return (
    <AntUpload
      beforeUpload={() => false}
      maxCount={1}
      fileList={value}
      onChange={({ fileList }) => onChange?.(fileList)}
    >
      <Button icon={<UploadOutlined />}>选择文件</Button>
    </AntUpload>
  );
}