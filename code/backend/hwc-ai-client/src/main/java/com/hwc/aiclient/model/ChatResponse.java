package com.hwc.aiclient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatResponse {

    private String answer;
    private List<Citation> citations;
    private Boolean hit;
    private String traceId;
}