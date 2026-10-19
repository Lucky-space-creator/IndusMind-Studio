package com.hwc.security.audit;

import com.hwc.common.context.TraceContext;
import com.hwc.domain.system.SysAuditLog;
import com.hwc.security.core.SecurityUtils;
import com.hwc.security.mapper.SysAuditLogMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditAspect {

    private final SysAuditLogMapper sysAuditLogMapper;

    @Around("@annotation(auditLog)")
    public Object around(ProceedingJoinPoint joinPoint, AuditLog auditLog) throws Throwable {
        boolean success = true;
        String errorMsg = null;
        try {
            return joinPoint.proceed();
        } catch (Throwable e) {
            success = false;
            errorMsg = e.getMessage();
            throw e;
        } finally {
            try {
                record(joinPoint, auditLog, success, errorMsg);
            } catch (Exception ex) {
                log.warn("审计日志记录失败: {}", ex.getMessage());
            }
        }
    }

    private void record(ProceedingJoinPoint joinPoint, AuditLog auditLog, boolean success, String errorMsg) {
        SysAuditLog entity = new SysAuditLog();
        entity.setOperatorId(SecurityUtils.getUserId());
        entity.setOperatorName(SecurityUtils.getUsername());
        entity.setEndpoint(SecurityUtils.getEnd());
        entity.setModule(auditLog.module());
        entity.setAction(auditLog.action());
        entity.setTargetType(auditLog.targetType().isEmpty() ? null : auditLog.targetType());
        entity.setResult(success ? 1 : 0);
        entity.setErrorMsg(errorMsg);
        entity.setTraceId(TraceContext.getTraceId());
        entity.setOperateTime(LocalDateTime.now());

        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes != null) {
            HttpServletRequest request = attributes.getRequest();
            entity.setIp(request.getRemoteAddr());
        }
        sysAuditLogMapper.insert(entity);
    }
}