package com.hwc.security.controller;

import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.security.audit.AuditLog;
import com.hwc.security.dto.audit.AuditLogExportQuery;
import com.hwc.security.dto.audit.AuditLogPageQuery;
import com.hwc.security.dto.audit.AuditLogVO;
import com.hwc.security.service.AuditLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@Tag(name = "审计日志")
@RestController
@RequestMapping("/api/admin/audit")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "hwc.security.end-type", havingValue = "admin")
public class AuditLogController {

    private final AuditLogService auditLogService;

    @Operation(summary = "审计日志分页查询")
    @GetMapping("/logs")
    @PreAuthorize("hasAuthority('audit:log:read')")
    public Result<PageResult<AuditLogVO>> pageAuditLogs(@Valid AuditLogPageQuery query) {
        return Result.ok(auditLogService.pageAuditLogs(query));
    }

    @Operation(summary = "审计日志导出 CSV")
    @GetMapping("/logs/export")
    @PreAuthorize("hasAuthority('audit:log:export')")
    @AuditLog(module = "audit", action = "export", targetType = "audit_log")
    public ResponseEntity<byte[]> exportAuditLogs(@Valid AuditLogExportQuery query) {
        byte[] csv = auditLogService.exportAuditLogs(query);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=audit-logs.csv")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv);
    }
}