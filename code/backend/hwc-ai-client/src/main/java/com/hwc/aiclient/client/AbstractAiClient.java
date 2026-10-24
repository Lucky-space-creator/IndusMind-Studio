package com.hwc.aiclient.client;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwc.aiclient.model.AiResponse;
import com.hwc.common.constant.HwcConstants;
import com.hwc.common.context.TraceContext;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

/**
 * AI 服务调用基类：统一重试 + 熔断降级。
 *
 * <p>熔断状态机（每个模块独立）：
 * <ul>
 *   <li>CLOSED：正常放行，连续失败达到阈值后转 OPEN；</li>
 *   <li>OPEN：直接拒绝（不发起网络调用），持续 {@code hwc.ai.circuit-open-ms}；</li>
 *   <li>HALF_OPEN：到期后放行单个探测请求，成功则恢复 CLOSED，失败立即回到 OPEN。</li>
 * </ul>
 * 仅「服务不可达 / 5xx」计入熔断；4xx 参数类错误属于调用方问题，不计入。
 */
@Slf4j
public abstract class AbstractAiClient {

    private static final ParameterizedTypeReference<AiResponse<JsonNode>> RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {
            };

    protected final RestClient restClient;
    protected final ObjectMapper objectMapper;
    private final String moduleName;

    private final int maxAttempts;
    private final int failureThreshold;
    private final long openDurationMs;

    /** 连续失败次数（OPEN 后不再累加） */
    private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
    /** 熔断截止时间戳（0 表示未熔断） */
    private final AtomicLong openUntil = new AtomicLong(0L);
    /** 半开探测占用标记，保证同一时刻只有一个探测请求 */
    private final AtomicBoolean halfOpenProbeInFlight = new AtomicBoolean(false);

    protected AbstractAiClient(RestClient.Builder builder, AiServiceProperties properties,
                               ObjectMapper objectMapper, String moduleName) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(properties.getConnectTimeoutMs());
        requestFactory.setReadTimeout(properties.getReadTimeoutMs());
        this.restClient = builder
                .baseUrl(properties.getBaseUrl())
                .requestFactory(requestFactory)
                .build();
        this.objectMapper = objectMapper;
        this.moduleName = moduleName;
        this.maxAttempts = Math.max(1, properties.getRetryCount() + 1);
        this.failureThreshold = Math.max(1, properties.getCircuitFailureThreshold());
        this.openDurationMs = Math.max(1000L, properties.getCircuitOpenMs());
    }

    protected <T> T post(String path, Object body, Class<T> dataType) {
        return postAndConvert(path, body, dataType);
    }

    protected <T> T post(String path, Object body, TypeReference<T> dataType) {
        JsonNode data = postForData(path, body);
        try {
            return objectMapper.convertValue(data, dataType);
        } catch (IllegalArgumentException e) {
            throw convertError(e);
        }
    }

    private <T> T postAndConvert(String path, Object body, Class<T> dataType) {
        JsonNode data = postForData(path, body);
        if (data == null) {
            return null;
        }
        try {
            return objectMapper.convertValue(data, dataType);
        } catch (IllegalArgumentException e) {
            throw convertError(e);
        }
    }

    private JsonNode postForData(String path, Object body) {
        if (!tryAcquire()) {
            long waitSeconds = Math.max(1L, (openUntil.get() - System.currentTimeMillis()) / 1000L);
            throw new BizException(CommonErrorCode.SERVICE_UNAVAILABLE,
                    "AI 服务（" + moduleName + "）已熔断，请 " + waitSeconds + " 秒后重试");
        }
        AiResponse<JsonNode> response;
        try {
            response = executeWithRetry(() -> restClient.post()
                    .uri(path)
                    .header(HwcConstants.HEADER_TRACE_ID, TraceContext.ensureTraceId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        if (resp.getStatusCode().is5xxServerError()) {
                            throw new BizException(CommonErrorCode.SERVICE_UNAVAILABLE,
                                    "AI 服务内部异常（" + moduleName + "），请稍后重试");
                        }
                        throw new BizException(CommonErrorCode.PARAM_INVALID,
                                "AI 服务拒绝了本次请求（" + moduleName + "），请检查输入参数");
                    })
                    .body(RESPONSE_TYPE));
        } catch (RuntimeException e) {
            onFailure(e);
            throw e;
        }
        onSuccess();
        if (response == null) {
            throw new BizException(CommonErrorCode.AI_SERVICE_UNAVAILABLE, "AI 服务无响应");
        }
        if (!response.isSuccess()) {
            // 服务可达但业务失败：不计入熔断
            log.warn("AI 服务业务失败（{}）: {}", moduleName, response.getMessage());
            throw new BizException(CommonErrorCode.AI_SERVICE_UNAVAILABLE, response.getMessage());
        }
        return response.getData();
    }

    private AiResponse<JsonNode> executeWithRetry(Supplier<AiResponse<JsonNode>> call) {
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return call.get();
            } catch (ResourceAccessException e) {
                log.warn("AI 服务网络异常（{}）第{}/{}次: {}", moduleName, attempt, maxAttempts, e.getMessage());
                if (attempt == maxAttempts) {
                    throw new BizException(CommonErrorCode.AI_SERVICE_UNAVAILABLE,
                            "AI 服务暂不可用，请检查服务状态");
                }
                sleepBackoff(attempt);
            }
        }
        return null;
    }

    private void sleepBackoff(int attempt) {
        try {
            Thread.sleep(Math.min(1000L, 200L * attempt));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** 是否放行本次请求（含半开探测） */
    private boolean tryAcquire() {
        long until = openUntil.get();
        if (until == 0L) {
            return true;
        }
        if (System.currentTimeMillis() < until) {
            return false;
        }
        // 半开：只允许一个探测请求
        if (halfOpenProbeInFlight.compareAndSet(false, true)) {
            log.info("AI 服务（{}）进入半开状态，放行探测请求", moduleName);
            return true;
        }
        return false;
    }

    private void onSuccess() {
        boolean wasOpen = openUntil.get() != 0L;
        consecutiveFailures.set(0);
        openUntil.set(0L);
        halfOpenProbeInFlight.set(false);
        if (wasOpen) {
            log.info("AI 服务（{}）已恢复，熔断关闭", moduleName);
        }
    }

    private void onFailure(RuntimeException e) {
        boolean probe = halfOpenProbeInFlight.get() && openUntil.get() != 0L;
        halfOpenProbeInFlight.set(false);
        if (!isAvailabilityFailure(e)) {
            if (probe) {
                // 探测请求拿到的是业务/参数类响应，说明服务可达，熔断正常关闭
                onSuccess();
            }
            return;
        }
        if (probe) {
            // 半开探测失败：立即重新熔断
            openUntil.set(System.currentTimeMillis() + openDurationMs);
            log.warn("AI 服务（{}）探测失败，继续保持熔断 {} ms", moduleName, openDurationMs);
            return;
        }
        int failures = consecutiveFailures.incrementAndGet();
        if (failures >= failureThreshold) {
            openUntil.set(System.currentTimeMillis() + openDurationMs);
            consecutiveFailures.set(0);
            log.warn("AI 服务（{}）连续失败 {} 次，熔断 {} ms", moduleName, failures, openDurationMs);
        }
    }

    private boolean isAvailabilityFailure(RuntimeException e) {
        return e instanceof BizException biz && biz.getHttpStatus() >= 500;
    }

    private BizException convertError(Exception e) {
        return new BizException(CommonErrorCode.AI_SERVICE_UNAVAILABLE,
                "AI 服务响应解析失败（" + moduleName + "）");
    }
}
