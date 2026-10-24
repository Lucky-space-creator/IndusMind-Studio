import { USER_PERM } from "@hwc/shared-types";
import { Navigate } from "react-router-dom";
import { usePermission } from "@hwc/shared-auth";
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
import NotFoundPage from "../pages/NotFoundPage";
import ProfilePage from "../pages/profile/ProfilePage";
import WorkOrderPage from "../pages/workorder/WorkOrderPage";
import { RequireAuth, RequirePermission } from "./guard";

/**
 * 「智能诊断」一级导航落地页：按权限落到具体子页。
 * 导航指向 /diagnosis，若不重定向会因无匹配路由导致整页空白。
 */
function DiagnosisEntry() {
  const { has } = usePermission();
  return <Navigate to={has(USER_PERM.DIAGNOSIS_READ) ? "/diagnosis/run" : "/diagnosis/chat"} replace />;
}

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
        path: "diagnosis",
        element: <DiagnosisEntry />,
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
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
];

export default routes;