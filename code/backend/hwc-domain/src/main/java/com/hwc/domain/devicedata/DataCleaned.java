package com.hwc.domain.devicedata;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.AppendEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("data_cleaned")
public class DataCleaned extends AppendEntity {

    private Long datasetId;

    private Long recordId;

    private Long metricId;

    private LocalDateTime collectTime;

    private BigDecimal rawValue;

    private BigDecimal cleanedValue;

    private Integer isModified;

    private String rulesApplied;

    private String remark;
}