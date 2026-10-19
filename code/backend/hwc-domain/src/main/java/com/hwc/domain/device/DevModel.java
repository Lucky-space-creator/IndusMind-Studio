package com.hwc.domain.device;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dev_model")
public class DevModel extends BaseEntity {

    private Long typeId;

    private String code;

    private String name;

    private String spec;
}