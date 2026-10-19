package com.hwc.aiclient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class GraphQueryResponse {

    private List<RelatedNode> nodes;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RelatedNode {

        private Long refId;
        private String nodeType;
        private String title;
        private String relationType;
        private Long viaNodeId;
        private Integer hop;
    }
}