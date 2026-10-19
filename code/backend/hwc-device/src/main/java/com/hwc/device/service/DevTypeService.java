package com.hwc.device.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hwc.domain.device.DevType;

public interface DevTypeService extends IService<DevType> {

    boolean existsByCode(String code, Long excludeId);
}