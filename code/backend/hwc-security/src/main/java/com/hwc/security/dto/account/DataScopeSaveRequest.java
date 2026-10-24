package com.hwc.security.dto.account;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class DataScopeSaveRequest {

    @NotBlank(message = "范围类型不能为空")
    @Pattern(regexp = "ALL|DEVICE_TYPE|DEVICE|KNOWLEDGE_BASE",
            message = "范围类型非法，允许值：ALL/DEVICE_TYPE/DEVICE/KNOWLEDGE_BASE")
    private String scopeType;

    /** 单值范围对象（保留兼容；新前端使用 scopeIds） */
    private Long scopeId;

    /** 多值范围对象：同一角色可同时授权多个设备类型 / 设备 / 知识库 */
    private List<Long> scopeIds;

    @Size(max = 255, message = "备注长度不能超过255")
    private String remark;
}