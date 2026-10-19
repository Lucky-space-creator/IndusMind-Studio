import { ADMIN_PERM } from "@hwc/shared-types";
import AdminLayout from "../layouts/AdminLayout";
import AgentPage from "../pages/agent/AgentPage";
import AuditPage from "../pages/audit/AuditPage";
import DataPage from "../pages/data/DataPage";
import DevicePage from "../pages/device/DevicePage";
import DocGraphPage from "../pages/docgraph/DocGraphPage";
import ForbiddenPage from "../pages/ForbiddenPage";
import KnowledgePage from "../pages/knowledge/KnowledgePage";
import LoginPage from "../pages/login/LoginPage";
import PublishPage from "../pages/publish/PublishPage";
import AccountPage from "../pages/account/AccountPage";
import { RequireAuth, RequirePermission } from "./guard";

const routes = [
  { path: "/login", element: <LoginPage /> },
  { path: "/403", element: <ForbiddenPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: (
          <RequirePermission codes={[ADMIN_PERM.DEVICE_TYPE_READ]}>
            <DevicePage />
          </RequirePermission>
        ),
      },
      {
        path: "device",
        element: (
          <RequirePermission
            codes={[ADMIN_PERM.DEVICE_TYPE_READ, ADMIN_PERM.DEVICE_INFO_READ, ADMIN_PERM.DEVICE_METRIC_READ]}
          >
            <DevicePage />
          </RequirePermission>
        ),
      },
      {
        path: "knowledge",
        element: (
          <RequirePermission codes={[ADMIN_PERM.KB_READ, ADMIN_PERM.KB_DOCUMENT_READ]}>
            <KnowledgePage />
          </RequirePermission>
        ),
      },
      {
        path: "docgraph",
        element: (
          <RequirePermission codes={[ADMIN_PERM.DOCGRAPH_READ]}>
            <DocGraphPage />
          </RequirePermission>
        ),
      },
      {
        path: "data",
        element: (
          <RequirePermission codes={[ADMIN_PERM.DATA_DATASET_READ]}>
            <DataPage />
          </RequirePermission>
        ),
      },
      {
        path: "agent",
        element: (
          <RequirePermission codes={[ADMIN_PERM.AGENT_DEFINITION_READ, ADMIN_PERM.AGENT_FLOW_READ]}>
            <AgentPage />
          </RequirePermission>
        ),
      },
      {
        path: "publish",
        element: (
          <RequirePermission codes={[ADMIN_PERM.PUBLISH_SERVICE_READ]}>
            <PublishPage />
          </RequirePermission>
        ),
      },
      {
        path: "account",
        element: (
          <RequirePermission codes={[ADMIN_PERM.ACCOUNT_USER_READ, ADMIN_PERM.ACCOUNT_ROLE_READ]}>
            <AccountPage />
          </RequirePermission>
        ),
      },
      {
        path: "audit",
        element: (
          <RequirePermission codes={[ADMIN_PERM.AUDIT_LOG_READ]}>
            <AuditPage />
          </RequirePermission>
        ),
      },
    ],
  },
];

export default routes;