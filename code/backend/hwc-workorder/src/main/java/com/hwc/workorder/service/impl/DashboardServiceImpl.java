package com.hwc.workorder.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.devicedata.api.DataQueryFacade;
import com.hwc.domain.devicedata.DataAnomaly;
import com.hwc.domain.devicedata.DataDataset;
import com.hwc.domain.workorder.WoDashboardMetric;
import com.hwc.workorder.mapper.WoDashboardMetricMapper;
import com.hwc.workorder.service.DashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 设备健康看板：基于最新数据集的异常统计计算健康评分（规则见 wo_score_rule 全局默认）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private static final int WARN_PENALTY = 5;
    private static final int FAULT_PENALTY = 15;
    private static final int MAX_DEDUCTION = 40;

    private final WoDashboardMetricMapper metricMapper;
    private final DataQueryFacade dataQueryFacade;

    @Override
    @Transactional
    public WoDashboardMetric refresh(Long datasetId) {
        DataDataset dataset = dataQueryFacade.getDataset(datasetId);
        if (dataset == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "数据集不存在");
        }
        List<DataAnomaly> anomalies = dataQueryFacade.listAnomalies(datasetId, 500);
        long warnCount = anomalies.stream().filter(a -> "warn".equals(a.getSeverity())).count();
        long faultCount = anomalies.stream().filter(a -> "fault".equals(a.getSeverity())).count();

        int deduction = (int) Math.min(MAX_DEDUCTION, warnCount * WARN_PENALTY + faultCount * FAULT_PENALTY);
        int score = Math.max(0, 100 - deduction);
        String status = score >= 90 ? "normal" : score >= 70 ? "warn" : "fault";
        String riskHint = faultCount > 0 ? "存在故障级异常，建议立即发起协同诊断"
                : warnCount > 0 ? "存在预警异常，请关注指标趋势" : "设备运行正常";

        WoDashboardMetric snapshot = new WoDashboardMetric();
        snapshot.setDeviceId(dataset.getDeviceId());
        snapshot.setDatasetId(datasetId);
        snapshot.setHealthScore(java.math.BigDecimal.valueOf(score));
        snapshot.setStatus(status);
        snapshot.setRiskHint(riskHint);
        snapshot.setMetricSnapshot("{\"warnCount\":" + warnCount + ",\"faultCount\":" + faultCount
                + ",\"recordCount\":" + dataset.getRecordCount() + ",\"cleanedCount\":" + dataset.getCleanedCount() + "}");
        snapshot.setAnomalyCount(anomalies.size());
        snapshot.setSnapshotTime(LocalDateTime.now());
        metricMapper.insert(snapshot);
        return snapshot;
    }

    @Override
    public List<WoDashboardMetric> latestSnapshots(List<Long> deviceIds) {
        List<WoDashboardMetric> result = new ArrayList<>();
        for (Long deviceId : deviceIds) {
            WoDashboardMetric latest = metricMapper.selectOne(new LambdaQueryWrapper<WoDashboardMetric>()
                    .eq(WoDashboardMetric::getDeviceId, deviceId)
                    .orderByDesc(WoDashboardMetric::getId)
                    .last("LIMIT 1"));
            if (latest != null) {
                result.add(latest);
            }
        }
        return result;
    }
}