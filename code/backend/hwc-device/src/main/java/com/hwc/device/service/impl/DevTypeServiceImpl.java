package com.hwc.device.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hwc.device.mapper.DevTypeMapper;
import com.hwc.device.service.DevTypeService;
import com.hwc.domain.device.DevType;
import org.springframework.stereotype.Service;

@Service
public class DevTypeServiceImpl extends ServiceImpl<DevTypeMapper, DevType> implements DevTypeService {

    @Override
    public boolean existsByCode(String code, Long excludeId) {
        return count(new LambdaQueryWrapper<DevType>()
                .eq(DevType::getCode, code)
                .ne(excludeId != null, DevType::getId, excludeId)) > 0;
    }
}