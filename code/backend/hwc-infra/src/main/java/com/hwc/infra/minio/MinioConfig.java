package com.hwc.infra.minio;

import io.minio.MinioClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MinioConfig {

    @Bean
    public MinioClient minioClient(
            @Value("${hwc.minio.endpoint:http://localhost:9000}") String endpoint,
            @Value("${hwc.minio.access-key:hwcadmin}") String accessKey,
            @Value("${hwc.minio.secret-key:hwc123456}") String secretKey) {
        return MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
    }
}