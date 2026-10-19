package com.hwc.device.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hwc.domain.device.DevInfo;

public interface DevInfoService extends IService<DevInfo> {

    boolean existsByCode(String code, Long excludeId);

    Long resolveTypeIdByModel(Long modelId);
}