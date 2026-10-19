package com.hwc.device.api.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.device.api.DeviceQueryFacade;
import com.hwc.device.mapper.DevInfoMapper;
import com.hwc.device.mapper.DevMetricMapper;
import com.hwc.device.mapper.DevMetricThresholdMapper;
import com.hwc.domain.device.DevInfo;
import com.hwc.domain.device.DevMetric;
import com.hwc.domain.device.DevMetricThreshold;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeviceQueryFacadeImpl implements DeviceQueryFacade {

    private final DevInfoMapper infoMapper;
    private final DevMetricMapper metricMapper;
    private final DevMetricThresholdMapper thresholdMapper;

    @Override
    public DevInfo getDevice(Long deviceId) {
        return infoMapper.selectById(deviceId);
    }

    @Override
    public List<DevMetric> listMetricsByType(Long typeId) {
        return metricMapper.selectList(new LambdaQueryWrapper<DevMetric>()
                .eq(DevMetric::getTypeId, typeId)
                .orderByAsc(DevMetric::getId));
    }

    @Override
    public Map<Long, DevMetric> getMetricMap(List<Long> metricIds) {
        if (metricIds == null || metricIds.isEmpty()) {
            return Collections.emptyMap();
        }
        return metricMapper.selectList(new LambdaQueryWrapper<DevMetric>()
                        .in(DevMetric::getId, metricIds))
                .stream()
                .collect(Collectors.toMap(DevMetric::getId, Function.identity(), (a, b) -> a));
    }

    @Override
    public Map<Long, DevMetricThreshold> getThresholdMap(List<Long> metricIds) {
        if (metricIds == null || metricIds.isEmpty()) {
            return Collections.emptyMap();
        }
        return thresholdMapper.selectList(new LambdaQueryWrapper<DevMetricThreshold>()
                        .in(DevMetricThreshold::getMetricId, metricIds))
                .stream()
                .collect(Collectors.toMap(DevMetricThreshold::getMetricId, Function.identity(), (a, b) -> a));
    }
}