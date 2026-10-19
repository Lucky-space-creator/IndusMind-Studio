package com.hwc.security.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.PageResult;
import com.hwc.domain.system.SysRole;
import com.hwc.domain.system.SysUser;
import com.hwc.domain.system.SysUserRole;
import com.hwc.security.core.SecurityUtils;
import com.hwc.security.dto.account.UserCreateRequest;
import com.hwc.security.dto.account.UserUpdateRequest;
import com.hwc.security.dto.account.UserVO;
import com.hwc.security.mapper.SysRoleMapper;
import com.hwc.security.mapper.SysUserMapper;
import com.hwc.security.mapper.SysUserRoleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SysUserService {

    private static final String ADMIN_USERNAME = "admin";
    private static final int STATUS_DEFAULT = 1;

    private final SysUserMapper sysUserMapper;
    private final SysRoleMapper sysRoleMapper;
    private final SysUserRoleMapper sysUserRoleMapper;
    private final BCryptPasswordEncoder passwordEncoder;

    public PageResult<UserVO> pageUsers(long current, long size, String keyword, Integer status) {
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<SysUser>()
                .and(keyword != null && !keyword.isBlank(),
                        w -> w.like(SysUser::getUsername, keyword).or().like(SysUser::getNickname, keyword))
                .eq(status != null, SysUser::getStatus, status)
                .orderByAsc(SysUser::getId);
        Page<SysUser> page = sysUserMapper.selectPage(new Page<>(current, size), wrapper);
        Map<Long, List<Long>> roleIdsByUserId = collectRoleIds(page.getRecords());
        List<UserVO> records = page.getRecords().stream()
                .map(user -> toVO(user, roleIdsByUserId.getOrDefault(user.getId(), Collections.emptyList())))
                .collect(Collectors.toList());
        return PageResult.of(records, page.getTotal(), page.getCurrent(), page.getSize());
    }

    @Transactional
    public UserVO createUser(UserCreateRequest request) {
        if (sysUserMapper.existsByUsername(request.getUsername(), null)) {
            throw new BizException(CommonErrorCode.CONFLICT, "用户名已存在");
        }
        SysUser user = new SysUser();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setNickname(request.getNickname());
        user.setPhone(request.getPhone());
        user.setEmail(request.getEmail());
        user.setStatus(request.getStatus() == null ? STATUS_DEFAULT : request.getStatus());
        try {
            sysUserMapper.insert(user);
        } catch (DuplicateKeyException e) {
            throw new BizException(CommonErrorCode.CONFLICT, "用户名已存在");
        }
        if (request.getRoleIds() != null) {
            saveUserRoles(user.getId(), request.getRoleIds());
        }
        List<Long> roleIds = request.getRoleIds() == null
                ? Collections.emptyList() : distinct(request.getRoleIds());
        return toVO(user, roleIds);
    }

    @Transactional
    public void updateUser(Long id, UserUpdateRequest request) {
        SysUser existing = requireById(id);
        if (request.getUsername() != null && !request.getUsername().equals(existing.getUsername())) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "用户名不允许修改");
        }
        SysUser user = new SysUser();
        user.setId(id);
        user.setVersion(existing.getVersion());
        user.setNickname(request.getNickname());
        user.setPhone(request.getPhone());
        user.setEmail(request.getEmail());
        user.setStatus(request.getStatus());
        user.setRemark(request.getRemark());
        if (sysUserMapper.updateById(user) == 0) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "数据已被他人修改，请刷新后重试");
        }
        if (request.getRoleIds() != null) {
            saveUserRoles(id, request.getRoleIds());
        }
    }

    @Transactional
    public void deleteUser(Long id) {
        SysUser user = requireById(id);
        if (ADMIN_USERNAME.equals(user.getUsername())) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "内置管理员账号不允许删除");
        }
        if (id.equals(SecurityUtils.getUserId())) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "不能删除当前登录账号");
        }
        sysUserMapper.deleteById(id);
        sysUserRoleMapper.delete(new LambdaQueryWrapper<SysUserRole>()
                .eq(SysUserRole::getUserId, id));
    }

    private SysUser requireById(Long id) {
        SysUser user = sysUserMapper.selectById(id);
        if (user == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "账号不存在");
        }
        return user;
    }

    private Map<Long, List<Long>> collectRoleIds(List<SysUser> users) {
        if (users.isEmpty()) {
            return Collections.emptyMap();
        }
        List<Long> userIds = users.stream().map(SysUser::getId).collect(Collectors.toList());
        return sysUserRoleMapper.selectList(new LambdaQueryWrapper<SysUserRole>()
                        .in(SysUserRole::getUserId, userIds))
                .stream()
                .collect(Collectors.groupingBy(SysUserRole::getUserId,
                        Collectors.mapping(SysUserRole::getRoleId, Collectors.toList())));
    }

    private void saveUserRoles(Long userId, List<Long> roleIds) {
        sysUserRoleMapper.delete(new LambdaQueryWrapper<SysUserRole>()
                .eq(SysUserRole::getUserId, userId));
        List<Long> distinctIds = distinct(roleIds);
        if (distinctIds.isEmpty()) {
            return;
        }
        Set<Long> validIds = sysRoleMapper.selectBatchIds(distinctIds).stream()
                .map(SysRole::getId).collect(Collectors.toSet());
        for (Long roleId : distinctIds) {
            if (!validIds.contains(roleId)) {
                throw new BizException(CommonErrorCode.PARAM_INVALID, "角色不存在: " + roleId);
            }
        }
        for (Long roleId : distinctIds) {
            SysUserRole relation = new SysUserRole();
            relation.setUserId(userId);
            relation.setRoleId(roleId);
            sysUserRoleMapper.insert(relation);
        }
    }

    private List<Long> distinct(List<Long> ids) {
        return ids.stream().distinct().collect(Collectors.toList());
    }

    private UserVO toVO(SysUser user, List<Long> roleIds) {
        return new UserVO(user.getId(), user.getUsername(), user.getNickname(), user.getPhone(),
                user.getEmail(), user.getStatus(), user.getLastLoginTime(), user.getRemark(), roleIds);
    }
}