import type { PermissionItem } from "@hwc/shared-types";

/** 后端全量权限点（字段为超集，这里只关心展示所需的四项） */
export interface PermissionDictItem {
  code: string;
  name?: string | null;
  module?: string | null;
  action?: string | null;
}

/**
 * 用「全量权限字典 ∩ 已授权权限码」补出权限明细。
 *
 * 正常链路下明细由后端 `/auth/profile` 直接下发；当后端版本较旧、响应里缺少
 * `permissionDetails` 字段时，前端不能只显示 0 项——权限码本身是有值的，
 * 这里用权限字典把它还原成可读清单，避免"有权限却显示为空"的静默失败。
 *
 * @param codes 已授权的权限码（鉴权唯一依据）
 * @param dict  全量权限点字典，含中文名称/模块/动作
 */
export function buildPermissionDetails(
  codes: string[],
  dict: PermissionDictItem[] | null | undefined,
): PermissionItem[] {
  if (!codes.length || !dict?.length) return [];
  const granted = new Set(codes);
  const seen = new Set<string>();
  const items: PermissionItem[] = [];
  for (const entry of dict) {
    const code = entry?.code;
    if (!code || !granted.has(code) || seen.has(code)) continue;
    seen.add(code);
    items.push({
      code,
      name: entry.name || code,
      module: entry.module || "other",
      action: entry.action || "",
    });
  }
  return items;
}
