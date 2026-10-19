package com.hwc.domain.device;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dev_metric")
public class DevMetric extends BaseEntity {

    private Long typeId;

    private String code;

    private String name;

    private String unit;

    private Integer sampleInterval;
}