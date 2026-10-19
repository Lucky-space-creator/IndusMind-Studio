package com.hwc.domain.device;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dev_alarm_rule")
public class DevAlarmRule extends BaseEntity {

    private Long metricId;

    private String level;

    private String conditionType;

    private Integer durationCount;

    private String thresholdExpr;

    private Integer enabled;

    private String description;
}