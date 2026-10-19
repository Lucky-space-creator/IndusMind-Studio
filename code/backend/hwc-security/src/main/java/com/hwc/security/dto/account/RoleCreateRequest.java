package com.hwc.security.dto.account;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class RoleCreateRequest {

    @NotBlank(message = "角色编码不能为空")
    @Size(min = 1, max = 64, message = "角色编码长度必须在1-64之间")
    private String code;

    @NotBlank(message = "角色名称不能为空")
    @Size(min = 1, max = 64, message = "角色名称长度必须在1-64之间")
    private String name;

    @NotBlank(message = "所属端不能为空")
    @Pattern(regexp = "user|admin|both", message = "所属端只允许user/admin/both")
    private String endType;

    @Size(max = 255, message = "描述长度不能超过255")
    private String description;

    private List<Long> permissionIds;
}