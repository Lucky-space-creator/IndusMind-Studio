package com.hwc.commonweb.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI hwcOpenApi() {
        return new OpenAPI().info(new Info()
                .title("HWC 设备运维智能系统 API")
                .description("工业设备巡检与运维智能系统后端接口")
                .version("1.0.0"));
    }
}