import { PlusOutlined, SearchOutlined, SafetyOutlined } from "@ant-design/icons";
import { App, Alert, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, Tree, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { DataNode } from "antd/es/tree";
import { useEffect, useMemo, useState, type Key } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Auth, refreshProfile } from "@hwc/shared-auth";
import { EmptyState, Panel } from "@hwc/shared-ui";
import { ADMIN_PERM, ALL_PERMISSIONS } from "@hwc/shared-types";
import type { DevInfo, DevType, KbKnowledgeBase, SysPermission, SysRole, SysUser } from "@hwc/shared-types";
import * as deviceApi from "../../api/device";
import * as kbApi from "../../api/knowledge";
import * as systemApi from "../../api/system";

/**
 * 账号权限区：用户 / 角色与权限树 / 数据范围。
 * 角色编辑内嵌可勾选权限树（父子联动），数据范围全部使用下拉选择，无需手填 ID。
 */
export default function AccountPage() {
  return (
    <Tabs
      defaultActiveKey="users"
      items={[
        { key: "users", label: "用户管理", children: <UserTab /> },
        { key: "roles", label: "角色与权限", children: <RoleTab /> },
        { key: "scope", label: "数据范围", children: <ScopeTab /> },
      ]}
    />
  );
}

function DegradedNotice({ error }: { error: unknown }) {
  return (
    <Alert
      type="warning"
      showIcon
      message="账号管理接口暂未开放"
      description={
        <>
          <p style={{ margin: 0 }}>
            后端 hwc-security 当前仅提供登录接口，用户/角色/权限矩阵管理接口尚未实现；
            页面按接口契约已就绪，接口上线后即可直接使用。
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748B" }}>
            请求失败原因：{error instanceof Error ? error.message : "网络异常"}
          </p>
        </>
      }
    />
  );
}

/* ==================== 用户管理 ==================== */

function UserTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SysUser | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users", page, keyword],
    queryFn: () => systemApi.pageUsers({ current: page, size: 10, keyword: keyword || undefined }),
    retry: false,
  });

  const { data: roles } = useQuery({
    queryKey: ["admin", "roles", "for-user"],
    queryFn: () => systemApi.listRoles(),
    retry: false,
  });

  const save = useMutation({
    mutationFn: async (values: Partial<SysUser> & { password?: string; roleIds?: number[] }) => {
      if (editing) await systemApi.updateUser(editing.id, values);
      else await systemApi.createUser(values);
    },
    onSuccess: () => {
      message.success("用户已保存");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      // 改到自己的角色时，菜单与按钮需要立即跟随
      void refreshProfile({ force: true });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => systemApi.deleteUser(id),
    onSuccess: () => {
      message.success("用户已删除");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  if (error) {
    return (
      <Panel title="用户管理">
        <DegradedNotice error={error} />
      </Panel>
    );
  }

  const columns: ColumnsType<SysUser> = [
    { title: "账号", dataIndex: "username", width: 120 },
    { title: "昵称", dataIndex: "nickname" },
    { title: "手机号", dataIndex: "phone", width: 130 },
    { title: "邮箱", dataIndex: "email", ellipsis: true },
    {
      title: "状态",
      dataIndex: "status",
      width: 80,
      render: (v) => (v === 1 ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
    },
    { title: "最近登录", dataIndex: "lastLoginTime", width: 170 },
    {
      title: "操作",
      width: 150,
      render: (_, record) => (
        <Auth code={ADMIN_PERM.ACCOUNT_USER_WRITE}>
          <Space size={0}>
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
            <Auth code={ADMIN_PERM.ACCOUNT_USER_DELETE}>
              <Popconfirm title="确认删除该用户？" onConfirm={() => remove.mutate(record.id)}>
                <Button type="link" size="small" danger>
                  删除
                </Button>
              </Popconfirm>
            </Auth>
          </Space>
        </Auth>
      ),
    },
  ];

  return (
    <Panel
      title="用户管理"
      extra={
        <Space>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="按账号/昵称搜索"
            style={{ width: 200 }}
            onPressEnter={(e) => {
              setKeyword((e.target as HTMLInputElement).value);
              setPage(1);
            }}
            onChange={(e) => !e.target.value && setKeyword("")}
          />
          <Auth code={ADMIN_PERM.ACCOUNT_USER_WRITE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                form.resetFields();
                setOpen(true);
              }}
            >
              新增用户
            </Button>
          </Auth>
        </Space>
      }
    >
      <Table<SysUser>
        rowKey="id"
        size="middle"
        loading={isLoading}
        columns={columns}
        dataSource={data?.records ?? []}
        locale={{ emptyText: <EmptyState description="暂无用户" /> }}
        pagination={{
          current: page,
          pageSize: 10,
          total: data?.total ?? 0,
          showTotal: (t) => `共 ${t} 条`,
          onChange: setPage,
        }}
      />
      <Modal
        title={editing ? "编辑用户" : "新增用户"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="username" label="账号" rules={[{ required: true, message: "请输入账号" }]}>
            <Input disabled={editing != null} />
          </Form.Item>
          {!editing && (
            <Form.Item name="password" label="初始密码" rules={[{ required: true, message: "请输入初始密码" }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="nickname" label="昵称">
            <Input />
          </Form.Item>
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item name="phone" label="手机号" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="邮箱" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="roleIds" label="角色">
            <Select
              mode="multiple"
              options={(roles ?? []).map((r) => ({ value: r.id, label: `${r.name}（${r.endType}）` }))}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue={1} valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </Panel>
  );
}

/* ==================== 角色与权限树 ==================== */

const ACTION_LABEL: Record<string, string> = {
  read: "查看",
  write: "编辑",
  publish: "发布",
  delete: "删除",
  export: "导出",
};

const MODULE_LABEL: Record<string, string> = {
  device: "设备配置",
  knowledge: "知识库",
  docgraph: "文档关联",
  data: "设备数据",
  agent: "Agent 与流程",
  publish: "服务发布",
  audit: "审计日志",
  account: "账号权限",
  dashboard: "设备看板",
  chat: "智能问答",
  diagnosis: "智能诊断",
  trace: "故障溯源",
  workorder: "工单",
};

const END_LABEL: Record<string, string> = { admin: "管理端", user: "用户端", both: "双端" };

const PERM_PREFIX = "perm:";

/** 从 Tree 的 key 中还原权限点 ID（非权限叶子返回 null） */
function permIdOf(key: Key): number | null {
  const text = String(key);
  if (!text.startsWith(PERM_PREFIX)) return null;
  const id = Number(text.slice(PERM_PREFIX.length));
  return Number.isFinite(id) ? id : null;
}

/** 按「端 → 模块 → 权限点」三层构建权限树 */
function buildPermissionTree(list: SysPermission[]): DataNode[] {
  const groups = new Map<string, Map<string, SysPermission[]>>();
  for (const p of list) {
    const end = p.endType === "user" ? "user" : "admin";
    if (!groups.has(end)) groups.set(end, new Map());
    const byModule = groups.get(end)!;
    if (!byModule.has(p.module)) byModule.set(p.module, []);
    byModule.get(p.module)!.push(p);
  }
  return ["admin", "user"]
    .filter((end) => groups.has(end))
    .map((end) => {
      const byModule = groups.get(end)!;
      const total = Array.from(byModule.values()).reduce((n, arr) => n + arr.length, 0);
      return {
        key: `end:${end}`,
        title: `${END_LABEL[end] ?? end}（${total}）`,
        children: Array.from(byModule.entries()).map(([module, items]) => ({
          key: `mod:${end}:${module}`,
          title: `${MODULE_LABEL[module] ?? module}（${items.length}）`,
          children: items
            .slice()
            .sort((a, b) => a.sort - b.sort)
            .map((p) => ({
              key: `${PERM_PREFIX}${p.id}`,
              title: (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {p.name}
                  <Tag color="cyan" style={{ marginInlineEnd: 0 }}>
                    {ACTION_LABEL[p.action] ?? p.action}
                  </Tag>
                </span>
              ),
            })),
        })),
      };
    });
}

function RoleTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SysRole | null>(null);
  const [form] = Form.useForm();
  /** 已勾选的权限点 ID */
  const [permIds, setPermIds] = useState<number[]>([]);
  const [permKeyword, setPermKeyword] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  /** 当前编辑角色的所属端，用于过滤权限树（both 时显示两端） */
  const [endType, setEndType] = useState("user");

  const { data: roles, isLoading, error } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => systemApi.listRoles(),
    retry: false,
  });

  const { data: permissions } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: () => systemApi.listPermissions(),
    retry: false,
  });

  /** 搜索命中并可见的权限点（勾选合并时用于判断"不可见但已选"） */
  const visiblePermissions = useMemo(() => {
    const kw = permKeyword.trim().toLowerCase();
    return (permissions ?? []).filter((p) => {
      // 按角色所属端过滤，避免把管理端权限配到用户端角色上（both 时两端都显示）
      if (endType !== "both" && p.endType !== endType) return false;
      if (!kw) return true;
      return (
        p.name.toLowerCase().includes(kw) ||
        p.code.toLowerCase().includes(kw) ||
        p.module.toLowerCase().includes(kw)
      );
    });
  }, [permissions, permKeyword, endType]);

  const permissionTree = useMemo(() => buildPermissionTree(visiblePermissions), [visiblePermissions]);

  /** 数据或搜索变化时自动展开全部分组 */
  const allGroupKeys = useMemo(
    () =>
      permissionTree.flatMap((node) => [
        node.key,
        ...(node.children ?? []).map((child) => child.key),
      ]),
    [permissionTree],
  );
  useEffect(() => {
    setExpandedKeys(allGroupKeys);
  }, [allGroupKeys]);

  const save = useMutation({
    mutationFn: async (values: Partial<SysRole> & { permissionIds?: number[] }) => {
      if (editing) await systemApi.updateRole(editing.id, values);
      else await systemApi.createRole(values);
    },
    onSuccess: () => {
      message.success("角色与权限已保存");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      // 权限改动可能落在当前登录账号上，立即同步界面（菜单/按钮/数据范围）
      void refreshProfile({ force: true });
    },
  });

  if (error) {
    return (
      <Panel title="角色与权限">
        <DegradedNotice error={error} />
        <PermissionMatrixFallback />
      </Panel>
    );
  }

  const openEditor = (record: SysRole | null) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue(record ?? { endType: "user" });
    setPermIds(record?.permissionIds ?? []);
    setPermKeyword("");
    setEndType(record?.endType ?? "user");
    setOpen(true);
  };

  const handleCheck = (keys: Key[] | { checked: Key[]; halfChecked: Key[] }) => {
    const raw = Array.isArray(keys) ? keys : keys.checked;
    const visibleIds = new Set(visiblePermissions.map((p) => p.id));
    // 被搜索条件过滤掉、当前不可见的权限，保持其原有勾选状态
    const kept = permIds.filter((id) => !visibleIds.has(id));
    const picked = raw.map(permIdOf).filter((id): id is number => id != null);
    setPermIds(Array.from(new Set([...kept, ...picked])));
  };

  const selectAllVisible = () => {
    const visibleIds = visiblePermissions.map((p) => p.id);
    setPermIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const clearVisible = () => {
    const visibleIds = new Set(visiblePermissions.map((p) => p.id));
    setPermIds((prev) => prev.filter((id) => !visibleIds.has(id)));
  };

  return (
    <>
      <Panel
        title="角色列表"
        extra={
          <Auth code={ADMIN_PERM.ACCOUNT_ROLE_WRITE}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor(null)}>
              新增角色
            </Button>
          </Auth>
        }
      >
        <Table<SysRole>
          rowKey="id"
          size="middle"
          loading={isLoading}
          dataSource={roles ?? []}
          locale={{ emptyText: <EmptyState description="暂无角色" /> }}
          pagination={false}
          columns={[
            { title: "编码", dataIndex: "code", width: 140 },
            { title: "名称", dataIndex: "name", width: 140 },
            {
              title: "所属端",
              dataIndex: "endType",
              width: 100,
              render: (v: string) => (
                <Tag color={v === "admin" ? "blue" : v === "user" ? "cyan" : "geekblue"}>{END_LABEL[v] ?? v}</Tag>
              ),
            },
            {
              title: "已授权限",
              dataIndex: "permissionIds",
              width: 110,
              render: (ids?: number[]) => <Tag color={ids?.length ? "green" : "default"}>{ids?.length ?? 0} 项</Tag>,
            },
            { title: "说明", dataIndex: "description", ellipsis: true },
            {
              title: "内置",
              dataIndex: "builtIn",
              width: 70,
              render: (v) => (v === 1 ? <Tag>内置</Tag> : "-"),
            },
            {
              title: "操作",
              width: 90,
              render: (_, record) => (
                <Auth code={ADMIN_PERM.ACCOUNT_ROLE_WRITE}>
                  <Button type="link" size="small" onClick={() => openEditor(record)}>
                    编辑
                  </Button>
                </Auth>
              ),
            },
          ]}
        />
      </Panel>

      <Panel title="权限点清单" subtitle="只读参考，实际授权在「角色列表 → 编辑」中通过权限树配置">
        <Table
          rowKey="code"
          size="small"
          dataSource={permissions ?? []}
          locale={{ emptyText: <EmptyState description="暂无权限点" /> }}
          pagination={false}
          columns={[
            { title: "权限码", dataIndex: "code", width: 220, render: (v) => <code style={{ fontSize: 11 }}>{v}</code> },
            { title: "名称", dataIndex: "name" },
            { title: "模块", dataIndex: "module", width: 110, render: (v: string) => MODULE_LABEL[v] ?? v },
            {
              title: "动作",
              dataIndex: "action",
              width: 90,
              render: (v: string) => <Tag color="cyan">{ACTION_LABEL[v] ?? v}</Tag>,
            },
            {
              title: "所属端",
              dataIndex: "endType",
              width: 90,
              render: (v: string) => END_LABEL[v] ?? v,
            },
          ]}
        />
      </Panel>

      <Modal
        title={editing ? `编辑角色 · ${editing.name}` : "新增角色"}
        open={open}
        width={720}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        forceRender
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => save.mutate({ ...values, permissionIds: permIds })}
        >
          <Space size={12} style={{ display: "flex" }}>
            <Form.Item
              name="code"
              label="角色编码"
              style={{ flex: 1 }}
              rules={[{ required: true, message: "请输入角色编码" }]}
            >
              <Input placeholder="如 MAINTAINER" disabled={editing?.builtIn === 1} />
            </Form.Item>
            <Form.Item
              name="name"
              label="角色名称"
              style={{ flex: 1 }}
              rules={[{ required: true, message: "请输入角色名称" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="endType" label="所属端" style={{ width: 130 }} rules={[{ required: true }]}>
              <Select
                options={[
                  { value: "admin", label: "管理端" },
                  { value: "user", label: "用户端" },
                  { value: "both", label: "双端" },
                ]}
                // 切换所属端后，另一端权限在树中不可见，一并清理避免"隐形配置"
                onChange={(value: string) => {
                  setEndType(value);
                  setPermIds((prev) =>
                    prev.filter((id) => {
                      const perm = (permissions ?? []).find((p) => p.id === id);
                      return !perm || value === "both" || perm.endType === value;
                    }),
                  );
                }}
              />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item
            label={
              <span>
                权限授权
                <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  已选 {permIds.length} 项 · 仅显示「{END_LABEL[endType] ?? endType}」的权限点
                  {editing?.builtIn === 1 ? "（内置角色，调整将影响其全部用户）" : ""}
                </Typography.Text>
              </span>
            }
          >
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Space wrap>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="搜索权限名称 / 编码 / 模块"
                  style={{ width: 260 }}
                  value={permKeyword}
                  onChange={(e) => setPermKeyword(e.target.value)}
                />
                <Button size="small" onClick={selectAllVisible}>
                  全选当前
                </Button>
                <Button size="small" onClick={clearVisible}>
                  清空当前
                </Button>
                <Button size="small" danger onClick={() => setPermIds([])}>
                  清空全部
                </Button>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  勾选模块可整组授权
                </Typography.Text>
              </Space>
              <div
                style={{
                  maxHeight: 300,
                  overflow: "auto",
                  border: "1px solid #E2E8F0",
                  borderRadius: 6,
                  padding: "8px 10px",
                }}
              >
                {permissionTree.length === 0 ? (
                  <EmptyState description={permKeyword ? "没有匹配的权限点" : "暂无权限点"} />
                ) : (
                  <Tree
                    checkable
                    selectable={false}
                    treeData={permissionTree}
                    checkedKeys={permIds.map((id) => `${PERM_PREFIX}${id}`)}
                    expandedKeys={expandedKeys}
                    onExpand={(keys) => setExpandedKeys(keys)}
                    onCheck={handleCheck}
                  />
                )}
              </div>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

/** 接口未开放时的权限矩阵静态参考（与后端 sys_permission 初始化一致） */
function PermissionMatrixFallback() {
  return (
    <Panel title="权限点参考（静态）" subtitle="与后端 sys_permission 初始化数据一致">
      <Table
        rowKey={(c) => c}
        size="small"
        dataSource={ALL_PERMISSIONS as unknown as string[]}
        pagination={false}
        columns={[
          {
            title: "权限码",
            render: (c: string) => <code style={{ fontSize: 11 }}>{c}</code>,
          },
          {
            title: "所属端",
            width: 90,
            render: (c: string) =>
              c.startsWith("dashboard") ||
              ["chat", "diagnosis", "trace", "workorder"].some((m) => c.startsWith(m)) ||
              c === "knowledge:search:read"
                ? "用户端"
                : "管理端",
          },
        ]}
      />
    </Panel>
  );
}

/* ==================== 数据范围 ==================== */

const SCOPE_TYPE_OPTIONS = [
  { value: "ALL", label: "全部数据" },
  { value: "DEVICE_TYPE", label: "指定设备类型" },
  { value: "DEVICE", label: "指定设备" },
  { value: "KNOWLEDGE_BASE", label: "指定知识库" },
];

const SCOPE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  SCOPE_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

function ScopeTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [roleId, setRoleId] = useState<number | null>(null);
  const [form] = Form.useForm();
  /** 当前范围类型（驱动下拉数据源的加载，与表单值保持同步） */
  const [scopeType, setScopeType] = useState("ALL");

  const { data: roles, error: rolesError } = useQuery({
    queryKey: ["admin", "roles", "for-scope"],
    queryFn: () => systemApi.listRoles(),
    retry: false,
  });

  const { data: scopes, error: scopeError, isLoading: scopeLoading } = useQuery({
    queryKey: ["admin", "role-scopes", roleId],
    queryFn: () => systemApi.listRoleDataScopes(roleId!),
    enabled: roleId != null,
    retry: false,
  });

  // 范围对象候选：按当前选择的类型按需加载，用户无需记忆任何 ID
  const needDevType = roleId != null && scopeType === "DEVICE_TYPE";
  const needDevice = roleId != null && scopeType === "DEVICE";
  const needKb = roleId != null && scopeType === "KNOWLEDGE_BASE";

  const { data: devTypes, isLoading: devTypesLoading } = useQuery({
    queryKey: ["admin", "dev-types", "for-scope"],
    queryFn: () => deviceApi.pageTypes({ current: 1, size: 500 }),
    enabled: needDevType,
    staleTime: 60_000,
  });

  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ["admin", "devices", "for-scope"],
    queryFn: () => deviceApi.pageDevices({ current: 1, size: 500 }),
    enabled: needDevice,
    staleTime: 60_000,
  });

  const { data: kbs, isLoading: kbsLoading } = useQuery({
    queryKey: ["admin", "kbs", "for-scope"],
    queryFn: () => kbApi.pageKbs({ current: 1, size: 500 }),
    enabled: needKb,
    staleTime: 60_000,
  });

  /** 回显当前角色的数据范围（等接口返回后再填，避免用到上一个角色的旧数据） */
  useEffect(() => {
    if (roleId == null || scopes == null) return;
    const first = scopes[0];
    const nextType = first?.scopeType ?? "ALL";
    setScopeType(nextType);
    form.setFieldsValue({
      scopeType: nextType,
      scopeIds: scopes.map((s) => s.scopeId).filter((id) => id > 0),
      remark: first?.remark,
    });
  }, [scopes, roleId, form]);

  const save = useMutation({
    mutationFn: (values: { scopeType: string; scopeIds?: number[]; remark?: string }) =>
      systemApi.saveRoleDataScope(roleId!, {
        scopeType: values.scopeType,
        scopeIds: values.scopeType === "ALL" ? [] : values.scopeIds ?? [],
        remark: values.remark,
      }),
    onSuccess: () => {
      message.success("数据范围已保存");
      qc.invalidateQueries({ queryKey: ["admin", "role-scopes", roleId] });
      // 数据范围变化会影响知识库/设备可见性提示与列表，立即同步
      void refreshProfile({ force: true });
    },
  });

  if (rolesError) {
    return (
      <Panel title="数据范围配置">
        <DegradedNotice error={rolesError} />
      </Panel>
    );
  }

  const scopeOptions = (() => {
    if (scopeType === "DEVICE_TYPE") {
      return (devTypes?.records ?? []).map((t: DevType) => ({
        value: t.id,
        label: t.code ? `${t.name}（${t.code}）` : t.name,
      }));
    }
    if (scopeType === "DEVICE") {
      return (devices?.records ?? []).map((d: DevInfo) => ({
        value: d.id,
        label: `${d.name}${d.code ? `（${d.code}）` : ""}${d.lineName ? ` · ${d.lineName}` : ""}`,
      }));
    }
    if (scopeType === "KNOWLEDGE_BASE") {
      return (kbs?.records ?? []).map((k: KbKnowledgeBase) => ({ value: k.id, label: k.name }));
    }
    return [];
  })();

  const scopeOptionsLoading =
    (needDevType && devTypesLoading) ||
    (needDevice && devicesLoading) ||
    (needKb && kbsLoading) ||
    false;

  /** 把范围 ID 翻译成名称（当前类型的数据已随下拉一起加载） */
  const scopeNameOf = (type: string, id: number) => {
    if (type === "ALL") return "全部数据";
    const found = scopeOptions.find((o) => o.value === id && type === scopeType);
    if (found) return found.label;
    if (type === "DEVICE_TYPE") return devTypes?.records.find((t) => t.id === id)?.name ?? `设备类型 #${id}`;
    if (type === "DEVICE") return devices?.records.find((d) => d.id === id)?.name ?? `设备 #${id}`;
    if (type === "KNOWLEDGE_BASE") return kbs?.records.find((k) => k.id === id)?.name ?? `知识库 #${id}`;
    return `#${id}`;
  };

  const objectLabel =
    scopeType === "DEVICE_TYPE" ? "选择设备类型" : scopeType === "DEVICE" ? "选择设备" : "选择知识库";

  return (
    <Panel
      title="数据范围配置"
      subtitle="控制角色可见的设备/知识库范围（后端强制过滤，用户端同步生效）"
      extra={
        <Select
          placeholder="选择角色"
          style={{ width: 220 }}
          showSearch
          optionFilterProp="label"
          value={roleId}
          options={(roles ?? []).map((r) => ({ value: r.id, label: `${r.name}（${END_LABEL[r.endType] ?? r.endType}）` }))}
          onChange={(v) => {
            setRoleId(v);
            setScopeType("ALL");
          }}
        />
      }
    >
      {roleId == null ? (
        <EmptyState
          title="请选择角色"
          description="选择角色后配置其数据范围（全部 / 指定设备类型 / 指定设备 / 指定知识库）"
        />
      ) : scopeError ? (
        <DegradedNotice error={scopeError} />
      ) : (
        <Card size="small" loading={scopeLoading} style={{ maxWidth: 620 }}>
          <Form
            form={form}
            layout="vertical"
            initialValues={{ scopeType: "ALL", scopeIds: [] }}
            onFinish={(v) => save.mutate(v)}
          >
            <Form.Item name="scopeType" label="范围类型" rules={[{ required: true }]}>
              <Select
                options={SCOPE_TYPE_OPTIONS}
                // 类型切换后对象类型完全不同，清空已选，避免残留无效 ID
                onChange={(value: string) => {
                  setScopeType(value);
                  form.setFieldValue("scopeIds", []);
                }}
              />
            </Form.Item>
            {scopeType !== "ALL" && (
              <Form.Item
                name="scopeIds"
                label={objectLabel}
                rules={[{ required: true, message: `请${objectLabel}` }]}
                extra="可多选；留空则视为未授权（该角色看不到任何数据）"
              >
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder={`${objectLabel}，支持搜索与多选`}
                  options={scopeOptions}
                  loading={scopeOptionsLoading}
                  notFoundContent={scopeOptionsLoading ? "加载中…" : "暂无可选项，请先在对应模块维护数据"}
                />
              </Form.Item>
            )}
            <Form.Item name="remark" label="备注">
              <Input.TextArea rows={2} placeholder="可选，说明该范围的用途" />
            </Form.Item>
            <Auth code={ADMIN_PERM.ACCOUNT_ROLE_WRITE}>
              <Button type="primary" htmlType="submit" loading={save.isPending} icon={<SafetyOutlined />}>
                保存范围
              </Button>
            </Auth>
          </Form>

          {scopes && scopes.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #E2E8F0" }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                当前生效范围：
              </Typography.Text>
              <div style={{ marginTop: 6 }}>
                {scopes.map((s) => (
                  <Tag key={s.id} color={s.scopeType === "ALL" ? "green" : "blue"} style={{ marginBottom: 4 }}>
                    {SCOPE_TYPE_LABEL[s.scopeType] ?? s.scopeType}
                    {s.scopeType !== "ALL" ? ` · ${scopeNameOf(s.scopeType, s.scopeId)}` : ""}
                  </Tag>
                ))}
              </div>
              {scopes[0].remark && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  备注：{scopes[0].remark}
                </Typography.Text>
              )}
            </div>
          )}
        </Card>
      )}
    </Panel>
  );
}
