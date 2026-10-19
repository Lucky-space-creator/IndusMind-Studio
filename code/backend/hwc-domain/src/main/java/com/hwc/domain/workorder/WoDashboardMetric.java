package com.hwc.domain.workorder;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("wo_dashboard_metric")
public class WoDashboardMetric extends BaseEntity {

    private Long deviceId;

    private Long datasetId;

    private BigDecimal healthScore;

    private String status;

    private String riskHint;

    private String metricSnapshot;

    private Integer anomalyCount;

    private LocalDateTime snapshotTime;
}