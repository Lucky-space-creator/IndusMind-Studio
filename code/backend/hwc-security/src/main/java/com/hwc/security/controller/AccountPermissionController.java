package com.hwc.security.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.common.result.Result;
import com.hwc.domain.system.SysPermission;
import com.hwc.security.mapper.SysPermissionMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "账号权限-权限点")
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "hwc.security.end-type", havingValue = "admin")
public class AccountPermissionController {

    private final SysPermissionMapper sysPermissionMapper;

    @Operation(summary = "权限点全量查询")
    @GetMapping("/account/permissions")
    @PreAuthorize("hasAuthority('account:role:read')")
    public Result<List<SysPermission>> listPermissions() {
        return Result.ok(sysPermissionMapper.selectList(new LambdaQueryWrapper<SysPermission>()
                .orderByAsc(SysPermission::getSort)));
    }
}