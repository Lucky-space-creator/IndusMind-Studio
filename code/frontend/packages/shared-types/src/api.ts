/** 统一响应体（对齐 Java 后端 Result） */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  traceId?: string;
}

/** 分页结果（对齐 PageResult） */
export interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
}

/** 分页查询基础参数 */
export interface PageQuery {
  current?: number;
  size?: number;
  keyword?: string;
}