package com.hwc.device.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.device.mapper.DevMetricThresholdMapper;
import com.hwc.device.service.DevMetricThresholdService;
import com.hwc.domain.device.DevMetricThreshold;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class DevMetricThresholdServiceImpl extends ServiceImpl<DevMetricThresholdMapper, DevMetricThreshold>
        implements DevMetricThresholdService {

    @Override
    public void validateRange(DevMetricThreshold threshold) {
        if (threshold == null
                || threshold.getFaultMin() == null || threshold.getWarnMin() == null
                || threshold.getNormalMin() == null || threshold.getNormalMax() == null
                || threshold.getWarnMax() == null || threshold.getFaultMax() == null) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "阈值区间字段不能为空");
        }
        BigDecimal faultMin = threshold.getFaultMin();
        BigDecimal warnMin = threshold.getWarnMin();
        BigDecimal normalMin = threshold.getNormalMin();
        BigDecimal normalMax = threshold.getNormalMax();
        BigDecimal warnMax = threshold.getWarnMax();
        BigDecimal faultMax = threshold.getFaultMax();
        boolean ordered = faultMin.compareTo(warnMin) <= 0
                && warnMin.compareTo(normalMin) <= 0
                && normalMin.compareTo(normalMax) <= 0
                && normalMax.compareTo(warnMax) <= 0
                && warnMax.compareTo(faultMax) <= 0;
        if (!ordered) {
            throw new BizException(CommonErrorCode.PARAM_INVALID,
                    "阈值区间必须满足 fault_min≤warn_min≤normal_min≤normal_max≤warn_max≤fault_max");
        }
    }
}