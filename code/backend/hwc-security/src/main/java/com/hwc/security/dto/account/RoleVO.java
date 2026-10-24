package com.hwc.security.dto.account;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoleVO {

    private Long id;
    private String code;
    private String name;
    private String endType;
    private Integer builtIn;
    private Integer sort;
    private String description;
    /** 已绑定的权限点 ID，供前端权限树回显 */
    private List<Long> permissionIds;
}