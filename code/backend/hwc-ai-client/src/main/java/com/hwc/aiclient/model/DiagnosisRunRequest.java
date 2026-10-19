package com.hwc.aiclient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class DiagnosisRunRequest {

    private Long deviceId;
    private String deviceName;
    private Long datasetId;
    private Long flowId;
    private List<AnomalyItem> anomalies;
    private String phenomenon;
    private List<AgentConfig> agents;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AnomalyItem {

        private Long metricId;
        private String metricName;
        private String anomalyType;
        private String severity;
        private String startTime;
        private String endTime;
        private Double peakValue;
        private Double avgValue;
        private String summary;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AgentConfig {

        private String agentCode;
        private String instruction;
        private String boundary;
        private String outputFormat;
        private List<Long> kbIds;
        private String matchStrictness;
        private List<String> tools;
        private String triggerCondition;
        private Integer timeoutSeconds;
    }
}