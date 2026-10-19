package com.hwc.security.controller;

import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.security.audit.AuditLog;
import com.hwc.security.dto.account.UserCreateRequest;
import com.hwc.security.dto.account.UserUpdateRequest;
import com.hwc.security.dto.account.UserVO;
import com.hwc.security.service.SysUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "账号权限-用户管理")
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "hwc.security.end-type", havingValue = "admin")
public class AccountUserController {

    private final SysUserService sysUserService;

    @Operation(summary = "用户分页查询")
    @GetMapping("/account/users")
    @PreAuthorize("hasAuthority('account:user:read')")
    public Result<PageResult<UserVO>> pageUsers(@RequestParam(defaultValue = "1") long current,
                                                @RequestParam(defaultValue = "10") long size,
                                                @RequestParam(required = false) String keyword,
                                                @RequestParam(required = false) Integer status) {
        return Result.ok(sysUserService.pageUsers(current, size, keyword, status));
    }

    @Operation(summary = "新增用户")
    @PostMapping("/account/users")
    @PreAuthorize("hasAuthority('account:user:write')")
    @AuditLog(module = "account", action = "create", targetType = "user")
    public Result<UserVO> createUser(@Valid @RequestBody UserCreateRequest request) {
        return Result.ok(sysUserService.createUser(request));
    }

    @Operation(summary = "更新用户")
    @PutMapping("/account/users/{id}")
    @PreAuthorize("hasAuthority('account:user:write')")
    @AuditLog(module = "account", action = "update", targetType = "user")
    public Result<Void> updateUser(@PathVariable Long id, @Valid @RequestBody UserUpdateRequest request) {
        sysUserService.updateUser(id, request);
        return Result.ok();
    }

    @Operation(summary = "删除用户")
    @DeleteMapping("/account/users/{id}")
    @PreAuthorize("hasAuthority('account:user:delete')")
    @AuditLog(module = "account", action = "delete", targetType = "user")
    public Result<Void> deleteUser(@PathVariable Long id) {
        sysUserService.deleteUser(id);
        return Result.ok();
    }
}