package com.hwc.aiclient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class DiagnosisRunResponse {

    private String runId;
    private List<StepResult> steps;
    private String conclusion;
    private String riskLevel;
    private List<Citation> citations;
    private String traceId;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class StepResult {

        private Integer stepOrder;
        private String agentCode;
        private String agentName;
        private String status;
        private String summary;
        private String output;
        private List<Citation> citations;
        private Integer durationMs;
    }
}