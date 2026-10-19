package com.hwc.devicedata.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hwc.domain.devicedata.DataCleaned;

public interface DataCleanService extends IService<DataCleaned> {

    int clean(Long datasetId);
}