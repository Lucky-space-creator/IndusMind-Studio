package com.hwc.device.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hwc.domain.device.DevMetricThreshold;

public interface DevMetricThresholdService extends IService<DevMetricThreshold> {

    void validateRange(DevMetricThreshold threshold);
}