package com.hwc.domain.devicedata;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("data_anomaly")
public class DataAnomaly extends BaseEntity {

    private Long datasetId;

    private Long deviceId;

    private Long metricId;

    private String anomalyType;

    private String severity;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Integer sampleCount;

    private BigDecimal peakValue;

    private BigDecimal avgValue;

    private String summary;

    private String detail;
}