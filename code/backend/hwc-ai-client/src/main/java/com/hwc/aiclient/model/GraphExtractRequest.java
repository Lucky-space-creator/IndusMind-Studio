package com.hwc.aiclient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class GraphExtractRequest {

    private Long kbId;
    private List<SegmentRef> segments;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SegmentRef {

        private Long segmentId;
        private Long docId;
        private String content;
        private String chapter;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CandidateEdge {

        private Long fromRefId;
        private String fromNodeType;
        private Long toRefId;
        private String toNodeType;
        private String relationType;
        private BigDecimal confidence;
        private String source;
    }
}