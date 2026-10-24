package com.hwc.security.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 权限点明细（code 用于鉴权判断，其余字段仅用于界面展示）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PermissionItem {

    private String code;

    /** 中文名称，如「知识库查看」 */
    private String name;

    /** 所属模块，如 knowledge / device */
    private String module;

    /** 动作：read/write/publish/delete/export */
    private String action;
}
