package com.hwc.domain.device;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dev_info")
public class DevInfo extends BaseEntity {

    private String code;

    private String name;

    private Long typeId;

    private Long modelId;

    private String lineName;

    private String location;

    private String status;

    private LocalDate runDate;

    private String remark;
}