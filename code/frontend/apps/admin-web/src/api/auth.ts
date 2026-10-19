import { api } from "@hwc/shared-api";
import type { LoginRequest, LoginResult } from "@hwc/shared-types";

/** 管理端登录 */
export function adminLogin(body: LoginRequest) {
  return api.post<LoginResult>("/api/admin/auth/login", body);
}