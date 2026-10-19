package com.hwc.aiclient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class GraphQueryRequest {

    private Long nodeRefId;
    private String nodeType;
    private List<String> relationTypes;
    private Integer depth;
}