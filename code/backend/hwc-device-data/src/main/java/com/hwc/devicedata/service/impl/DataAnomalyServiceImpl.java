package com.hwc.devicedata.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.device.api.DeviceQueryFacade;
import com.hwc.devicedata.event.DataReadyEvent;
import com.hwc.devicedata.mapper.DataAnomalyMapper;
import com.hwc.devicedata.mapper.DataCleanedMapper;
import com.hwc.devicedata.mapper.DataDatasetMapper;
import com.hwc.devicedata.mapper.DataRecordMapper;
import com.hwc.devicedata.service.DataAnomalyService;
import com.hwc.devicedata.simulate.DataSimulator;
import com.hwc.domain.device.DevMetric;
import com.hwc.domain.device.DevMetricThreshold;
import com.hwc.domain.devicedata.DataAnomaly;
import com.hwc.domain.devicedata.DataCleaned;
import com.hwc.domain.devicedata.DataDataset;
import com.hwc.domain.devicedata.DataRecord;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 异常提取（M05）：三级区间阈值越限 + 持续升降趋势 + 异常波动；优先基于清洗后数据。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataAnomalyServiceImpl extends ServiceImpl<DataAnomalyMapper, DataAnomaly> implements DataAnomalyService {

    private static final int TREND_MIN_POINTS = 8;
    private static final double TREND_SPAN_RATIO = 0.5;
    private static final double FLUCTUATION_SPAN_RATIO = 0.25;

    private final DataDatasetMapper datasetMapper;
    private final DataRecordMapper recordMapper;
    private final DataCleanedMapper cleanedMapper;
    private final DeviceQueryFacade deviceQueryFacade;
    private final DataSimulator simulator;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public int extract(Long datasetId) {
        DataDataset dataset = datasetMapper.selectById(datasetId);
        if (dataset == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "数据集不存在");
        }
        List<Long> metricIds = parseMetricIds(dataset.getMetricIds());
        if (metricIds.isEmpty()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "数据集未包含任何指标");
        }
        Map<Long, DevMetricThreshold> thresholds = deviceQueryFacade.getThresholdMap(metricIds);
        Map<Long, DevMetric> metrics = deviceQueryFacade.getMetricMap(metricIds);

        deleteByDataset(datasetId);

        int total = 0;
        for (Long metricId : metricIds) {
            DevMetricThreshold threshold = thresholds.get(metricId);
            if (threshold == null) {
                continue;
            }
            List<TimePoint> points = loadPoints(datasetId, metricId);
            if (points.size() < 2) {
                continue;
            }
            DevMetric metric = metrics.get(metricId);
            total += detectThresholdBreaches(dataset, metric, threshold, points);
            total += detectTrends(dataset, metric, threshold, points);
            total += detectFluctuations(dataset, metric, threshold, points);
        }

        dataset.setAnomalyCount(total);
        dataset.setStatus("ready");
        datasetMapper.updateById(dataset);
        eventPublisher.publishEvent(new DataReadyEvent(datasetId, dataset.getDeviceId(), total));
        log.info("异常提取完成: datasetId={}, anomalies={}", datasetId, total);
        return total;
    }

    @Override
    public void deleteByDataset(Long datasetId) {
        remove(new LambdaQueryWrapper<DataAnomaly>().eq(DataAnomaly::getDatasetId, datasetId));
    }

    private List<TimePoint> loadPoints(Long datasetId, Long metricId) {
        List<TimePoint> points = new ArrayList<>();
        List<DataCleaned> cleaned = cleanedMapper.selectList(new LambdaQueryWrapper<DataCleaned>()
                .eq(DataCleaned::getDatasetId, datasetId)
                .eq(DataCleaned::getMetricId, metricId)
                .isNotNull(DataCleaned::getCleanedValue)
                .orderByAsc(DataCleaned::getCollectTime));
        if (!cleaned.isEmpty()) {
            for (DataCleaned item : cleaned) {
                points.add(new TimePoint(item.getCollectTime(), item.getCleanedValue()));
            }
            return points;
        }
        List<DataRecord> records = recordMapper.selectList(new LambdaQueryWrapper<DataRecord>()
                .eq(DataRecord::getDatasetId, datasetId)
                .eq(DataRecord::getMetricId, metricId)
                .orderByAsc(DataRecord::getCollectTime));
        for (DataRecord record : records) {
            points.add(new TimePoint(record.getCollectTime(), record.getMetricValue()));
        }
        return points;
    }

    private int detectThresholdBreaches(DataDataset dataset, DevMetric metric,
                                        DevMetricThreshold threshold, List<TimePoint> points) {
        int count = 0;
        int i = 0;
        while (i < points.size()) {
            String severity = severityOf(points.get(i).value(), threshold);
            if (severity == null) {
                i++;
                continue;
            }
            int j = i;
            String peakSeverity = severity;
            BigDecimal peak = points.get(i).value();
            BigDecimal sum = BigDecimal.ZERO;
            while (j < points.size() && severityOf(points.get(j).value(), threshold) != null) {
                String s = severityOf(points.get(j).value(), threshold);
                if ("fault".equals(s)) {
                    peakSeverity = "fault";
                }
                if (points.get(j).value().abs().compareTo(peak.abs()) > 0) {
                    peak = points.get(j).value();
                }
                sum = sum.add(points.get(j).value());
                j++;
            }
            BigDecimal avg = sum.divide(BigDecimal.valueOf(j - i), 4, RoundingMode.HALF_UP);
            save(anomaly(dataset, metric, "threshold_breach", peakSeverity,
                    points.get(i).time(), points.get(j - 1).time(), j - i, peak, avg,
                    metricName(metric) + "持续越限（" + ("fault".equals(peakSeverity) ? "故障级" : "预警级")
                            + "），峰值 " + peak));
            count++;
            i = j;
        }
        return count;
    }

    private int detectTrends(DataDataset dataset, DevMetric metric,
                             DevMetricThreshold threshold, List<TimePoint> points) {
        double span = simulator.span(threshold);
        int count = 0;
        count += detectTrendDirection(dataset, metric, points, span, true);
        count += detectTrendDirection(dataset, metric, points, span, false);
        return count;
    }

    private int detectTrendDirection(DataDataset dataset, DevMetric metric, List<TimePoint> points,
                                     double span, boolean rising) {
        int count = 0;
        int start = 0;
        for (int i = 1; i <= points.size(); i++) {
            boolean continues = i < points.size()
                    && (rising ? points.get(i).value().compareTo(points.get(i - 1).value()) > 0
                    : points.get(i).value().compareTo(points.get(i - 1).value()) < 0);
            if (!continues) {
                int len = i - start;
                double change = Math.abs(points.get(i - 1).value().doubleValue()
                        - points.get(start).value().doubleValue());
                if (len >= TREND_MIN_POINTS && change >= span * TREND_SPAN_RATIO) {
                    BigDecimal peak = points.get(start).value();
                    BigDecimal sum = BigDecimal.ZERO;
                    for (int k = start; k < i; k++) {
                        if (points.get(k).value().abs().compareTo(peak.abs()) > 0) {
                            peak = points.get(k).value();
                        }
                        sum = sum.add(points.get(k).value());
                    }
                    save(anomaly(dataset, metric, "continuous_trend", "warn",
                            points.get(start).time(), points.get(i - 1).time(), len, peak,
                            sum.divide(BigDecimal.valueOf(len), 4, RoundingMode.HALF_UP),
                            metricName(metric) + (rising ? "持续上升" : "持续下降") + "趋势（连续" + len + "点）"));
                    count++;
                }
                start = i;
            }
        }
        return count;
    }

    private int detectFluctuations(DataDataset dataset, DevMetric metric,
                                   DevMetricThreshold threshold, List<TimePoint> points) {
        double span = simulator.span(threshold);
        int count = 0;
        int i = 1;
        while (i < points.size()) {
            double jump = Math.abs(points.get(i).value().doubleValue()
                    - points.get(i - 1).value().doubleValue());
            if (jump <= span * FLUCTUATION_SPAN_RATIO) {
                i++;
                continue;
            }
            int j = i;
            BigDecimal peak = BigDecimal.valueOf(jump);
            while (j + 1 < points.size()
                    && Math.abs(points.get(j + 1).value().doubleValue()
                    - points.get(j).value().doubleValue()) > span * FLUCTUATION_SPAN_RATIO) {
                double nextJump = Math.abs(points.get(j + 1).value().doubleValue()
                        - points.get(j).value().doubleValue());
                if (BigDecimal.valueOf(nextJump).compareTo(peak) > 0) {
                    peak = BigDecimal.valueOf(nextJump);
                }
                j++;
            }
            save(anomaly(dataset, metric, "sudden_fluctuation", "warn",
                    points.get(i - 1).time(), points.get(j).time(), j - i + 1, peak, null,
                    metricName(metric) + "相邻采样突变（最大跳变 " + peak + "）"));
            count++;
            i = j + 1;
        }
        return count;
    }

    private DataAnomaly anomaly(DataDataset dataset, DevMetric metric, String type, String severity,
                                LocalDateTime start, LocalDateTime end, int samples,
                                BigDecimal peak, BigDecimal avg, String summary) {
        DataAnomaly item = new DataAnomaly();
        item.setDatasetId(dataset.getId());
        item.setDeviceId(dataset.getDeviceId());
        item.setMetricId(metric != null ? metric.getId() : null);
        item.setAnomalyType(type);
        item.setSeverity(severity);
        item.setStartTime(start);
        item.setEndTime(end);
        item.setSampleCount(samples);
        item.setPeakValue(peak);
        item.setAvgValue(avg);
        item.setSummary(summary);
        return item;
    }

    private String severityOf(BigDecimal value, DevMetricThreshold threshold) {
        double v = value.doubleValue();
        if (threshold.getFaultMin() != null && v < threshold.getFaultMin().doubleValue()) {
            return "fault";
        }
        if (threshold.getFaultMax() != null && v > threshold.getFaultMax().doubleValue()) {
            return "fault";
        }
        if (threshold.getWarnMin() != null && v < threshold.getWarnMin().doubleValue()) {
            return "warn";
        }
        if (threshold.getWarnMax() != null && v > threshold.getWarnMax().doubleValue()) {
            return "warn";
        }
        return null;
    }

    private String metricName(DevMetric metric) {
        return metric != null && metric.getName() != null ? metric.getName() : "指标";
    }

    private List<Long> parseMetricIds(String metricIdsJson) {
        List<Long> result = new ArrayList<>();
        if (metricIdsJson == null || metricIdsJson.isBlank() || "[]".equals(metricIdsJson.trim())) {
            return result;
        }
        String body = metricIdsJson.trim();
        body = body.substring(1, body.length() - 1);
        for (String token : body.split(",")) {
            token = token.trim();
            if (!token.isEmpty()) {
                result.add(Long.valueOf(token));
            }
        }
        return result;
    }

    private record TimePoint(LocalDateTime time, BigDecimal value) {
    }
}