package com.hwc.security.dto.audit;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AuditLogVO {

    private Long id;

    private Long operatorId;

    private String operatorName;

    private String endpoint;

    private String module;

    private String action;

    private String targetType;

    private String targetId;

    private String beforeValue;

    private String afterValue;

    private Integer result;

    private String errorMsg;

    private String ip;

    private String traceId;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime operateTime;
}