package com.hwc.devicedata.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

/**
 * 模拟数据生成请求。
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class SimulateRequest {

    private String name;
    private Long deviceId;
    private Integer hours = 24;
    private Integer intervalSec = 60;
    private List<FaultInjection> faultInjections;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FaultInjection {

        private Long metricId;
        private Double fromHour;
        private Double toHour;
        private String severity = "warn";
    }
}