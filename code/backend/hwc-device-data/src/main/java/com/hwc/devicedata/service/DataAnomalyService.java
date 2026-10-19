package com.hwc.devicedata.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hwc.domain.devicedata.DataAnomaly;

public interface DataAnomalyService extends IService<DataAnomaly> {

    int extract(Long datasetId);

    void deleteByDataset(Long datasetId);
}