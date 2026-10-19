package com.hwc.aiclient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class RagSearchResponse {

    private List<SegmentHit> segments;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SegmentHit {

        private Long segmentId;
        private Long docId;
        private String docName;
        private String chapter;
        private Integer pageNo;
        private String content;
        private BigDecimal score;
    }
}