package com.hwc.domain.workorder;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("wo_work_order_part")
public class WoWorkOrderPart extends BaseEntity {

    private Long orderId;

    private Long sparePartId;

    private String partName;

    private String partModel;

    private Integer quantity;

    private BigDecimal unitPrice;

    private Integer stockSnapshot;

    private String remark;
}