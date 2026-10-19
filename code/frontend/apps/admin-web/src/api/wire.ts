import { message } from "antd";
import { setErrorMessageHandler, setTokenProvider, setUnauthorizedHandler } from "@hwc/shared-api";
import { useAuthStore } from "@hwc/shared-auth";

let wired = false;

/** shared-api 与 AntD message / 登录态接线（app 启动时调用一次） */
export function wireApi() {
  if (wired) return;
  wired = true;
  setTokenProvider(() => useAuthStore.getState().token);
  setUnauthorizedHandler(() => {
    useAuthStore.getState().clearAuth();
    if (!window.location.hash.includes("/login") && !window.location.pathname.includes("/login")) {
      message.warning("登录已过期，请重新登录");
      window.location.hash = "#/login";
    }
  });
  setErrorMessageHandler((msg) => {
    message.error(msg);
  });
}