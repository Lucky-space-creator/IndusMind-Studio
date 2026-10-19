package com.hwc.security.jwt;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "hwc.jwt")
public class JwtProperties {

    private String userSecret = "hwc-user-jwt-secret-change-me-please-32bytes";
    private String adminSecret = "hwc-admin-jwt-secret-change-me-please-32bytes";
    private long expireHours = 12;
}