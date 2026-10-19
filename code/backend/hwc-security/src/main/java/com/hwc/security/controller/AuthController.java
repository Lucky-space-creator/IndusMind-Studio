package com.hwc.security.controller;

import com.hwc.common.constant.HwcConstants;
import com.hwc.common.result.Result;
import com.hwc.security.dto.LoginRequest;
import com.hwc.security.dto.LoginResult;
import com.hwc.security.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
}