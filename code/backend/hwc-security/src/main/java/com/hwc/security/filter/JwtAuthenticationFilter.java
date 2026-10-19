package com.hwc.security.filter;

import com.hwc.common.constant.HwcConstants;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.domain.system.SysRole;
import com.hwc.domain.system.SysUser;
import com.hwc.infra.mybatis.CurrentUserHolder;
import com.hwc.security.config.SecurityProperties;
import com.hwc.security.core.LoginUser;
import com.hwc.security.jwt.JwtTokenService;
import com.hwc.security.mapper.SysPermissionMapper;
import com.hwc.security.mapper.SysRoleMapper;
import com.hwc.security.mapper.SysUserMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenService jwtTokenService;
    private final SysRoleMapper sysRoleMapper;
    private final SysPermissionMapper sysPermissionMapper;
    private final SysUserMapper sysUserMapper;
    private final SecurityProperties properties;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        for (String pattern : properties.getWhitelist()) {
            if (pathMatcher.match(pattern, path)) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader(HwcConstants.HEADER_AUTHORIZATION);
        if (header != null && header.startsWith(HwcConstants.BEARER_PREFIX)) {
            try {
                String token = header.substring(HwcConstants.BEARER_PREFIX.length());
                Claims claims = jwtTokenService.parseToken(token, properties.getEndType());
                Long userId = claims.get(HwcConstants.CLAIM_USER_ID, Long.class);
                String username = claims.get(HwcConstants.CLAIM_USERNAME, String.class);

                SysUser user = sysUserMapper.selectById(userId);
                if (user == null) {
                    throw new BizException(CommonErrorCode.UNAUTHORIZED, "未登录或登录已过期");
                }
                if (user.getStatus() == null || user.getStatus() != HwcConstants.STATUS_ENABLED) {
                    throw new BizException(CommonErrorCode.UNAUTHORIZED, "未登录或登录已过期");
                }

                List<SysRole> roles = sysRoleMapper.selectUserRolesByEnd(userId, properties.getEndType());
                List<Long> roleIds = roles.stream().map(SysRole::getId).collect(Collectors.toList());
                List<String> permissions = roleIds.isEmpty()
                        ? Collections.emptyList()
                        : sysPermissionMapper.selectPermissionCodes(roleIds, properties.getEndType());

                LoginUser loginUser = new LoginUser(userId, username, username,
                        properties.getEndType(),
                        roles.stream().map(SysRole::getCode).collect(Collectors.toList()),
                        permissions.stream().collect(Collectors.toSet()));

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(loginUser, null,
                                permissions.stream().map(SimpleGrantedAuthority::new)
                                        .collect(Collectors.toList()));
                SecurityContextHolder.getContext().setAuthentication(authentication);
                CurrentUserHolder.setUsername(username);
            } catch (BizException e) {
                response.setStatus(e.getHttpStatus());
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write(
                        "{\"code\":" + e.getHttpStatus() + ",\"errorCode\":\"" + e.getErrorCode()
                                + "\",\"message\":\"" + e.getMessage() + "\",\"data\":null,\"traceId\":\"\"}");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }
}