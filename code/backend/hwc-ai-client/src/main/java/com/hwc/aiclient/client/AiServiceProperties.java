package com.hwc.aiclient.client;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "hwc.ai")
public class AiServiceProperties {

    private String baseUrl = "http://localhost:8100";
    private int connectTimeoutMs = 5000;
    private int readTimeoutMs = 120000;
    private int retryCount = 1;
    /** 熔断：连续失败多少次后打开（默认 3） */
    private int circuitFailureThreshold = 3;
    /** 熔断：保持打开时长（毫秒，默认 30s） */
    private long circuitOpenMs = 30000L;
}