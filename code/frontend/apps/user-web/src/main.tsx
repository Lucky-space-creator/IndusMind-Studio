import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, useRoutes } from "react-router-dom";
import { PermissionProvider } from "@hwc/shared-auth";
import { AppErrorBoundary, SkeletonStyle } from "@hwc/shared-ui";
import { ToastHost } from "./components/Toast";
import routes from "./router";
import { wireApi } from "./api/wire";
import "./index.css";

wireApi();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Root() {
  return useRoutes(routes);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PermissionProvider end="user" onPermissionsChanged={() => queryClient.invalidateQueries()}>
        <HashRouter>
          <SkeletonStyle />
          <AppErrorBoundary>
            <Root />
          </AppErrorBoundary>
          <ToastHost />
        </HashRouter>
      </PermissionProvider>
    </QueryClientProvider>
  </StrictMode>,
);