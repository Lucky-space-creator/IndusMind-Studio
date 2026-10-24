package com.hwc.device.api;

import com.hwc.domain.device.DevInfo;
import com.hwc.domain.device.DevMetric;
import com.hwc.domain.device.DevMetricThreshold;
import com.hwc.domain.device.DevSparePart;

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

    /**
     * 按备件名称批量查询备件主数据（用于工单回填单价与库存快照，契约约定「库存与单价以调用方主数据为准」）。
     */
    List<DevSparePart> listSparePartsByNames(List<String> names);

    /**
     * 取每小时停机损失：优先级 device > line > global，无配置返回 null。
     */
    java.math.BigDecimal getDowntimeCostPerHour(Long deviceId, String lineName);
}