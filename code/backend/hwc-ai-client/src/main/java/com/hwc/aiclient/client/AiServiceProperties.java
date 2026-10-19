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
}