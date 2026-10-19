package com.hwc.devicedata.api.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.devicedata.api.DataQueryFacade;
import com.hwc.devicedata.mapper.DataAnomalyMapper;
import com.hwc.devicedata.mapper.DataDatasetMapper;
import com.hwc.domain.devicedata.DataAnomaly;
import com.hwc.domain.devicedata.DataDataset;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DataQueryFacadeImpl implements DataQueryFacade {

    private final DataDatasetMapper datasetMapper;
    private final DataAnomalyMapper anomalyMapper;

    @Override
    public DataDataset getDataset(Long datasetId) {
        return datasetMapper.selectById(datasetId);
    }

    @Override
    public List<DataAnomaly> listAnomalies(Long datasetId, int limit) {
        return anomalyMapper.selectList(new LambdaQueryWrapper<DataAnomaly>()
                .eq(DataAnomaly::getDatasetId, datasetId)
                .orderByDesc(DataAnomaly::getSeverity)
                .orderByAsc(DataAnomaly::getStartTime)
                .last("LIMIT " + Math.max(1, limit)));
    }
}