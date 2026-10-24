import { ConfigProvider, App as AntApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PermissionProvider } from "@hwc/shared-auth";
import { AppErrorBoundary, SkeletonStyle } from "@hwc/shared-ui";
import { HashRouter, useRoutes } from "react-router-dom";
import routes from "./router";
import { wireApi } from "./api/wire";

wireApi();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Root() {
  return useRoutes(routes);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#0E6E8C",
          colorInfo: "#0E6E8C",
          borderRadius: 6,
          fontSize: 14,
        },
      }}
    >
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <PermissionProvider end="admin" onPermissionsChanged={() => queryClient.invalidateQueries()}>
            <HashRouter>
              <SkeletonStyle />
              <AppErrorBoundary>
                <Root />
              </AppErrorBoundary>
            </HashRouter>
          </PermissionProvider>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);