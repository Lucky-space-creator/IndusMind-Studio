package com.hwc.workorder.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hwc.domain.workorder.WoWorkOrder;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface WoWorkOrderMapper extends BaseMapper<WoWorkOrder> {
}