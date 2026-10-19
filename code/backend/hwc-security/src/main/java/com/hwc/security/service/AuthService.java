package com.hwc.security.service;

import com.hwc.common.constant.HwcConstants;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.domain.system.SysPermission;
import com.hwc.domain.system.SysRole;
import com.hwc.domain.system.SysUser;
import com.hwc.infra.mybatis.CurrentUserHolder;
import com.hwc.security.dto.LoginRequest;
import com.hwc.security.dto.LoginResult;
import com.hwc.security.jwt.JwtTokenService;
import com.hwc.security.mapper.SysPermissionMapper;
import com.hwc.security.mapper.SysRoleMapper;
import com.hwc.security.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final SysUserMapper sysUserMapper;
    private final SysRoleMapper sysRoleMapper;
    private final SysPermissionMapper sysPermissionMapper;
    private final JwtTokenService jwtTokenService;
    private final BCryptPasswordEncoder passwordEncoder;

    public LoginResult login(LoginRequest request, String end) {
        SysUser user = sysUserMapper.selectByUsername(request.getUsername());
        if (user == null || user.getStatus() == null || user.getStatus() != HwcConstants.STATUS_ENABLED) {
            throw badCredentials();
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw badCredentials();
        }

        List<SysRole> roles = sysRoleMapper.selectUserRolesByEnd(user.getId(), end);
        if (roles.isEmpty()) {
            throw new BizException(CommonErrorCode.FORBIDDEN, "该账号无权访问当前端");
        }

        List<Long> roleIds = roles.stream().map(SysRole::getId).collect(Collectors.toList());
        List<String> permissionCodes = sysPermissionMapper.selectPermissionCodes(roleIds, end);

        String token = jwtTokenService.generateToken(user.getId(), user.getUsername(), end);
        sysUserMapper.updateLastLoginTime(user.getId());

        List<String> roleCodes = roles.stream().map(SysRole::getCode).collect(Collectors.toList());
        log.info("用户登录成功: username={}, end={}, roles={}", user.getUsername(), end, roleCodes);

        return new LoginResult(token, user.getId(), user.getUsername(),
                user.getNickname() == null ? user.getUsername() : user.getNickname(),
                end, roleCodes, permissionCodes);
    }

    public LocalDateTime currentUserTime() {
        return LocalDateTime.now();
    }

    private BizException badCredentials() {
        return new BizException(CommonErrorCode.UNAUTHORIZED, "用户名或密码错误");
    }
}