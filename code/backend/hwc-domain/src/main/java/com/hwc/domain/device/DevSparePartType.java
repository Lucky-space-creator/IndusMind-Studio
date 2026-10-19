package com.hwc.domain.device;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.InsertEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dev_spare_part_type")
public class DevSparePartType extends InsertEntity {

    private Long sparePartId;

    private Long devTypeId;
}