package com.hwc.domain.workorder;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("wo_work_order")
public class WoWorkOrder extends BaseEntity {

    private String orderNo;

    private Long diagnosisId;

    private Long deviceId;

    private String faultSummary;

    private String rootCause;

    private String riskLevel;

    private String safetyRequirements;

    private String repairSteps;

    private BigDecimal estDowntimeHours;

    private BigDecimal downtimeCost;

    private BigDecimal partsCost;

    private BigDecimal totalCost;

    private String fileUrl;

    private String status;

    private String generatedBy;

    private LocalDateTime generatedTime;
}