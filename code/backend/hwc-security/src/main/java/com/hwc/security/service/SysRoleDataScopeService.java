package com.hwc.security.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.domain.system.SysRoleDataScope;
import com.hwc.security.dto.account.DataScopeSaveRequest;
import com.hwc.security.dto.account.DataScopeVO;
import com.hwc.security.mapper.SysRoleDataScopeMapper;
import com.hwc.security.mapper.SysRoleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SysRoleDataScopeService {

    private static final String SCOPE_TYPE_ALL = "ALL";
    private static final long SCOPE_ID_ALL = 0L;

    private final SysRoleDataScopeMapper sysRoleDataScopeMapper;
    private final SysRoleMapper sysRoleMapper;

    public List<DataScopeVO> listByRoleId(Long roleId) {
        if (sysRoleMapper.selectById(roleId) == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "角色不存在");
        }
        return sysRoleDataScopeMapper.selectList(new LambdaQueryWrapper<SysRoleDataScope>()
                        .eq(SysRoleDataScope::getRoleId, roleId))
                .stream()
                .map(this::toVO)
                .collect(Collectors.toList());
    }

    @Transactional
    public void saveRoleDataScope(Long roleId, DataScopeSaveRequest request) {
        if (sysRoleMapper.selectByRoleIdForUpdate(roleId) == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "角色不存在");
        }
        Long scopeId;
        if (SCOPE_TYPE_ALL.equals(request.getScopeType())) {
            scopeId = SCOPE_ID_ALL;
        } else if (request.getScopeId() == null || request.getScopeId() <= 0) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "请指定范围对象");
        } else {
            scopeId = request.getScopeId();
        }
        List<SysRoleDataScope> existingScopes = sysRoleDataScopeMapper.selectList(
                new LambdaQueryWrapper<SysRoleDataScope>().eq(SysRoleDataScope::getRoleId, roleId));
        if (existingScopes.isEmpty()) {
            SysRoleDataScope scope = new SysRoleDataScope();
            scope.setRoleId(roleId);
            scope.setScopeType(request.getScopeType());
            scope.setScopeId(scopeId);
            scope.setRemark(request.getRemark());
            sysRoleDataScopeMapper.insert(scope);
        } else {
            SysRoleDataScope existing = existingScopes.get(0);
            SysRoleDataScope patch = new SysRoleDataScope();
            patch.setId(existing.getId());
            patch.setVersion(existing.getVersion());
            patch.setScopeType(request.getScopeType());
            patch.setScopeId(scopeId);
            patch.setRemark(request.getRemark());
            if (sysRoleDataScopeMapper.updateById(patch) == 0) {
                throw new BizException(CommonErrorCode.PARAM_INVALID, "数据已被他人修改，请刷新后重试");
            }
        }
    }

    private DataScopeVO toVO(SysRoleDataScope scope) {
        return new DataScopeVO(scope.getId(), scope.getRoleId(), scope.getScopeType(),
                scope.getScopeId(), scope.getRemark());
    }
}