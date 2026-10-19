package com.hwc.aiclient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatRequest {

    private String sessionId;
    private String question;
    private List<Long> kbIds;
    private String matchStrictness;
}