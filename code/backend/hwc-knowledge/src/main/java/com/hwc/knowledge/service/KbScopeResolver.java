package com.hwc.knowledge.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.domain.knowledge.KbKnowledgeBase;
import com.hwc.domain.system.SysRoleDataScope;
import com.hwc.domain.system.SysUserRole;
import com.hwc.knowledge.mapper.KbKnowledgeBaseMapper;
import com.hwc.security.core.LoginUser;
import com.hwc.security.core.SecurityUtils;
import com.hwc.security.mapper.SysRoleDataScopeMapper;
import com.hwc.security.mapper.SysUserRoleMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 知识库数据范围解析器（REQ-M01-04 / REQ-M06-06）。
 *
 * <p>口径：
 * <ul>
 *   <li>角色配置了 {@code ALL} → 不受限；</li>
 *   <li>{@code KNOWLEDGE_BASE} → 仅指定知识库；</li>
 *   <li>{@code DEVICE_TYPE} → 该设备类型下的知识库；</li>
 *   <li>{@code DEVICE} → 定位到设备所属类型后同上（无设备主数据访问权的模块按不放行处理）；</li>
 *   <li>角色<b>完全未配置</b>数据范围 → 保持 P0 基线「全量可见」（与需求 §REQ-M01-04 的 P1 标注一致）；</li>
 *   <li>未登录 / 无角色 → 一律不放行（fail-closed）。</li>
 * </ul>
 *
 * <p>一旦配置为受限范围，就按白名单严格过滤，未命中即视为无权访问。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KbScopeResolver {

    private static final String SCOPE_ALL = "ALL";
    private static final String SCOPE_KB = "KNOWLEDGE_BASE";
    private static final String SCOPE_DEVICE_TYPE = "DEVICE_TYPE";
    private static final String SCOPE_DEVICE = "DEVICE";

    private final SysUserRoleMapper userRoleMapper;
    private final SysRoleDataScopeMapper dataScopeMapper;
    private final KbKnowledgeBaseMapper kbMapper;

    /** 当前登录用户的知识库范围 */
    public KbScope currentScope() {
        LoginUser user = SecurityUtils.getLoginUser();
        if (user == null || user.getUserId() == null) {
            return KbScope.restricted(Set.of());
        }
        return resolve(user.getUserId());
    }

    public KbScope resolve(Long userId) {
        List<Long> roleIds = userRoleMapper.selectList(
                        new LambdaQueryWrapper<SysUserRole>().eq(SysUserRole::getUserId, userId))
                .stream().map(SysUserRole::getRoleId).distinct().toList();
        if (roleIds.isEmpty()) {
            return KbScope.restricted(Set.of());
        }
        List<SysRoleDataScope> scopes = dataScopeMapper.selectList(
                new LambdaQueryWrapper<SysRoleDataScope>().in(SysRoleDataScope::getRoleId, roleIds));
        if (scopes.isEmpty()) {
            // P0 基线：未配置数据范围视为全量可见（与需求 REQ-M01-04 的 P1 定位一致）
            return KbScope.unrestrictedScope();
        }
        if (scopes.stream().anyMatch(scope -> SCOPE_ALL.equalsIgnoreCase(scope.getScopeType()))) {
            return KbScope.unrestrictedScope();
        }

        Set<Long> kbIds = scopes.stream()
                .filter(scope -> SCOPE_KB.equalsIgnoreCase(scope.getScopeType()))
                .map(SysRoleDataScope::getScopeId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toCollection(HashSet::new));
        Set<Long> devTypeIds = scopes.stream()
                .filter(scope -> SCOPE_DEVICE_TYPE.equalsIgnoreCase(scope.getScopeType()))
                .map(SysRoleDataScope::getScopeId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toCollection(HashSet::new));
        if (scopes.stream().anyMatch(scope -> SCOPE_DEVICE.equalsIgnoreCase(scope.getScopeType()))) {
            // DEVICE 范围需要设备→类型映射，本模块无设备主数据权限，按不放行处理（宁严勿松）
            log.warn("角色数据范围包含 DEVICE 类型，知识库范围按未授权处理: roles={}", roleIds);
        }
        if (!devTypeIds.isEmpty()) {
            kbIds.addAll(kbMapper.selectList(new LambdaQueryWrapper<KbKnowledgeBase>()
                            .in(KbKnowledgeBase::getDevTypeId, devTypeIds))
                    .stream().map(KbKnowledgeBase::getId).toList());
        }
        return KbScope.restricted(kbIds);
    }

    /** 知识库范围值对象 */
    public record KbScope(boolean unrestricted, Set<Long> kbIds) {

        static KbScope unrestrictedScope() {
            return new KbScope(true, Set.of());
        }

        static KbScope restricted(Set<Long> kbIds) {
            return new KbScope(false, Set.copyOf(kbIds));
        }

        public boolean allows(Long kbId) {
            return kbId != null && (unrestricted || kbIds.contains(kbId));
        }

        public boolean allowsNone() {
            return !unrestricted && kbIds.isEmpty();
        }
    }
}
