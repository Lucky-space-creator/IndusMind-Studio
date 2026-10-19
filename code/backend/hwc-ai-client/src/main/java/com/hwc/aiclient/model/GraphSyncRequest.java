package com.hwc.aiclient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class GraphSyncRequest {

    private Long kbId;
    private List<NodeItem> nodes;
    private List<EdgeItem> edges;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NodeItem {

        private Long nodeId;
        private String nodeType;
        private Long refId;
        private String title;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class EdgeItem {

        private Long fromNodeId;
        private Long toNodeId;
        private String relationType;
        private String source;
    }
}