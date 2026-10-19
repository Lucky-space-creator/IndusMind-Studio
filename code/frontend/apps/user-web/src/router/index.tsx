import { USER_PERM } from "@hwc/shared-types";
import UserLayout from "../layouts/UserLayout";
import AlarmCenterPage from "../pages/alarm/AlarmCenterPage";
import ChatPage from "../pages/chat/ChatPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import DeviceDetailPage from "../pages/device/DeviceDetailPage";
import DeviceListPage from "../pages/device/DeviceListPage";
import DeviceOverviewPage from "../pages/device/DeviceOverviewPage";
import DiagnosisPage from "../pages/diagnosis/DiagnosisPage";
import ForbiddenPage from "../pages/ForbiddenPage";
import KnowledgeSearchPage from "../pages/knowledge/KnowledgeSearchPage";
import LoginPage from "../pages/LoginPage";
import ProfilePage from "../pages/profile/ProfilePage";
import WorkOrderPage from "../pages/workorder/WorkOrderPage";
import { RequireAuth, RequirePermission } from "./guard";

/** 用户端路由（与管理端完全隔离；权限码取自 shared-types/permission.ts） */
const routes = [
  { path: "/login", element: <LoginPage /> },
  { path: "/403", element: <ForbiddenPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <UserLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: (
          <RequirePermission codes={[USER_PERM.DASHBOARD_READ]}>
            <DashboardPage />
          </RequirePermission>
        ),
      },
      {
        path: "device",
        element: (
          <RequirePermission codes={[USER_PERM.DASHBOARD_READ]}>
            <DeviceOverviewPage />
          </RequirePermission>
        ),
      },
      {
        path: "device/list",
        element: (
          <RequirePermission codes={[USER_PERM.DASHBOARD_READ]}>
            <DeviceListPage />
          </RequirePermission>
        ),
      },
      {
        path: "device/list/:id",
        element: (
          <RequirePermission codes={[USER_PERM.DASHBOARD_READ]}>
            <DeviceDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: "alarm",
        element: (
          <RequirePermission codes={[USER_PERM.DASHBOARD_READ]}>
            <AlarmCenterPage />
          </RequirePermission>
        ),
      },
      {
        path: "diagnosis/chat",
        element: (
          <RequirePermission codes={[USER_PERM.CHAT_READ]}>
            <ChatPage />
          </RequirePermission>
        ),
      },
      {
        path: "diagnosis/run",
        element: (
          <RequirePermission codes={[USER_PERM.DIAGNOSIS_READ]}>
            <DiagnosisPage />
          </RequirePermission>
        ),
      },
      {
        path: "workorder",
        element: (
          <RequirePermission codes={[USER_PERM.WORKORDER_READ]}>
            <WorkOrderPage />
          </RequirePermission>
        ),
      },
      {
        path: "knowledge",
        element: (
          <RequirePermission codes={[USER_PERM.KNOWLEDGE_SEARCH_READ]}>
            <KnowledgeSearchPage />
          </RequirePermission>
        ),
      },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
];

export default routes;