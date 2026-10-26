package com.hwc.commonweb.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebCorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                // 本机开发：同时放行 localhost 与 127.0.0.1，且不限端口
                // （vite 端口被占用时会自动 +1，原先写死 5173/5174 会导致换端口后全部请求 403
                //   "Invalid CORS request"；localhost 与 127.0.0.1 属于不同 Origin，也需分别放行）
                .allowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("X-Trace-Id")
                .allowCredentials(true)
                .maxAge(3600);
    }
}