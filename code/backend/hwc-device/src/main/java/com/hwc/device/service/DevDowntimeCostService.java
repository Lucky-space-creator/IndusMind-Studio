package com.hwc.device.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hwc.domain.device.DevDowntimeCost;

import java.math.BigDecimal;

public interface DevDowntimeCostService extends IService<DevDowntimeCost> {

    BigDecimal resolveCostPerHour(Long deviceId, String lineName);
}