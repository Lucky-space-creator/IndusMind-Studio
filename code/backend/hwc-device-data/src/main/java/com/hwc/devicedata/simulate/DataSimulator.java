package com.hwc.devicedata.simulate;

import com.hwc.domain.device.DevMetric;
import com.hwc.domain.device.DevMetricThreshold;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * 模拟数据生成器：基于指标阈值生成正常波动序列，并按注入计划生成越限故障段。
 */
@Component
public class DataSimulator {

    public record GeneratedPoint(LocalDateTime collectTime, BigDecimal value) {
    }

    public record Injection(Long metricId, long fromOffsetSec, long toOffsetSec, String severity) {
    }

    private final Random random = new Random(42L);

    public List<GeneratedPoint> generate(DevMetric metric, DevMetricThreshold threshold,
                                         LocalDateTime startTime, int points, int intervalSec,
                                         List<Injection> injections) {
        List<GeneratedPoint> result = new ArrayList<>(points);
        double base = 100;
        double amp = 10;
        if (threshold != null && threshold.getNormalMin() != null && threshold.getNormalMax() != null) {
            base = (threshold.getNormalMin().doubleValue() + threshold.getNormalMax().doubleValue()) / 2;
            amp = (threshold.getNormalMax().doubleValue() - threshold.getNormalMin().doubleValue()) * 0.3;
        }
        for (int i = 0; i < points; i++) {
            LocalDateTime time = startTime.plusSeconds((long) i * intervalSec);
            long offsetSec = (long) i * intervalSec;
            double target = base + amp * Math.sin(i / 8.0);
            for (Injection injection : injections) {
                if (!injection.metricId().equals(metric.getId())) {
                    continue;
                }
                if (offsetSec >= injection.fromOffsetSec() && offsetSec < injection.toOffsetSec()) {
                    target = resolveTarget(threshold, base, amp, injection.severity());
                }
            }
            double noise = amp * 0.05 * random.nextGaussian();
            double value = target + noise;
            result.add(new GeneratedPoint(time, BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP)));
        }
        return result;
    }

    private double resolveTarget(DevMetricThreshold threshold, double base, double amp, String severity) {
        if (threshold == null) {
            return "fault".equals(severity) ? base + amp * 2 : base + amp * 1.2;
        }
        Double faultMax = threshold.getFaultMax() != null ? threshold.getFaultMax().doubleValue() : null;
        Double faultMin = threshold.getFaultMin() != null ? threshold.getFaultMin().doubleValue() : null;
        Double warnMax = threshold.getWarnMax() != null ? threshold.getWarnMax().doubleValue() : null;
        Double warnMin = threshold.getWarnMin() != null ? threshold.getWarnMin().doubleValue() : null;
        double width = span(threshold);
        if ("fault".equals(severity)) {
            if (faultMax != null) {
                return faultMax + width * 0.25;
            }
            if (faultMin != null) {
                return faultMin - width * 0.25;
            }
            return base + amp * 2;
        }
        if (warnMax != null && faultMax != null) {
            return (warnMax + faultMax) / 2;
        }
        if (warnMin != null && faultMin != null) {
            return (warnMin + faultMin) / 2;
        }
        return base + amp * 1.2;
    }

    public double span(DevMetricThreshold threshold) {
        double min = threshold.getNormalMin() != null ? threshold.getNormalMin().doubleValue() : 0;
        double max = threshold.getNormalMax() != null ? threshold.getNormalMax().doubleValue() : min + 100;
        return Math.max(max - min, 1);
    }
}