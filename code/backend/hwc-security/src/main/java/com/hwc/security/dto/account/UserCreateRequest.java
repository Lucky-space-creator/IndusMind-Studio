package com.hwc.security.dto.account;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UserCreateRequest {

    @NotBlank(message = "用户名不能为空")
    @Size(min = 1, max = 64, message = "用户名长度必须在1-64之间")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 64, message = "密码长度必须在8-64之间")
    private String password;

    @Size(max = 64, message = "昵称长度不能超过64")
    private String nickname;

    @Size(max = 20, message = "手机号长度不能超过20")
    private String phone;

    @Size(max = 128, message = "邮箱长度不能超过128")
    private String email;

    @Min(value = 0, message = "状态值只允许0或1")
    @Max(value = 1, message = "状态值只允许0或1")
    private Integer status = 1;

    private List<Long> roleIds;
}