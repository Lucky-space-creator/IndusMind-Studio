package com.hwc.domain.device;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dev_downtime_cost")
public class DevDowntimeCost extends BaseEntity {

    private String scopeType;

    private Long deviceId;

    private String lineName;

    private BigDecimal costPerHour;

    private String remark;
}