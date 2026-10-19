package com.hwc.device.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hwc.domain.device.DevInfo;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface DevInfoMapper extends BaseMapper<DevInfo> {
}