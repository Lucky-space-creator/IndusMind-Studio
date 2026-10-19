package com.hwc.device.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hwc.device.mapper.DevDowntimeCostMapper;
import com.hwc.device.service.DevDowntimeCostService;
import com.hwc.domain.device.DevDowntimeCost;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class DevDowntimeCostServiceImpl extends ServiceImpl<DevDowntimeCostMapper, DevDowntimeCost>
        implements DevDowntimeCostService {

    @Override
    public BigDecimal resolveCostPerHour(Long deviceId, String lineName) {
        DevDowntimeCost deviceScope = getOne(new LambdaQueryWrapper<DevDowntimeCost>()
                .eq(DevDowntimeCost::getScopeType, "device")
                .eq(DevDowntimeCost::getDeviceId, deviceId)
                .last("LIMIT 1"));
        if (deviceScope != null) {
            return deviceScope.getCostPerHour();
        }
        if (lineName != null && !lineName.isBlank()) {
            DevDowntimeCost lineScope = getOne(new LambdaQueryWrapper<DevDowntimeCost>()
                    .eq(DevDowntimeCost::getScopeType, "line")
                    .eq(DevDowntimeCost::getLineName, lineName)
                    .last("LIMIT 1"));
            if (lineScope != null) {
                return lineScope.getCostPerHour();
            }
        }
        DevDowntimeCost globalScope = getOne(new LambdaQueryWrapper<DevDowntimeCost>()
                .eq(DevDowntimeCost::getScopeType, "global")
                .last("LIMIT 1"));
        return globalScope == null ? BigDecimal.ZERO : globalScope.getCostPerHour();
    }
}