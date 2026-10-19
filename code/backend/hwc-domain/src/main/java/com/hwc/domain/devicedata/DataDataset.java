package com.hwc.domain.devicedata;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("data_dataset")
public class DataDataset extends BaseEntity {

    private String name;

    private Long deviceId;

    private String sourceType;

    private String fileUrl;

    private LocalDateTime timeStart;

    private LocalDateTime timeEnd;

    private Integer recordCount;

    private String metricIds;

    private String cleanConfig;

    private Integer cleanedCount;

    private Integer anomalyCount;

    private String status;

    private String errorMsg;
}