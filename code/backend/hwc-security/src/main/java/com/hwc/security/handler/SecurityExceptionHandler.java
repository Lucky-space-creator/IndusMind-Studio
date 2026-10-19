package com.hwc.security.handler;

import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 安全相关异常统一处理：将权限拒绝映射为 403 / COMMON_4003，
 * 避免落入通用兜底分支返回 500。
 */
@Slf4j
@RestControllerAdvice
public class SecurityExceptionHandler {

    @ExceptionHandler(AuthorizationDeniedException.class)
    public ResponseEntity<Result<Void>> handleAuthorizationDenied(AuthorizationDeniedException e) {
        log.warn("权限不足: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Result.fail(CommonErrorCode.FORBIDDEN));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Result<Void>> handleAccessDenied(AccessDeniedException e) {
        log.warn("访问被拒绝: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Result.fail(CommonErrorCode.FORBIDDEN));
    }
}