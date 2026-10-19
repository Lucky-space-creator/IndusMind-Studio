package com.hwc.domain.device;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dev_spare_part")
public class DevSparePart extends BaseEntity {

    private String code;

    private String name;

    private String model;

    private String unit;

    private Integer stock;

    private Integer safetyStock;

    private BigDecimal unitPrice;

    private Integer status;

    private String remark;
}