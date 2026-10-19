package com.hwc.security.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.domain.system.SysPermission;
import com.hwc.domain.system.SysRole;
import com.hwc.domain.system.SysRolePermission;
import com.hwc.security.dto.account.RoleCreateRequest;
import com.hwc.security.dto.account.RoleUpdateRequest;
import com.hwc.security.dto.account.RoleVO;
import com.hwc.security.mapper.SysPermissionMapper;
import com.hwc.security.mapper.SysRoleMapper;
import com.hwc.security.mapper.SysRolePermissionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SysRoleService {

    private static final int BUILT_IN_CUSTOM = 0;
    private static final int BUILT_IN_YES = 1;

    private final SysRoleMapper sysRoleMapper;
    private final SysRolePermissionMapper sysRolePermissionMapper;
    private final SysPermissionMapper sysPermissionMapper;

    public List<RoleVO> listRoles() {
        return sysRoleMapper.selectList(new LambdaQueryWrapper<SysRole>()
                        .orderByAsc(SysRole::getSort)
                        .orderByAsc(SysRole::getId))
                .stream()
                .map(this::toVO)
                .collect(Collectors.toList());
    }

    @Transactional
    public RoleVO createRole(RoleCreateRequest request) {
        if (sysRoleMapper.existsByRoleCode(request.getCode(), null)) {
            throw new BizException(CommonErrorCode.CONFLICT, "角色编码已存在");
        }
        SysRole role = new SysRole();
        role.setCode(request.getCode());
        role.setName(request.getName());
        role.setEndType(request.getEndType());
        role.setBuiltIn(BUILT_IN_CUSTOM);
        role.setDescription(request.getDescription());
        try {
            sysRoleMapper.insert(role);
        } catch (DuplicateKeyException e) {
            throw new BizException(CommonErrorCode.CONFLICT, "角色编码已存在");
        }
        if (request.getPermissionIds() != null) {
            saveRolePermissions(role.getId(), request.getPermissionIds());
        }
        return toVO(requireById(role.getId()));
    }

    @Transactional
    public void updateRole(Long id, RoleUpdateRequest request) {
        SysRole existing = requireById(id);
        if (request.getCode() != null && !request.getCode().equals(existing.getCode())) {
            if (existing.getBuiltIn() != null && existing.getBuiltIn() == BUILT_IN_YES) {
                throw new BizException(CommonErrorCode.PARAM_INVALID, "内置角色编码不允许修改");
            }
            if (sysRoleMapper.existsByRoleCode(request.getCode(), id)) {
                throw new BizException(CommonErrorCode.CONFLICT, "角色编码已存在");
            }
        }
        SysRole role = new SysRole();
        role.setId(id);
        role.setVersion(existing.getVersion());
        role.setCode(request.getCode());
        role.setName(request.getName());
        role.setEndType(request.getEndType());
        role.setDescription(request.getDescription());
        if (sysRoleMapper.updateById(role) == 0) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "数据已被他人修改，请刷新后重试");
        }
        if (request.getPermissionIds() != null) {
            saveRolePermissions(id, request.getPermissionIds());
        }
    }

    private SysRole requireById(Long id) {
        SysRole role = sysRoleMapper.selectById(id);
        if (role == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "角色不存在");
        }
        return role;
    }

    private void saveRolePermissions(Long roleId, List<Long> permissionIds) {
        sysRolePermissionMapper.delete(new LambdaQueryWrapper<SysRolePermission>()
                .eq(SysRolePermission::getRoleId, roleId));
        List<Long> distinctIds = permissionIds.stream().distinct().collect(Collectors.toList());
        if (distinctIds.isEmpty()) {
            return;
        }
        Set<Long> validIds = sysPermissionMapper.selectBatchIds(distinctIds).stream()
                .map(SysPermission::getId).collect(Collectors.toSet());
        for (Long permissionId : distinctIds) {
            if (!validIds.contains(permissionId)) {
                throw new BizException(CommonErrorCode.PARAM_INVALID, "权限点不存在: " + permissionId);
            }
        }
        for (Long permissionId : distinctIds) {
            SysRolePermission relation = new SysRolePermission();
            relation.setRoleId(roleId);
            relation.setPermissionId(permissionId);
            sysRolePermissionMapper.insert(relation);
        }
    }

    private RoleVO toVO(SysRole role) {
        return new RoleVO(role.getId(), role.getCode(), role.getName(), role.getEndType(),
                role.getBuiltIn(), role.getSort(), role.getDescription());
    }
}