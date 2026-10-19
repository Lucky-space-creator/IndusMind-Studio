package com.hwc.aiclient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class RagSearchRequest {

    private String query;
    private List<Long> kbIds;
    private Integer topK;
    private String strictness;
}