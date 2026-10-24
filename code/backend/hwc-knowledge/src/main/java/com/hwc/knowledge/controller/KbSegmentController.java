package com.hwc.knowledge.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.Result;
import com.hwc.domain.knowledge.KbDocument;
import com.hwc.domain.knowledge.KbSegment;
import com.hwc.knowledge.mapper.KbDocumentMapper;
import com.hwc.knowledge.mapper.KbSegmentMapper;
import com.hwc.knowledge.service.KbScopeResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "知识库片段")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class KbSegmentController {

    private final KbSegmentMapper segmentMapper;
    private final KbDocumentMapper documentMapper;
    private final KbScopeResolver kbScopeResolver;

    @Operation(summary = "文档片段列表")
    @GetMapping({"/admin/knowledge/documents/{docId}/segments", "/user/knowledge/documents/{docId}/segments"})
    @PreAuthorize("hasAuthority('knowledge:segment:read')")
    public Result<List<KbSegment>> listByDoc(@PathVariable Long docId,
                                             @RequestParam(required = false) String keyword,
                                             HttpServletRequest servletRequest) {
        String uri = servletRequest.getRequestURI();
        if (uri != null && uri.startsWith("/api/user")) {
            KbDocument doc = documentMapper.selectById(docId);
            if (doc == null) {
                throw new BizException(CommonErrorCode.NOT_FOUND, "文档不存在");
            }
            if (!kbScopeResolver.currentScope().allows(doc.getKbId())) {
                throw new BizException(CommonErrorCode.FORBIDDEN, "无权访问该文档片段，请联系管理员分配数据范围");
            }
        }
        return Result.ok(segmentMapper.selectList(
                new LambdaQueryWrapper<KbSegment>()
                        .eq(KbSegment::getDocId, docId)
                        .like(keyword != null && !keyword.isBlank(), KbSegment::getContent, keyword)
                        .orderByAsc(KbSegment::getSeqNo)));
    }

    @Operation(summary = "片段校对")
    @PutMapping("/admin/knowledge/segments/{id}")
    @PreAuthorize("hasAuthority('knowledge:segment:write')")
    public Result<Void> correct(@PathVariable Long id, @RequestBody KbSegment segment) {
        segment.setId(id);
        segmentMapper.updateById(segment);
        return Result.ok();
    }
}