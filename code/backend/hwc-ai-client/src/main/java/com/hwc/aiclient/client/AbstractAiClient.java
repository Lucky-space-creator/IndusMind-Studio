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
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.util.function.Supplier;

@Slf4j
public abstract class AbstractAiClient {

    private static final ParameterizedTypeReference<AiResponse<JsonNode>> RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {
            };

    protected final RestClient restClient;
    protected final ObjectMapper objectMapper;
    private final String moduleName;

    protected AbstractAiClient(RestClient.Builder builder, AiServiceProperties properties,
                               ObjectMapper objectMapper, String moduleName) {
        this.restClient = builder
                .baseUrl(properties.getBaseUrl())
                .build();
        this.objectMapper = objectMapper;
        this.moduleName = moduleName;
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
        AiResponse<JsonNode> response = executeWithRetry(() -> restClient.post()
                .uri(path)
                .header(HwcConstants.HEADER_TRACE_ID, TraceContext.ensureTraceId())
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, resp) -> {
                    throw new BizException(CommonErrorCode.AI_SERVICE_UNAVAILABLE,
                            "AI 服务响应异常（" + moduleName + "），请稍后重试");
                })
                .body(RESPONSE_TYPE));
        if (response == null) {
            throw new BizException(CommonErrorCode.AI_SERVICE_UNAVAILABLE, "AI 服务无响应");
        }
        if (!response.isSuccess()) {
            log.warn("AI 服务业务失败（{}）: {}", moduleName, response.getMessage());
            throw new BizException(CommonErrorCode.AI_SERVICE_UNAVAILABLE, response.getMessage());
        }
        return response.getData();
    }

    private AiResponse<JsonNode> executeWithRetry(Supplier<AiResponse<JsonNode>> call) {
        AiResponse<JsonNode> response = null;
        int attempts = 2;
        for (int i = 0; i < attempts; i++) {
            try {
                response = call.get();
                break;
            } catch (ResourceAccessException e) {
                log.warn("AI 服务网络异常（{}）第{}次: {}", moduleName, i + 1, e.getMessage());
                if (i == attempts - 1) {
                    throw new BizException(CommonErrorCode.AI_SERVICE_UNAVAILABLE,
                            "AI 服务暂不可用，请检查服务状态");
                }
            }
        }
        return response;
    }

    private BizException convertError(Exception e) {
        return new BizException(CommonErrorCode.AI_SERVICE_UNAVAILABLE,
                "AI 服务响应解析失败（" + moduleName + "）");
    }
}