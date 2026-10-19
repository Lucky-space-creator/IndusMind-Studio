package com.hwc.device.api;

import com.hwc.domain.device.DevInfo;
import com.hwc.domain.device.DevMetric;
import com.hwc.domain.device.DevMetricThreshold;

import java.util.List;
import java.util.Map;

/**
 * 设备主数据对外查询 Facade（跨模块唯一入口，供 hwc-device-data 等下游模块使用）。
 */
public interface DeviceQueryFacade {

    DevInfo getDevice(Long deviceId);

    List<DevMetric> listMetricsByType(Long typeId);

    Map<Long, DevMetric> getMetricMap(List<Long> metricIds);

    Map<Long, DevMetricThreshold> getThresholdMap(List<Long> metricIds);
}