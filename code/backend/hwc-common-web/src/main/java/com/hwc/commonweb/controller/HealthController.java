package com.hwc.commonweb.controller;

import com.hwc.common.result.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 健康检查端点（白名单放行，供部署探活使用）。
 */
@RestController
public class HealthController {

    @GetMapping("/health")
    public Result<Map<String, Object>> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "UP");
        body.put("timestamp", System.currentTimeMillis());
        return Result.ok(body);
    }
}