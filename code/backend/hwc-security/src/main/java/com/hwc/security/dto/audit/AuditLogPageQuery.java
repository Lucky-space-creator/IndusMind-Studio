package com.hwc.security.dto.audit;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;

@Data
public class AuditLogPageQuery {

    @Min(value = 1, message = "页码必须大于等于1")
    private long current = 1;

    @Min(value = 1, message = "每页条数必须大于等于1")
    @Max(value = 100, message = "每页条数不能超过100")
    private long size = 10;

    @Size(max = 64, message = "操作人长度不能超过64")
    private String operatorName;

    @Size(max = 32, message = "模块长度不能超过32")
    private String module;

    @Size(max = 32, message = "动作长度不能超过32")
    private String action;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime beginTime;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime endTime;
}