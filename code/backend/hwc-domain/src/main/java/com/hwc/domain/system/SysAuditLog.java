package com.hwc.domain.system;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.AppendEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_audit_log")
public class SysAuditLog extends AppendEntity {

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

    private LocalDateTime operateTime;
}