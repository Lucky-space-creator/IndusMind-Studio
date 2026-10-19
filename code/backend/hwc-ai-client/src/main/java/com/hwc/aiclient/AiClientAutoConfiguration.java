package com.hwc.aiclient;

import com.hwc.aiclient.client.AgentClient;
import com.hwc.aiclient.client.AiServiceProperties;
import com.hwc.aiclient.client.DocGraphClient;
import com.hwc.aiclient.client.RagClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(AiServiceProperties.class)
@ComponentScan(basePackages = "com.hwc.aiclient")
public class AiClientAutoConfiguration {
}