package com.hwc.security.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 当前登录用户的权限档案（与登录返回同源，但不含 token）。
 * <p>
 * 用途：前端在权限被管理员调整后，无需重新登录即可同步界面展示（菜单/按钮/数据范围）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResult {

    private Long userId;
    private String username;
    private String realName;
    private String end;
    private List<String> roles;
    private List<String> permissions;

    /** 权限点明细（含中文名称与模块），供界面展示"当前账号拥有哪些权限" */
    private List<PermissionItem> permissionDetails;

    private DataScopeSummary dataScope;

    /** 数据范围摘要（前端仅用于展示提示，不构成安全边界） */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DataScopeSummary {

        /** 归一化后的类型：ALL / LINE / DEVICE / KB */
        private String scopeType;

        /** 授权对象数量描述，如 "3 项" */
        private String scopeValue;

        private String remark;

        /** 授权对象总数 */
        private Integer count;
    }
}
