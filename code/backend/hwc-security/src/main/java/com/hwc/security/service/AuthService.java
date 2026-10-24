package com.hwc.security.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.common.constant.HwcConstants;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.domain.system.SysPermission;
import com.hwc.domain.system.SysRole;
import com.hwc.domain.system.SysRoleDataScope;
import com.hwc.domain.system.SysUser;
import com.hwc.infra.mybatis.CurrentUserHolder;
import com.hwc.security.core.LoginUser;
import com.hwc.security.core.SecurityUtils;
import com.hwc.security.dto.LoginRequest;
import com.hwc.security.dto.LoginResult;
import com.hwc.security.dto.PermissionItem;
import com.hwc.security.dto.UserProfileResult;
import com.hwc.security.jwt.JwtTokenService;
import com.hwc.security.mapper.SysPermissionMapper;
import com.hwc.security.mapper.SysRoleDataScopeMapper;
import com.hwc.security.mapper.SysRoleMapper;
import com.hwc.security.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    /** 数据范围类型归一化：库表存的是业务类型，前端展示只用 ALL/LINE/DEVICE/KB */
    private static final Map<String, String> SCOPE_TYPE_ALIAS = Map.of(
            "KNOWLEDGE_BASE", "KB",
            "DEVICE_TYPE", "DEVICE");

    private final SysUserMapper sysUserMapper;
    private final SysRoleMapper sysRoleMapper;
    private final SysPermissionMapper sysPermissionMapper;
    private final SysRoleDataScopeMapper sysRoleDataScopeMapper;
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
        List<PermissionItem> permissionDetails = toPermissionItems(
                sysPermissionMapper.selectPermissionDetails(roleIds, end));

        String token = jwtTokenService.generateToken(user.getId(), user.getUsername(), end);
        sysUserMapper.updateLastLoginTime(user.getId());

        List<String> roleCodes = roles.stream().map(SysRole::getCode).collect(Collectors.toList());
        log.info("用户登录成功: username={}, end={}, roles={}", user.getUsername(), end, roleCodes);

        return new LoginResult(token, user.getId(), user.getUsername(),
                user.getNickname() == null ? user.getUsername() : user.getNickname(),
                end, roleCodes, permissionCodes, permissionDetails);
    }

    /**
     * 读取当前登录用户的最新权限档案（不签发新 token）。
     * <p>
     * 前端的登录态（角色/权限/数据范围）是登录时持久化的快照，管理员调整角色权限后需要主动刷新，
     * 否则界面上的菜单与按钮要等下次登录才会变化。此接口提供"重新取快照"的能力。
     */
    public UserProfileResult loadProfile(String end) {
        LoginUser loginUser = SecurityUtils.getLoginUser();
        if (loginUser == null || loginUser.getUserId() == null) {
            throw new BizException(CommonErrorCode.UNAUTHORIZED, "未登录或登录已过期");
        }
        if (!end.equals(loginUser.getEnd())) {
            throw new BizException(CommonErrorCode.FORBIDDEN, "当前登录账号不属于该端，请重新登录");
        }
        SysUser user = sysUserMapper.selectById(loginUser.getUserId());
        if (user == null || user.getStatus() == null || user.getStatus() != HwcConstants.STATUS_ENABLED) {
            throw new BizException(CommonErrorCode.UNAUTHORIZED, "账号已被停用，请重新登录");
        }

        List<SysRole> roles = sysRoleMapper.selectUserRolesByEnd(user.getId(), end);
        List<Long> roleIds = roles.stream().map(SysRole::getId).collect(Collectors.toList());
        // 无角色时 roleIds 为空，IN () 会产生非法 SQL，必须先判空
        List<String> permissionCodes = roleIds.isEmpty()
                ? Collections.emptyList()
                : sysPermissionMapper.selectPermissionCodes(roleIds, end);
        List<PermissionItem> permissionDetails = roleIds.isEmpty()
                ? Collections.emptyList()
                : toPermissionItems(sysPermissionMapper.selectPermissionDetails(roleIds, end));

        return new UserProfileResult(user.getId(), user.getUsername(),
                user.getNickname() == null ? user.getUsername() : user.getNickname(),
                end,
                roles.stream().map(SysRole::getCode).collect(Collectors.toList()),
                permissionCodes,
                permissionDetails,
                resolveDataScope(roleIds));
    }

    /** 实体 → 展示用明细（code 仍是鉴权唯一依据，其余字段只用于界面） */
    private List<PermissionItem> toPermissionItems(List<SysPermission> permissions) {
        if (permissions == null || permissions.isEmpty()) {
            return Collections.emptyList();
        }
        return permissions.stream()
                .map(p -> new PermissionItem(p.getCode(), p.getName(), p.getModule(), p.getAction()))
                .collect(Collectors.toList());
    }

    /**
     * 汇总用户所有角色的数据范围。
     * 任一角包（含）ALL 即视为全部可见；否则取授权对象最多的那一类作为界面主描述。
     */
    private UserProfileResult.DataScopeSummary resolveDataScope(List<Long> roleIds) {
        if (roleIds.isEmpty()) {
            return new UserProfileResult.DataScopeSummary("ALL", null, null, 0);
        }
        List<SysRoleDataScope> scopes = sysRoleDataScopeMapper.selectList(
                new LambdaQueryWrapper<SysRoleDataScope>().in(SysRoleDataScope::getRoleId, roleIds));
        if (scopes.isEmpty() || scopes.stream().anyMatch(s -> "ALL".equals(s.getScopeType()))) {
            return new UserProfileResult.DataScopeSummary("ALL", null, null, 0);
        }

        Map<String, List<SysRoleDataScope>> grouped = scopes.stream()
                .filter(s -> s.getScopeType() != null)
                .collect(Collectors.groupingBy(
                        s -> SCOPE_TYPE_ALIAS.getOrDefault(s.getScopeType(), s.getScopeType())));
        return grouped.entrySet().stream()
                .max(Comparator.comparingInt(e -> e.getValue().size()))
                .map(e -> new UserProfileResult.DataScopeSummary(
                        e.getKey(),
                        e.getValue().size() + " 项",
                        e.getValue().stream()
                                .map(SysRoleDataScope::getRemark)
                                .filter(r -> r != null && !r.isBlank())
                                .findFirst().orElse(null),
                        e.getValue().size()))
                .orElseGet(() -> new UserProfileResult.DataScopeSummary("ALL", null, null, 0));
    }

    public LocalDateTime currentUserTime() {
        return LocalDateTime.now();
    }

    private BizException badCredentials() {
        return new BizException(CommonErrorCode.UNAUTHORIZED, "用户名或密码错误");
    }
}