package com.hwc.security.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class LoginResult {

    private String token;
    private Long userId;
    private String username;
    private String realName;
    private String end;
    private List<String> roles;
    private List<String> permissions;

    /** 权限点明细（含中文名称），供界面展示"当前账号拥有哪些权限" */
    private List<PermissionItem> permissionDetails;
}