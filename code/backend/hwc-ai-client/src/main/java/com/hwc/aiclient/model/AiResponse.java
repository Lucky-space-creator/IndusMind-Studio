package com.hwc.aiclient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiResponse<T> {

    private int code;
    private String message;
    private T data;
    private String traceId;

    public boolean isSuccess() {
        return code == 0;
    }
}