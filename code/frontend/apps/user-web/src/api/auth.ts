import { api } from "@hwc/shared-api";
import type { LoginRequest, LoginResult } from "@hwc/shared-types";

/** 用户端登录 */
export function userLogin(body: LoginRequest) {
  return api.post<LoginResult>("/api/user/auth/login", body);
}