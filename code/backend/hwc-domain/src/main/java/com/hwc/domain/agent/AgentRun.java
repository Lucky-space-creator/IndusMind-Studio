package com.hwc.domain.agent;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agent_run")
public class AgentRun extends BaseEntity {

    private String runType;

    private Long flowId;

    private Long sessionId;

    private Long deviceId;

    private Long datasetId;

    private String input;

    private String status;

    private String conclusion;

    private String traceId;

    private LocalDateTime startedAt;

    private LocalDateTime endedAt;

    private Integer durationMs;

    private String errorMsg;
}