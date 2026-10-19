package com.hwc.security.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "hwc.security")
public class SecurityProperties {

    private String endType = "user";

    private String[] whitelist = {
            "/api/*/auth/login",
            "/health",
            "/v3/api-docs/**",
            "/swagger-ui/**",
            "/swagger-ui.html",
            HwcOpenPaths.OPEN_INVOKE
    };

    public static final class HwcOpenPaths {

        public static final String OPEN_INVOKE = "/api/open/v1/**";
    }
}