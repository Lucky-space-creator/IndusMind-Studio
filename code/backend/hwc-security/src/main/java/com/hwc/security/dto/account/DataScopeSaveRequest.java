package com.hwc.security.dto.account;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class DataScopeSaveRequest {

    @NotBlank(message = "范围类型不能为空")
    @Pattern(regexp = "ALL|DEVICE_TYPE|DEVICE|KNOWLEDGE_BASE",
            message = "范围类型非法，允许值：ALL/DEVICE_TYPE/DEVICE/KNOWLEDGE_BASE")
    private String scopeType;

    private Long scopeId;

    @Size(max = 255, message = "备注长度不能超过255")
    private String remark;
}