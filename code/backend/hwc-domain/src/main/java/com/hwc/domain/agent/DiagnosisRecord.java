package com.hwc.domain.agent;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("diagnosis_record")
public class DiagnosisRecord extends BaseEntity {

    private Long runId;

    private Long deviceId;

    private Long datasetId;

    private String faultSummary;

    private String rootCause;

    private String riskLevel;

    private String safetyConclusion;

    private String citations;

    private LocalDateTime conclusionTime;
}