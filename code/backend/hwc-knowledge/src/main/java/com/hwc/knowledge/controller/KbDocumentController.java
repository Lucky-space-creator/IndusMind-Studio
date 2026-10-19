package com.hwc.knowledge.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.domain.knowledge.KbDocument;
import com.hwc.domain.knowledge.KbIndexTask;
import com.hwc.knowledge.mapper.KbIndexTaskMapper;
import com.hwc.knowledge.service.KbDocumentService;
import com.hwc.knowledge.service.KbIndexTaskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Tag(name = "知识库文档")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class KbDocumentController {

    private static final Set<String> VALID_STATUS = Set.of("enabled", "disabled");

    private final KbDocumentService documentService;
    private final KbIndexTaskService indexTaskService;
    private final KbIndexTaskMapper indexTaskMapper;

    @Operation(summary = "文档分页")
    @GetMapping({"/admin/knowledge/documents", "/user/knowledge/documents"})
    public Result<PageResult<KbDocument>> page(@RequestParam(defaultValue = "1") long current,
                                               @RequestParam(defaultValue = "10") long size,
                                               @RequestParam(required = false) Long kbId,
                                               @RequestParam(required = false) String keyword,
                                               @RequestParam(required = false) String status,
                                               @RequestParam(required = false) String docType) {
        LambdaQueryWrapper<KbDocument> wrapper = new LambdaQueryWrapper<KbDocument>()
                .eq(kbId != null, KbDocument::getKbId, kbId)
                .and(keyword != null && !keyword.isBlank(),
                        w -> w.like(KbDocument::getDocName, keyword).or().like(KbDocument::getRemark, keyword))
                .eq(status != null && !status.isBlank(), KbDocument::getStatus, status)
                .eq(docType != null && !docType.isBlank(), KbDocument::getDocType, docType)
                .orderByDesc(KbDocument::getId);
        Page<KbDocument> page = documentService.page(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "文档详情")
    @GetMapping({"/admin/knowledge/documents/{id}", "/user/knowledge/documents/{id}"})
    public Result<KbDocument> detail(@PathVariable Long id) {
        KbDocument doc = documentService.getById(id);
        if (doc == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "文档不存在");
        }
        return Result.ok(doc);
    }

    @Operation(summary = "上传文档（解析分段并构建索引）")
    @PostMapping("/admin/knowledge/documents/upload")
    @PreAuthorize("hasAuthority('knowledge:document:write')")
    public Result<KbDocument> upload(@RequestParam Long kbId,
                                     @RequestParam(required = false) String docName,
                                     @RequestParam(required = false) String docType,
                                     @RequestPart MultipartFile file) {
        return Result.ok(documentService.upload(kbId, docName, docType, file));
    }

    @Operation(summary = "文档启停")
    @PutMapping("/admin/knowledge/documents/{id}/status")
    @PreAuthorize("hasAuthority('knowledge:document:publish')")
    public Result<Void> changeStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (!VALID_STATUS.contains(status)) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "status 仅支持 enabled/disabled");
        }
        documentService.changeStatus(id, status);
        return Result.ok();
    }

    @Operation(summary = "删除文档")
    @DeleteMapping("/admin/knowledge/documents/{id}")
    @PreAuthorize("hasAuthority('knowledge:document:delete')")
    public Result<Void> remove(@PathVariable Long id) {
        documentService.removeDocument(id);
        return Result.ok();
    }

    @Operation(summary = "重建文档索引")
    @PostMapping("/admin/knowledge/documents/{id}/reindex")
    @PreAuthorize("hasAuthority('knowledge:index:write')")
    public Result<Void> reindex(@PathVariable Long id) {
        KbDocument doc = documentService.getById(id);
        if (doc == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "文档不存在");
        }
        indexTaskService.rebuildIndex(doc.getKbId(), id);
        return Result.ok();
    }

    @Operation(summary = "文档索引任务列表")
    @GetMapping("/admin/knowledge/documents/{id}/tasks")
    @PreAuthorize("hasAuthority('knowledge:index:read')")
    public Result<List<KbIndexTask>> listTasks(@PathVariable Long id) {
        return Result.ok(indexTaskMapper.selectList(
                new LambdaQueryWrapper<KbIndexTask>()
                        .eq(KbIndexTask::getDocId, id)
                        .orderByDesc(KbIndexTask::getId)));
    }
}