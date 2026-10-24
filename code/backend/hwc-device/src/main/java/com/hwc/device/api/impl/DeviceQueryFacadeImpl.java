package com.hwc.device.api.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.device.api.DeviceQueryFacade;
import com.hwc.device.mapper.DevDowntimeCostMapper;
import com.hwc.device.mapper.DevInfoMapper;
import com.hwc.device.mapper.DevMetricMapper;
import com.hwc.device.mapper.DevMetricThresholdMapper;
import com.hwc.device.mapper.DevSparePartMapper;
import com.hwc.domain.device.DevDowntimeCost;
import com.hwc.domain.device.DevInfo;
import com.hwc.domain.device.DevMetric;
import com.hwc.domain.device.DevMetricThreshold;
import com.hwc.domain.device.DevSparePart;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
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
    private final DevSparePartMapper sparePartMapper;
    private final DevDowntimeCostMapper downtimeCostMapper;

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

    @Override
    public List<DevSparePart> listSparePartsByNames(List<String> names) {
        List<String> filtered = names == null ? List.of()
                : names.stream().filter(name -> name != null && !name.isBlank()).distinct().toList();
        if (filtered.isEmpty()) {
            return List.of();
        }
        return sparePartMapper.selectList(new LambdaQueryWrapper<DevSparePart>()
                .in(DevSparePart::getName, filtered));
    }

    @Override
    public BigDecimal getDowntimeCostPerHour(Long deviceId, String lineName) {
        List<DevDowntimeCost> all = downtimeCostMapper.selectList(new LambdaQueryWrapper<DevDowntimeCost>());
        if (all.isEmpty()) {
            return null;
        }
        // 优先级：device > line > global
        BigDecimal deviceCost = all.stream()
                .filter(c -> "device".equalsIgnoreCase(c.getScopeType()))
                .filter(c -> deviceId != null && deviceId.equals(c.getDeviceId()))
                .map(DevDowntimeCost::getCostPerHour)
                .filter(java.util.Objects::nonNull)
                .findFirst().orElse(null);
        if (deviceCost != null) {
            return deviceCost;
        }
        BigDecimal lineCost = all.stream()
                .filter(c -> "line".equalsIgnoreCase(c.getScopeType()))
                .filter(c -> lineName != null && lineName.equals(c.getLineName()))
                .map(DevDowntimeCost::getCostPerHour)
                .filter(java.util.Objects::nonNull)
                .findFirst().orElse(null);
        if (lineCost != null) {
            return lineCost;
        }
        return all.stream()
                .filter(c -> "global".equalsIgnoreCase(c.getScopeType()))
                .map(DevDowntimeCost::getCostPerHour)
                .filter(java.util.Objects::nonNull)
                .findFirst().orElse(null);
    }
}