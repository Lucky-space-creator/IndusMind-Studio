package com.hwc.security.controller;

import com.hwc.common.constant.HwcConstants;
import com.hwc.common.result.Result;
import com.hwc.security.dto.LoginRequest;
import com.hwc.security.dto.LoginResult;
import com.hwc.security.dto.UserProfileResult;
import com.hwc.security.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/user/auth/login")
    public Result<LoginResult> userLogin(@Valid @RequestBody LoginRequest request) {
        return Result.ok(authService.login(request, HwcConstants.END_USER));
    }

    @PostMapping("/admin/auth/login")
    public Result<LoginResult> adminLogin(@Valid @RequestBody LoginRequest request) {
        return Result.ok(authService.login(request, HwcConstants.END_ADMIN));
    }

    /** 当前用户权限档案（用于权限变更后前端同步菜单/按钮，无需重新登录） */
    @GetMapping("/user/auth/profile")
    public Result<UserProfileResult> userProfile() {
        return Result.ok(authService.loadProfile(HwcConstants.END_USER));
    }

    @GetMapping("/admin/auth/profile")
    public Result<UserProfileResult> adminProfile() {
        return Result.ok(authService.loadProfile(HwcConstants.END_ADMIN));
    }
}