import { PlusOutlined, SearchOutlined, SafetyOutlined } from "@ant-design/icons";
import { App, Alert, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Auth } from "@hwc/shared-auth";
import { EmptyState, Panel } from "@hwc/shared-ui";
import { ADMIN_PERM, ALL_PERMISSIONS } from "@hwc/shared-types";
import type { SysRole, SysUser } from "@hwc/shared-types";
import * as systemApi from "../../api/system";

/**
 * 账号权限区：用户 / 角色与权限矩阵 / 数据范围。
 * 后端管理接口上线前显示中文降级提示。
 */
export default function AccountPage() {
  return (
    <Tabs
      defaultActiveKey="users"
      items={[
        { key: "users", label: "用户管理", children: <UserTab /> },
        { key: "roles", label: "角色与权限矩阵", children: <RoleTab /> },
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

/* ==================== 角色与权限矩阵 ==================== */

function RoleTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SysRole | null>(null);
  const [form] = Form.useForm();

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

  const save = useMutation({
    mutationFn: async (values: Partial<SysRole> & { permissionIds?: number[] }) => {
      if (editing) await systemApi.updateRole(editing.id, values);
      else await systemApi.createRole(values);
    },
    onSuccess: () => {
      message.success("角色已保存");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
  });

  if (error) {
    return (
      <Panel title="角色与权限矩阵">
        <DegradedNotice error={error} />
        <PermissionMatrixFallback />
      </Panel>
    );
  }

  return (
    <>
      <Panel
        title="角色列表"
        extra={
          <Auth code={ADMIN_PERM.ACCOUNT_ROLE_WRITE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                form.resetFields();
                setOpen(true);
              }}
            >
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
                <Tag color={v === "admin" ? "blue" : v === "user" ? "cyan" : "geekblue"}>
                  {{ admin: "管理端", user: "用户端", both: "双端" }[v] ?? v}
                </Tag>
              ),
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
                </Auth>
              ),
            },
          ]}
        />
      </Panel>

      <Panel title="权限矩阵" subtitle="角色 × 模块 × 操作（read/write/publish/delete/export）">
        <Table
          rowKey="code"
          size="small"
          dataSource={permissions ?? []}
          locale={{ emptyText: <EmptyState description="暂无权限点" /> }}
          pagination={false}
          columns={[
            { title: "权限码", dataIndex: "code", width: 220, render: (v) => <code style={{ fontSize: 11 }}>{v}</code> },
            { title: "名称", dataIndex: "name" },
            { title: "模块", dataIndex: "module", width: 110 },
            { title: "动作", dataIndex: "action", width: 90, render: (v) => <Tag color="cyan">{v}</Tag> },
            {
              title: "所属端",
              dataIndex: "endType",
              width: 90,
              render: (v) => (v === "admin" ? "管理端" : "用户端"),
            },
          ]}
        />
      </Panel>

      <Modal
        title={editing ? "编辑角色" : "新增角色"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="code" label="角色编码" rules={[{ required: true, message: "请输入角色编码" }]}>
            <Input placeholder="如 MAINTAINER" disabled={editing?.builtIn === 1} />
          </Form.Item>
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: "请输入角色名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="endType" label="所属端" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "admin", label: "管理端" },
                { value: "user", label: "用户端" },
                { value: "both", label: "双端" },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
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
            render: (c: string) => (c.startsWith("dashboard") || ["chat", "diagnosis", "trace", "workorder"].some((m) => c.startsWith(m)) || c === "knowledge:search:read" ? "用户端" : "管理端"),
          },
        ]}
      />
    </Panel>
  );
}

/* ==================== 数据范围 ==================== */

function ScopeTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [roleId, setRoleId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const { data: roles, error: rolesError } = useQuery({
    queryKey: ["admin", "roles", "for-scope"],
    queryFn: () => systemApi.listRoles(),
    retry: false,
  });

  const { data: scopes, error: scopeError } = useQuery({
    queryKey: ["admin", "role-scopes", roleId],
    queryFn: () => systemApi.listRoleDataScopes(roleId!),
    enabled: roleId != null,
    retry: false,
  });

  const save = useMutation({
    mutationFn: (values: { scopeType: string; scopeId?: number; remark?: string }) =>
      systemApi.saveRoleDataScope(roleId!, values),
    onSuccess: () => {
      message.success("数据范围已保存");
      qc.invalidateQueries({ queryKey: ["admin", "role-scopes", roleId] });
    },
  });

  if (rolesError) {
    return (
      <Panel title="数据范围配置">
        <DegradedNotice error={rolesError} />
      </Panel>
    );
  }

  return (
    <Panel
      title="数据范围配置"
      subtitle="控制角色可见的设备/知识库范围（用户端将显示范围提示，后端强制过滤）"
      extra={
        <Select
          placeholder="选择角色"
          style={{ width: 220 }}
          options={(roles ?? []).map((r) => ({ value: r.id, label: r.name }))}
          onChange={(v) => {
            setRoleId(v);
            const s = scopes?.[0];
            form.setFieldsValue({ scopeType: s?.scopeType ?? "ALL", scopeId: s?.scopeId, remark: s?.remark });
          }}
        />
      }
    >
      {roleId == null ? (
        <EmptyState title="请选择角色" description="选择角色后配置其数据范围（全部 / 指定设备类型 / 指定设备 / 指定知识库）" />
      ) : scopeError ? (
        <DegradedNotice error={scopeError} />
      ) : (
        <Card size="small" style={{ maxWidth: 520 }}>
          <Form form={form} layout="vertical" initialValues={{ scopeType: "ALL" }} onFinish={(v) => save.mutate(v)}>
            <Form.Item name="scopeType" label="范围类型" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: "ALL", label: "全部数据" },
                  { value: "DEVICE_TYPE", label: "指定设备类型" },
                  { value: "DEVICE", label: "指定设备" },
                  { value: "KNOWLEDGE_BASE", label: "指定知识库" },
                ]}
              />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(p, c) => p.scopeType !== c.scopeType}>
              {({ getFieldValue }) =>
                getFieldValue("scopeType") !== "ALL" ? (
                  <Form.Item name="scopeId" label="范围对象 ID" rules={[{ required: true, message: "请输入范围对象 ID" }]}>
                    <Input placeholder="设备类型 ID / 设备 ID / 知识库 ID" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
            <Form.Item name="remark" label="备注">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Auth code={ADMIN_PERM.ACCOUNT_ROLE_WRITE}>
              <Button type="primary" htmlType="submit" loading={save.isPending} icon={<SafetyOutlined />}>
                保存范围
              </Button>
            </Auth>
          </Form>
          {scopes && scopes.length > 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              当前范围：{scopes[0].scopeType} / {scopes[0].scopeId ?? "-"}
              {scopes[0].remark ? `（${scopes[0].remark}）` : ""}
            </Typography.Text>
          )}
        </Card>
      )}
    </Panel>
  );
}