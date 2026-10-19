package com.hwc.security.controller;

import com.hwc.common.result.Result;
import com.hwc.security.audit.AuditLog;
import com.hwc.security.dto.account.DataScopeSaveRequest;
import com.hwc.security.dto.account.DataScopeVO;
import com.hwc.security.dto.account.RoleCreateRequest;
import com.hwc.security.dto.account.RoleUpdateRequest;
import com.hwc.security.dto.account.RoleVO;
import com.hwc.security.service.SysRoleDataScopeService;
import com.hwc.security.service.SysRoleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "账号权限-角色与数据范围")
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "hwc.security.end-type", havingValue = "admin")
public class AccountRoleController {

    private final SysRoleService sysRoleService;
    private final SysRoleDataScopeService sysRoleDataScopeService;

    @Operation(summary = "角色全量列表")
    @GetMapping("/account/roles")
    @PreAuthorize("hasAuthority('account:role:read')")
    public Result<List<RoleVO>> listRoles() {
        return Result.ok(sysRoleService.listRoles());
    }

    @Operation(summary = "新增角色")
    @PostMapping("/account/roles")
    @PreAuthorize("hasAuthority('account:role:write')")
    @AuditLog(module = "account", action = "create", targetType = "role")
    public Result<RoleVO> createRole(@Valid @RequestBody RoleCreateRequest request) {
        return Result.ok(sysRoleService.createRole(request));
    }

    @Operation(summary = "更新角色")
    @PutMapping("/account/roles/{id}")
    @PreAuthorize("hasAuthority('account:role:write')")
    @AuditLog(module = "account", action = "update", targetType = "role")
    public Result<Void> updateRole(@PathVariable Long id, @Valid @RequestBody RoleUpdateRequest request) {
        sysRoleService.updateRole(id, request);
        return Result.ok();
    }

    @Operation(summary = "查询角色数据范围")
    @GetMapping("/account/roles/{roleId}/data-scopes")
    @PreAuthorize("hasAuthority('account:role:read')")
    public Result<List<DataScopeVO>> listRoleDataScopes(@PathVariable Long roleId) {
        return Result.ok(sysRoleDataScopeService.listByRoleId(roleId));
    }

    @Operation(summary = "保存角色数据范围")
    @PutMapping("/account/roles/{roleId}/data-scopes")
    @PreAuthorize("hasAuthority('account:role:write')")
    @AuditLog(module = "account", action = "update", targetType = "data_scope")
    public Result<Void> saveRoleDataScope(@PathVariable Long roleId,
                                          @Valid @RequestBody DataScopeSaveRequest request) {
        sysRoleDataScopeService.saveRoleDataScope(roleId, request);
        return Result.ok();
    }
}