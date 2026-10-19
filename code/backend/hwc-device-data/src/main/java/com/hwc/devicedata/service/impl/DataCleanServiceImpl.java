package com.hwc.devicedata.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.device.api.DeviceQueryFacade;
import com.hwc.devicedata.mapper.DataCleanedMapper;
import com.hwc.devicedata.mapper.DataDatasetMapper;
import com.hwc.devicedata.mapper.DataRecordMapper;
import com.hwc.devicedata.service.DataCleanService;
import com.hwc.devicedata.simulate.DataSimulator;
import com.hwc.domain.device.DevMetricThreshold;
import com.hwc.domain.devicedata.DataCleaned;
import com.hwc.domain.devicedata.DataDataset;
import com.hwc.domain.devicedata.DataRecord;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 数据清洗：缺失插值（missing_fill）+ 坏点剔除（outlier_remove）+ 重复去重（dedup，导入已保证唯一键）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataCleanServiceImpl extends ServiceImpl<DataCleanedMapper, DataCleaned> implements DataCleanService {

    private static final int MAX_FILL_PER_GAP = 100;

    private final DataDatasetMapper datasetMapper;
    private final DataRecordMapper recordMapper;
    private final DeviceQueryFacade deviceQueryFacade;
    private final DataSimulator simulator;

    @Override
    @Transactional
    public int clean(Long datasetId) {
        DataDataset dataset = datasetMapper.selectById(datasetId);
        if (dataset == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "数据集不存在");
        }
        List<Long> metricIds = parseMetricIds(dataset.getMetricIds());
        if (metricIds.isEmpty()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "数据集未包含任何指标");
        }
        Map<Long, DevMetricThreshold> thresholds = deviceQueryFacade.getThresholdMap(metricIds);

        remove(new LambdaQueryWrapper<DataCleaned>().eq(DataCleaned::getDatasetId, datasetId));

        int total = 0;
        for (Long metricId : metricIds) {
            List<DataRecord> records = recordMapper.selectList(
                    new LambdaQueryWrapper<DataRecord>()
                            .eq(DataRecord::getDatasetId, datasetId)
                            .eq(DataRecord::getMetricId, metricId)
                            .orderByAsc(DataRecord::getCollectTime));
            if (records.isEmpty()) {
                continue;
            }
            long intervalSec = inferIntervalSec(records);
            DevMetricThreshold threshold = thresholds.get(metricId);
            total += cleanMetric(datasetId, records, intervalSec, threshold);
        }

        dataset.setCleanedCount(total);
        dataset.setStatus("cleaned");
        datasetMapper.updateById(dataset);
        log.info("数据集清洗完成: datasetId={}, cleaned={}", datasetId, total);
        return total;
    }

    private int cleanMetric(Long datasetId, List<DataRecord> records, long intervalSec,
                            DevMetricThreshold threshold) {
        List<DataCleaned> output = new ArrayList<>(records.size());
        for (int i = 0; i < records.size(); i++) {
            DataRecord current = records.get(i);
            output.add(toCleaned(datasetId, current, threshold));

            if (i + 1 < records.size()) {
                DataRecord next = records.get(i + 1);
                long gap = Duration.between(current.getCollectTime(), next.getCollectTime()).getSeconds();
                long missing = intervalSec > 0 ? gap / intervalSec - 1 : 0;
                if (missing > 0) {
                    output.addAll(fillGap(datasetId, current, next, Math.min(missing, MAX_FILL_PER_GAP),
                            intervalSec));
                }
            }
        }
        output.forEach(this::save);
        return output.size();
    }

    private DataCleaned toCleaned(Long datasetId, DataRecord record, DevMetricThreshold threshold) {
        DataCleaned cleaned = new DataCleaned();
        cleaned.setDatasetId(datasetId);
        cleaned.setRecordId(record.getId());
        cleaned.setMetricId(record.getMetricId());
        cleaned.setCollectTime(record.getCollectTime());
        cleaned.setRawValue(record.getMetricValue());
        if (threshold != null && isBadPoint(record.getMetricValue(), threshold)) {
            cleaned.setCleanedValue(null);
            cleaned.setIsModified(1);
            cleaned.setRulesApplied("[\"outlier_remove\"]");
            cleaned.setRemark("超出物理合理区间，判定为坏点剔除");
        } else {
            cleaned.setCleanedValue(record.getMetricValue());
            cleaned.setIsModified(0);
        }
        return cleaned;
    }

    private List<DataCleaned> fillGap(Long datasetId, DataRecord from, DataRecord to, long missing, long intervalSec) {
        List<DataCleaned> filled = new ArrayList<>();
        BigDecimal delta = to.getMetricValue().subtract(from.getMetricValue())
                .divide(BigDecimal.valueOf(missing + 1), 4, RoundingMode.HALF_UP);
        for (int k = 1; k <= missing; k++) {
            LocalDateTime time = from.getCollectTime().plusSeconds(intervalSec * k);
            if (!time.isBefore(to.getCollectTime())) {
                break;
            }
            DataCleaned cleaned = new DataCleaned();
            cleaned.setDatasetId(datasetId);
            cleaned.setRecordId(0L);
            cleaned.setMetricId(from.getMetricId());
            cleaned.setCollectTime(time);
            cleaned.setRawValue(null);
            cleaned.setCleanedValue(from.getMetricValue().add(delta.multiply(BigDecimal.valueOf(k))));
            cleaned.setIsModified(1);
            cleaned.setRulesApplied("[\"missing_fill\"]");
            cleaned.setRemark("采样缺失，线性插值补点");
            filled.add(cleaned);
        }
        return filled;
    }

    private boolean isBadPoint(BigDecimal value, DevMetricThreshold threshold) {
        double width = simulator.span(threshold);
        double lower = threshold.getFaultMin() != null ? threshold.getFaultMin().doubleValue() - width * 0.5
                : Double.NEGATIVE_INFINITY;
        double upper = threshold.getFaultMax() != null ? threshold.getFaultMax().doubleValue() + width * 0.5
                : Double.POSITIVE_INFINITY;
        double v = value.doubleValue();
        return v < lower || v > upper;
    }

    private long inferIntervalSec(List<DataRecord> records) {
        if (records.size() < 2) {
            return 0;
        }
        long min = Long.MAX_VALUE;
        for (int i = 1; i < records.size(); i++) {
            long gap = Duration.between(records.get(i - 1).getCollectTime(), records.get(i).getCollectTime()).getSeconds();
            if (gap > 0) {
                min = Math.min(min, gap);
            }
        }
        return min == Long.MAX_VALUE ? 0 : min;
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
}