package com.hwc.devicedata.api;

import com.hwc.domain.devicedata.DataAnomaly;
import com.hwc.domain.devicedata.DataDataset;

import java.util.List;

/**
 * 设备数据对外查询 Facade（跨模块唯一入口，供 hwc-agent 等下游模块使用）。
 */
public interface DataQueryFacade {

    DataDataset getDataset(Long datasetId);

    List<DataAnomaly> listAnomalies(Long datasetId, int limit);
}