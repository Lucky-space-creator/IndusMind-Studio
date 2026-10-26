package com.hwc.publish.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.domain.publish.PubCallLog;
import com.hwc.domain.publish.PubCredential;
import com.hwc.domain.publish.PubService;
import com.hwc.domain.publish.PubVersion;
import com.hwc.publish.mapper.PubCallLogMapper;
import com.hwc.publish.mapper.PubCredentialMapper;
import com.hwc.publish.mapper.PubServiceMapper;
import com.hwc.publish.mapper.PubVersionMapper;
import com.hwc.publish.service.PublishService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Tag(name = "服务发布")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PublishController {

    private final PubServiceMapper serviceMapper;
    private final PubCredentialMapper credentialMapper;
    private final PubVersionMapper versionMapper;
    private final PubCallLogMapper callLogMapper;
    private final PublishService publishService;

    @Operation(summary = "发布服务分页")
    @GetMapping("/admin/publish/services")
    @PreAuthorize("hasAuthority('publish:service:read')")
    public Result<PageResult<PubService>> page(@RequestParam(defaultValue = "1") long current,
                                               @RequestParam(defaultValue = "10") long size,
                                               @RequestParam(required = false) String keyword,
                                               @RequestParam(required = false) String status) {
        LambdaQueryWrapper<PubService> wrapper = new LambdaQueryWrapper<PubService>()
                .and(keyword != null && !keyword.isBlank(),
                        w -> w.like(PubService::getCode, keyword).or().like(PubService::getName, keyword))
                .eq(status != null && !status.isBlank(), PubService::getStatus, status)
                .orderByDesc(PubService::getId);
        Page<PubService> page = serviceMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "创建发布服务")
    @PostMapping("/admin/publish/services")
    @PreAuthorize("hasAuthority('publish:service:write')")
    public Result<PubService> create(@RequestBody PubService service) {
        return Result.ok(publishService.createService(service));
    }

    @Operation(summary = "修改发布服务（名称/说明/关联流程）")
    @PutMapping("/admin/publish/services/{id}")
    @PreAuthorize("hasAuthority('publish:service:write')")
    public Result<PubService> update(@PathVariable Long id, @RequestBody PubService patch) {
        return Result.ok(publishService.updateService(id, patch));
    }

    @Operation(summary = "服务上线（签发凭证并生成版本）")
    @PutMapping("/admin/publish/services/{id}/publish")
    @PreAuthorize("hasAuthority('publish:service:publish')")
    public Result<PublishService.CredentialIssue> publish(@PathVariable Long id,
                                                          @RequestBody(required = false) Map<String, String> body) {
        String changelog = body == null ? null : body.get("changelog");
        return Result.ok(publishService.publish(id, changelog));
    }

    @Operation(summary = "服务暂停")
    @PutMapping("/admin/publish/services/{id}/pause")
    @PreAuthorize("hasAuthority('publish:service:publish')")
    public Result<Void> pause(@PathVariable Long id) {
        publishService.pause(id);
        return Result.ok();
    }

    @Operation(summary = "轮换凭证")
    @PostMapping("/admin/publish/services/{id}/credential/rotate")
    @PreAuthorize("hasAuthority('publish:credential:write')")
    public Result<PublishService.CredentialIssue> rotate(@PathVariable Long id) {
        return Result.ok(publishService.rotateCredential(id));
    }

    @Operation(summary = "凭证列表（密文脱敏）")
    @GetMapping("/admin/publish/services/{id}/credentials")
    @PreAuthorize("hasAuthority('publish:credential:read')")
    public Result<List<PubCredential>> credentials(@PathVariable Long id) {
        List<PubCredential> credentials = credentialMapper.selectList(
                new LambdaQueryWrapper<PubCredential>()
                        .eq(PubCredential::getServiceId, id)
                        .orderByDesc(PubCredential::getId));
        credentials.forEach(credential -> credential.setSecretKey("******"));
        return Result.ok(credentials);
    }

    @Operation(summary = "版本列表")
    @GetMapping("/admin/publish/services/{id}/versions")
    @PreAuthorize("hasAuthority('publish:service:read')")
    public Result<List<PubVersion>> versions(@PathVariable Long id) {
        return Result.ok(versionMapper.selectList(new LambdaQueryWrapper<PubVersion>()
                .eq(PubVersion::getServiceId, id)
                .orderByDesc(PubVersion::getId)));
    }

    @Operation(summary = "调用日志分页")
    @GetMapping("/admin/publish/call-logs")
    @PreAuthorize("hasAuthority('publish:call-log:read')")
    public Result<PageResult<PubCallLog>> callLogs(@RequestParam(defaultValue = "1") long current,
                                                   @RequestParam(defaultValue = "10") long size,
                                                   @RequestParam(required = false) Long serviceId,
                                                   @RequestParam(required = false) Integer success) {
        LambdaQueryWrapper<PubCallLog> wrapper = new LambdaQueryWrapper<PubCallLog>()
                .eq(serviceId != null, PubCallLog::getServiceId, serviceId)
                .eq(success != null, PubCallLog::getSuccess, success)
                .orderByDesc(PubCallLog::getId);
        Page<PubCallLog> page = callLogMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }
}