package com.hwc.aiclient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class RagIndexRequest {

    private Long kbId;
    private Long docId;
    private String docName;
    private String docStatus;
    private List<SegmentItem> segments;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SegmentItem {

        private Long segmentId;
        private Integer seqNo;
        private String content;
        private String chapter;
        private Integer pageNo;
        private String keywords;
    }
}