package com.hwc.domain.device;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dev_metric_threshold")
public class DevMetricThreshold extends BaseEntity {

    private Long metricId;

    private BigDecimal normalMin;

    private BigDecimal normalMax;

    private BigDecimal warnMin;

    private BigDecimal warnMax;

    private BigDecimal faultMin;

    private BigDecimal faultMax;

    private String remark;
}