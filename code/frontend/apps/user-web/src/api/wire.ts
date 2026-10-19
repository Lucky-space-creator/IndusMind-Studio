import { setErrorMessageHandler, setTokenProvider, setUnauthorizedHandler } from "@hwc/shared-api";
import { useAuthStore } from "@hwc/shared-auth";
import { showToast } from "../components/Toast";

let wired = false;

/** shared-api 与 Toast / 登录态接线（app 启动时调用一次） */
export function wireApi() {
  if (wired) return;
  wired = true;
  setTokenProvider(() => useAuthStore.getState().token);
  setUnauthorizedHandler(() => {
    useAuthStore.getState().clearAuth();
    if (!window.location.hash.includes("/login")) {
      showToast("登录已过期，请重新登录", "warning");
      window.location.hash = "#/login";
    }
  });
  setErrorMessageHandler((msg) => {
    showToast(msg, "error");
  });
}