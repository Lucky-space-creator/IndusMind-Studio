package com.hwc.security.dto.account;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UserUpdateRequest {

    private String username;

    @Size(max = 64, message = "昵称长度不能超过64")
    private String nickname;

    @Size(max = 20, message = "手机号长度不能超过20")
    private String phone;

    @Size(max = 128, message = "邮箱长度不能超过128")
    private String email;

    @Min(value = 0, message = "状态值只允许0或1")
    @Max(value = 1, message = "状态值只允许0或1")
    private Integer status;

    @Size(max = 512, message = "备注长度不能超过512")
    private String remark;

    private List<Long> roleIds;
}