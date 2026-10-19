import {
  AppstoreOutlined,
  AuditOutlined,
  BookOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  RobotOutlined,
  ShareAltOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Breadcrumb, Button, Dropdown, Layout, Menu, Space, Tag, theme } from "antd";
import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore, usePermission } from "@hwc/shared-auth";
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
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { token } = theme.useToken();

  const visibleMenus = filterMenus(ADMIN_MENUS);
  const selectedKey =
    ADMIN_MENUS.find((m) => location.pathname.startsWith(m.path ?? ""))?.key ?? "";
  const currentMenu = ADMIN_MENUS.find((m) => m.key === selectedKey);

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
      </Layout>
    </Layout>
  );
}