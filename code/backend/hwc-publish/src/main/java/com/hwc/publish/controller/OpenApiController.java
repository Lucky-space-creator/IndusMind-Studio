package com.hwc.publish.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.agent.api.DiagnosisQueryFacade;
import com.hwc.aiclient.model.DiagnosisRunResponse;
import com.hwc.common.context.TraceContext;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.Result;
import com.hwc.domain.publish.PubCallLog;
import com.hwc.domain.publish.PubCredential;
import com.hwc.domain.publish.PubService;
import com.hwc.publish.mapper.PubCallLogMapper;
import com.hwc.publish.mapper.PubCredentialMapper;
import com.hwc.publish.mapper.PubServiceMapper;
import com.hwc.publish.util.AesCipher;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;

/**
 * 开放 API：Bearer Base64(accessKey:secret) 鉴权 → 触发协同诊断 → 记录调用日志。
 */
@Slf4j
@Tag(name = "开放 API")
@RestController
@RequestMapping("/api/open/v1")
@RequiredArgsConstructor
public class OpenApiController {

    private final PubServiceMapper serviceMapper;
    private final PubCredentialMapper credentialMapper;
    private final PubCallLogMapper callLogMapper;
    private final DiagnosisQueryFacade diagnosisQueryFacade;
    private final AesCipher aesCipher;

    @Operation(summary = "调用已发布诊断服务")
    @PostMapping("/{serviceCode}/invoke")
    public Result<DiagnosisRunResponse> invoke(@PathVariable String serviceCode,
                                               @RequestBody Map<String, Object> body,
                                               HttpServletRequest request) {
        long start = System.currentTimeMillis();
        PubService service = serviceMapper.selectOne(new LambdaQueryWrapper<PubService>()
                .eq(PubService::getCode, serviceCode));
        if (service == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "服务不存在: " + serviceCode);
        }
        PubCredential credential = authenticate(service.getId(), request);
        Long deviceId = parseBodyLong(body, "deviceId");
        Long datasetId = parseBodyLong(body, "datasetId");
        String phenomenon = body.get("phenomenon") == null ? null : String.valueOf(body.get("phenomenon"));
        try {
            if (!"online".equals(service.getStatus())) {
                throw new BizException(CommonErrorCode.PARAM_INVALID, "服务未上线或已暂停");
            }
            DiagnosisRunResponse response = diagnosisQueryFacade.run(deviceId, datasetId, service.getFlowId(), phenomenon);
            saveLog(service.getId(), credential.getId(), start, 1, 200, null);
            return Result.ok(response);
        } catch (BizException e) {
            saveLog(service.getId(), credential.getId(), start, 0, e.getHttpStatus(), e.getMessage());
            throw e;
        } catch (Exception e) {
            saveLog(service.getId(), credential.getId(), start, 0, 500, e.getMessage());
            throw new BizException(CommonErrorCode.INTERNAL_ERROR, "服务调用异常");
        }
    }

    private Long parseBodyLong(Map<String, Object> body, String field) {
        Object value = body.get(field);
        if (value == null) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, field + " 不能为空");
        }
        try {
            return Long.valueOf(String.valueOf(value));
        } catch (NumberFormatException e) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, field + " 必须为数字");
        }
    }

    private PubCredential authenticate(Long serviceId, HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            throw new BizException(CommonErrorCode.UNAUTHORIZED, "缺少 Bearer 凭证");
        }
        String decoded;
        try {
            decoded = new String(Base64.getDecoder().decode(header.substring(7)), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new BizException(CommonErrorCode.UNAUTHORIZED, "凭证格式错误（应为 Base64(accessKey:secret)）");
        }
        int split = decoded.indexOf(':');
        if (split <= 0) {
            throw new BizException(CommonErrorCode.UNAUTHORIZED, "凭证格式错误（应为 Base64(accessKey:secret)）");
        }
        String accessKey = decoded.substring(0, split);
        String secret = decoded.substring(split + 1);

        PubCredential credential = credentialMapper.selectOne(new LambdaQueryWrapper<PubCredential>()
                .eq(PubCredential::getServiceId, serviceId)
                .eq(PubCredential::getAccessKey, accessKey)
                .eq(PubCredential::getStatus, "active")
                .orderByDesc(PubCredential::getId)
                .last("LIMIT 1"));
        if (credential == null
                || credential.getExpireTime() != null && credential.getExpireTime().isBefore(LocalDateTime.now())
                || !aesCipher.decrypt(credential.getSecretKey()).equals(secret)) {
            throw new BizException(CommonErrorCode.UNAUTHORIZED, "凭证无效或已过期");
        }
        return credential;
    }

    private void saveLog(Long serviceId, Long credentialId, long start, int success, int httpStatus, String errorMsg) {
        try {
            PubCallLog callLog = new PubCallLog();
            callLog.setServiceId(serviceId);
            callLog.setCredentialId(credentialId);
            callLog.setTraceId(TraceContext.getTraceId());
            callLog.setApiPath("/api/open/v1/invoke");
            callLog.setLatencyMs((int) (System.currentTimeMillis() - start));
            callLog.setSuccess(success);
            callLog.setHttpStatus(httpStatus);
            callLog.setErrorMsg(errorMsg);
            callLog.setCallTime(LocalDateTime.now());
            callLogMapper.insert(callLog);
        } catch (Exception e) {
            log.warn("调用日志写入失败: {}", e.getMessage());
        }
    }
}