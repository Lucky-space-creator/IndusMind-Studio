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

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
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
        List<Long> scopeIds = resolveScopeIds(request);
        // 覆盖式保存：该角色的数据范围由此表单完整定义（支持同一类型授权多个对象）
        sysRoleDataScopeMapper.delete(new LambdaQueryWrapper<SysRoleDataScope>()
                .eq(SysRoleDataScope::getRoleId, roleId));
        for (Long scopeId : scopeIds) {
            SysRoleDataScope scope = new SysRoleDataScope();
            scope.setRoleId(roleId);
            scope.setScopeType(request.getScopeType());
            scope.setScopeId(scopeId);
            scope.setRemark(request.getRemark());
            sysRoleDataScopeMapper.insert(scope);
        }
    }

    /**
     * 解析本次保存的范围对象 ID 集合。
     * ALL 固定为 0；其余类型优先取 scopeIds，缺失时退化为单值 scopeId（兼容旧调用）。
     */
    private List<Long> resolveScopeIds(DataScopeSaveRequest request) {
        if (SCOPE_TYPE_ALL.equals(request.getScopeType())) {
            return List.of(SCOPE_ID_ALL);
        }
        List<Long> raw = new ArrayList<>();
        if (request.getScopeIds() != null) {
            raw.addAll(request.getScopeIds());
        }
        if (raw.isEmpty() && request.getScopeId() != null) {
            raw.add(request.getScopeId());
        }
        List<Long> ids = raw.stream()
                .filter(Objects::nonNull)
                .filter(id -> id > 0)
                .distinct()
                .collect(Collectors.toList());
        if (ids.isEmpty()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "请指定范围对象");
        }
        return ids;
    }

    private DataScopeVO toVO(SysRoleDataScope scope) {
        return new DataScopeVO(scope.getId(), scope.getRoleId(), scope.getScopeType(),
                scope.getScopeId(), scope.getRemark());
    }
}