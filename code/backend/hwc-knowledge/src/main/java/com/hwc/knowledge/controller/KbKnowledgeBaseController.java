package com.hwc.knowledge.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.domain.knowledge.KbKnowledgeBase;
import com.hwc.knowledge.service.KbKnowledgeBaseService;
import com.hwc.knowledge.service.KbScopeResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "知识库")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class KbKnowledgeBaseController {

    private final KbKnowledgeBaseService kbService;
    private final KbScopeResolver kbScopeResolver;

    @Operation(summary = "知识库分页")
    @GetMapping({"/admin/knowledge/kbs", "/user/knowledge/kbs"})
    public Result<PageResult<KbKnowledgeBase>> page(@RequestParam(defaultValue = "1") long current,
                                                    @RequestParam(defaultValue = "10") long size,
                                                    @RequestParam(required = false) String keyword,
                                                    @RequestParam(required = false) Long devTypeId,
                                                    @RequestParam(required = false) String faultLevel,
                                                    HttpServletRequest servletRequest) {
        KbScopeResolver.KbScope scope = userScope(servletRequest);
        if (scope != null && scope.allowsNone()) {
            return Result.ok(PageResult.of(List.of(), 0, current, size));
        }
        LambdaQueryWrapper<KbKnowledgeBase> wrapper = new LambdaQueryWrapper<KbKnowledgeBase>()
                .and(keyword != null && !keyword.isBlank(),
                        w -> w.like(KbKnowledgeBase::getName, keyword).or().like(KbKnowledgeBase::getVendor, keyword))
                .eq(devTypeId != null, KbKnowledgeBase::getDevTypeId, devTypeId)
                .eq(faultLevel != null && !faultLevel.isBlank(), KbKnowledgeBase::getFaultLevel, faultLevel)
                .in(scope != null && !scope.unrestricted(), KbKnowledgeBase::getId, scope == null ? List.of() : scope.kbIds())
                .orderByDesc(KbKnowledgeBase::getId);
        Page<KbKnowledgeBase> page = kbService.page(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "知识库详情")
    @GetMapping({"/admin/knowledge/kbs/{id}", "/user/knowledge/kbs/{id}"})
    public Result<KbKnowledgeBase> detail(@PathVariable Long id, HttpServletRequest servletRequest) {
        KbKnowledgeBase kb = kbService.getById(id);
        if (kb == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "知识库不存在");
        }
        KbScopeResolver.KbScope scope = userScope(servletRequest);
        if (scope != null && !scope.allows(id)) {
            throw new BizException(CommonErrorCode.FORBIDDEN, "无权访问该知识库，请联系管理员分配数据范围");
        }
        return Result.ok(kb);
    }

    /** 用户端请求返回当前数据范围；管理端返回 null（配置端需要全量） */
    private KbScopeResolver.KbScope userScope(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri != null && uri.startsWith("/api/user") ? kbScopeResolver.currentScope() : null;
    }

    @Operation(summary = "新增知识库")
    @PostMapping("/admin/knowledge/kbs")
    @PreAuthorize("hasAuthority('knowledge:kb:write')")
    public Result<KbKnowledgeBase> create(@RequestBody KbKnowledgeBase kb) {
        if (kb.getDocCount() == null) {
            kb.setDocCount(0);
        }
        if (kb.getIndexStatus() == null || kb.getIndexStatus().isBlank()) {
            kb.setIndexStatus("init");
        }
        kbService.save(kb);
        return Result.ok(kb);
    }

    @Operation(summary = "修改知识库")
    @PutMapping("/admin/knowledge/kbs/{id}")
    @PreAuthorize("hasAuthority('knowledge:kb:write')")
    public Result<Void> update(@PathVariable Long id, @RequestBody KbKnowledgeBase kb) {
        kb.setId(id);
        kbService.updateById(kb);
        return Result.ok();
    }

    @Operation(summary = "删除知识库")
    @DeleteMapping("/admin/knowledge/kbs/{id}")
    @PreAuthorize("hasAuthority('knowledge:kb:write')")
    public Result<Void> remove(@PathVariable Long id) {
        kbService.removeKnowledgeBase(id);
        return Result.ok();
    }
}