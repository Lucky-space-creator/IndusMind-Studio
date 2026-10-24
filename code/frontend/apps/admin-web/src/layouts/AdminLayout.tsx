import {
  AppstoreOutlined,
  AuditOutlined,
  BookOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ShareAltOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Breadcrumb, Button, Dropdown, Layout, Menu, Modal, Space, Tag, theme } from "antd";
import { useMemo, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { buildPermissionDetails, useAuthStore, usePermission } from "@hwc/shared-auth";
import { PermissionList } from "@hwc/shared-ui";
import { listPermissions } from "../api/system";
import { ADMIN_MENUS } from "./menus";

const ICONS: Record<string, ReactNode> = {
  AppstoreOutlined: <AppstoreOutlined />,
  BookOutlined: <BookOutlined />,
  ShareAltOutlined: <ShareAltOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  RobotOutlined: <RobotOutlined />,
  CloudUploadOutlined: <CloudUploadOutlined />,
  TeamOutlined: <TeamOutlined />,
  AuditOutlined: <AuditOutlined />,
};

/** 管理端布局：侧边导航 200px（可收起 80px）+ 顶栏 + 面包屑（AntD Layout 规范） */
export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { filterMenus, dataScopeText } = usePermission();
  const realName = useAuthStore((s) => s.realName);
  const username = useAuthStore((s) => s.username);
  const roles = useAuthStore((s) => s.roles);
  const permissionDetails = useAuthStore((s) => s.permissionDetails);
  const permissions = useAuthStore((s) => s.permissions);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [permOpen, setPermOpen] = useState(false);
  const { token } = theme.useToken();

  const visibleMenus = filterMenus(ADMIN_MENUS);
  const selectedKey =
    ADMIN_MENUS.find((m) => location.pathname.startsWith(m.path ?? ""))?.key ?? "";
  const currentMenu = ADMIN_MENUS.find((m) => m.key === selectedKey);

  /**
   * 明细兜底：后端旧版本（`/auth/profile` 未下发 permissionDetails）时，
   * 权限码仍然是准确的，用权限字典把它还原成可读清单，避免"有权限却显示 0 项"。
   */
  const needDetailFallback = permissionDetails.length === 0 && permissions.length > 0;
  const { data: allPermissions } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: () => listPermissions(),
    enabled: needDetailFallback,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const details = useMemo(
    () =>
      permissionDetails.length > 0
        ? permissionDetails
        : buildPermissionDetails(permissions, allPermissions),
    [permissionDetails, permissions, allPermissions],
  );

  if (!visibleMenus.length) {
    return <Navigate to="/403" replace />;
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider
        width={200}
        breakpoint="lg"
        collapsedWidth={80}
        style={{ background: "#0F2437", position: "sticky", top: 0, height: "100vh", overflow: "auto" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 64,
            padding: "0 16px",
            color: "#fff",
            borderBottom: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: "#0E6E8C",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            HW
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>设备运维管理端</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={visibleMenus.map((m) => ({
            key: m.key,
            icon: ICONS[m.icon ?? ""],
            label: m.title,
          }))}
          onClick={({ key }) => {
            const menu = ADMIN_MENUS.find((m) => m.key === key);
            if (menu?.path) navigate(menu.path);
          }}
          style={{ background: "transparent", borderInlineEnd: "none", paddingTop: 8 }}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 64,
            padding: "0 24px",
            background: "#fff",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <Space size={12} align="center">
            <Breadcrumb
              items={[{ title: "管理端" }, { title: currentMenu?.title ?? "" }]}
            />
            <Tag color="cyan" style={{ marginInlineEnd: 0 }}>
              数据范围：{dataScopeText}
            </Tag>
          </Space>
          <Space size={16}>
            <Tag bordered={false} color="blue">
              环境：开发
            </Tag>
            <Dropdown
              menu={{
                items: [
                  {
                    key: "permissions",
                    icon: <SafetyCertificateOutlined />,
                    label: `我的权限（${details.length}）`,
                    onClick: () => setPermOpen(true),
                  },
                  {
                    key: "logout",
                    icon: <LogoutOutlined />,
                    label: "退出登录",
                    onClick: () => {
                      clearAuth();
                      navigate("/login", { replace: true });
                    },
                  },
                ],
              }}
            >
              <Button type="text" style={{ height: 44 }}>
                <Space size={8}>
                  <Avatar size={28} icon={<UserOutlined />} style={{ background: "#0E6E8C" }} />
                  <span>{realName || username}</span>
                  {roles.length > 0 && (
                    <span style={{ color: token.colorTextTertiary, fontSize: 12 }}>{roles.join(" / ")}</span>
                  )}
                </Space>
              </Button>
            </Dropdown>
          </Space>
        </Layout.Header>
        <Layout.Content style={{ padding: 20, background: "#F5F7FA", overflow: "auto" }}>
          <Outlet />
        </Layout.Content>

        {/* 我的权限：Modal 由 portal 渲染到 body，放在 Layout 内不影响布局 */}
        <Modal
          title="我的权限"
          open={permOpen}
          onCancel={() => setPermOpen(false)}
          footer={null}
          width={780}
          styles={{ body: { maxHeight: "64vh", overflow: "auto" } }}
        >
          <div style={{ marginBottom: 12, fontSize: 12, color: token.colorTextSecondary }}>
            角色：{roles.length ? roles.join(" / ") : "-"} · 共 {details.length} 项 · 管理员调整权限后自动同步
          </div>
          <PermissionList
            items={details}
            showCode
            emptyHint={
              permissions.length > 0
                ? "已获得权限，正在还原权限明细（权限字典加载中，稍候自动补齐）"
                : "当前账号暂无已授权的权限点，请联系管理员分配角色"
            }
          />
        </Modal>
      </Layout>
    </Layout>
  );
}