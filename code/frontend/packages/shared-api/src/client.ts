import type { ApiResponse } from "@hwc/shared-types";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
}

/** 统一业务错误（code !== 0 或 HTTP 非 2xx） */
export class ApiError extends Error {
  code: number;
  traceId?: string;
  /** HTTP 状态码（网络层错误时为 0） */
  httpStatus: number;

  constructor(code: number, message: string, traceId?: string, httpStatus = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.traceId = traceId;
    this.httpStatus = httpStatus;
  }
}

type TokenProvider = () => string | null;
type UnauthorizedHandler = () => void;
type ErrorMessageHandler = (message: string) => void;

let tokenProvider: TokenProvider = () => null;
let unauthorizedHandler: UnauthorizedHandler = () => {};
let errorMessageHandler: ErrorMessageHandler = () => {};

/** 注入 Token 获取方式（各 app 在启动时接入登录态） */
export function setTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

/** 注入 401 处理（一般跳转登录页并清理登录态） */
export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  unauthorizedHandler = handler;
}

/** 注入业务错误提示（AntD message / 自定义 toast） */
export function setErrorMessageHandler(handler: ErrorMessageHandler) {
  errorMessageHandler = handler;
}

function buildQuery(query: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

async function parseResponse<T>(resp: Response): Promise<T> {
  if (resp.status === 401) {
    unauthorizedHandler();
    throw new ApiError(401, "登录已过期，请重新登录", undefined, 401);
  }
  if (resp.status === 403) {
    const message = "没有访问权限，请联系管理员分配相应权限";
    errorMessageHandler(message);
    throw new ApiError(403, message, undefined, 403);
  }
  let payload: ApiResponse<T>;
  try {
    payload = (await resp.json()) as ApiResponse<T>;
  } catch {
    const message = `服务响应异常（HTTP ${resp.status}），请稍后重试`;
    errorMessageHandler(message);
    throw new ApiError(-1, message, undefined, resp.status);
  }
  if (payload.code !== 0) {
    const message = payload.message || "请求处理失败，请稍后重试";
    errorMessageHandler(message);
    throw new ApiError(payload.code, message, payload.traceId, resp.status);
  }
  return payload.data;
}

/** 统一请求入口：Token 注入 + 统一解包 + 401/403 中文提示 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, headers = {} } = options;
  const token = tokenProvider();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let resp: Response;
  try {
    resp = await fetch(`${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const message = "网络连接失败，请检查网络后重试";
    errorMessageHandler(message);
    throw new ApiError(-1, message);
  }
  return parseResponse<T>(resp);
}

/** 文件上传（multipart/form-data，自动注入 Token） */
export async function uploadFile<T>(
  path: string,
  file: File,
  fields: Record<string, string> = {},
): Promise<T> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  form.append("file", file);
  const headers: Record<string, string> = {};
  const token = tokenProvider();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  let resp: Response;
  try {
    resp = await fetch(path, { method: "POST", headers, body: form });
  } catch {
    const message = "网络连接失败，请检查网络后重试";
    errorMessageHandler(message);
    throw new ApiError(-1, message);
  }
  return parseResponse<T>(resp);
}

/** 文件下载（带 Token，返回 Blob；用于工单 PDF 导出等） */
export async function downloadFile(path: string, query?: RequestOptions["query"]): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = tokenProvider();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  let resp: Response;
  try {
    resp = await fetch(`${path}${buildQuery(query)}`, { headers });
  } catch {
    const message = "网络连接失败，请检查网络后重试";
    errorMessageHandler(message);
    throw new ApiError(-1, message);
  }
  if (resp.status === 401) {
    unauthorizedHandler();
    throw new ApiError(401, "登录已过期，请重新登录", undefined, 401);
  }
  if (resp.status === 403) {
    const message = "没有下载权限，请联系管理员分配相应权限";
    errorMessageHandler(message);
    throw new ApiError(403, message, undefined, 403);
  }
  if (!resp.ok) {
    const message = `下载失败（HTTP ${resp.status}），请稍后重试`;
    errorMessageHandler(message);
    throw new ApiError(-1, message, undefined, resp.status);
  }
  return resp.blob();
}

/** 触发浏览器保存文件 */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown, query?: RequestOptions["query"]) =>
    request<T>(path, { method: "POST", body, query }),
  put: <T>(path: string, body?: unknown, query?: RequestOptions["query"]) =>
    request<T>(path, { method: "PUT", body, query }),
  delete: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { method: "DELETE", query }),
};