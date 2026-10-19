/** ===== 发布监控域（hwc-publish）===== */

export interface PubService {
  id: number;
  flowId: number;
  code: string;
  name: string;
  /** online/paused */
  status: string;
  currentVersion?: string;
  description?: string;
}

/** 凭证签发结果（上线/轮换时返回一次，与后端 CredentialIssue record 对齐） */
export interface CredentialIssue {
  credentialId: number;
  accessKey: string;
  secretKey: string;
}

export interface PubCredential {
  id: number;
  serviceId: number;
  accessKey: string;
  secretKey: string;
  status: string;
  expireTime?: string;
  remark?: string;
}

export interface PubVersion {
  id: number;
  serviceId: number;
  version: string;
  configSnapshot?: string;
  changelog?: string;
  publishedBy?: string;
  publishedAt?: string;
}

export interface PubCallLog {
  id: number;
  serviceId: number;
  credentialId?: number;
  traceId?: string;
  apiPath?: string;
  latencyMs?: number;
  /** 1/0 */
  success: number;
  httpStatus?: number;
  errorMsg?: string;
  callTime: string;
}