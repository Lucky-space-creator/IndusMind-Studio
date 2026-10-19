package com.hwc.workorder.service;

import com.hwc.domain.devicedata.DataDataset;
import com.hwc.domain.workorder.WoDashboardMetric;

import java.util.List;

public interface DashboardService {

    WoDashboardMetric refresh(Long datasetId);

    List<WoDashboardMetric> latestSnapshots(List<Long> deviceIds);
}