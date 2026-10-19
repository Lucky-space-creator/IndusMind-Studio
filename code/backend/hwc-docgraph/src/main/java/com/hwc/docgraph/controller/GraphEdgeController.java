package com.hwc.docgraph.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.domain.docgraph.KbGraphEdge;
import com.hwc.domain.docgraph.KbGraphNode;
import com.hwc.docgraph.mapper.KbGraphEdgeMapper;
import com.hwc.docgraph.mapper.KbGraphNodeMapper;
import com.hwc.docgraph.service.GraphEdgeService;
import com.hwc.docgraph.service.GraphManageService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Tag(name = "文档关联图")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class GraphEdgeController {

    private final KbGraphEdgeMapper edgeMapper;
    private final KbGraphNodeMapper nodeMapper;
    private final GraphEdgeService edgeService;
    private final GraphManageService graphManageService;

    @Operation(summary = "关系边分页")
    @GetMapping("/admin/docgraph/edges")
    @PreAuthorize("hasAuthority('docgraph:graph:read')")
    public Result<PageResult<KbGraphEdge>> page(@RequestParam(defaultValue = "1") long current,
                                                @RequestParam(defaultValue = "10") long size,
                                                @RequestParam(required = false) Long kbId,
                                                @RequestParam(required = false) String relationType,
                                                @RequestParam(required = false) String status,
                                                @RequestParam(required = false) String source) {
        LambdaQueryWrapper<KbGraphEdge> wrapper = new LambdaQueryWrapper<KbGraphEdge>()
                .eq(relationType != null && !relationType.isBlank(), KbGraphEdge::getRelationType, relationType)
                .eq(status != null && !status.isBlank(), KbGraphEdge::getStatus, status)
                .eq(source != null && !source.isBlank(), KbGraphEdge::getSource, source);
        if (kbId != null) {
            List<Long> nodeIds = nodeMapper.selectList(new LambdaQueryWrapper<KbGraphNode>()
                            .eq(KbGraphNode::getKbId, kbId)
                            .select(KbGraphNode::getId))
                    .stream().map(KbGraphNode::getId).toList();
            if (nodeIds.isEmpty()) {
                return Result.ok(PageResult.of(List.of(), 0L, current, size));
            }
            wrapper.and(w -> w.in(KbGraphEdge::getFromNodeId, nodeIds).or().in(KbGraphEdge::getToNodeId, nodeIds));
        }
        wrapper.orderByDesc(KbGraphEdge::getId);
        Page<KbGraphEdge> page = edgeMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "人工新建关系边")
    @PostMapping("/admin/docgraph/edges")
    @PreAuthorize("hasAuthority('docgraph:graph:write')")
    public Result<KbGraphEdge> create(@RequestBody KbGraphEdge edge) {
        return Result.ok(edgeService.createManualEdge(edge));
    }

    @Operation(summary = "修改关系边")
    @PutMapping("/admin/docgraph/edges/{id}")
    @PreAuthorize("hasAuthority('docgraph:graph:write')")
    public Result<Void> update(@PathVariable Long id, @RequestBody KbGraphEdge edge) {
        edgeService.updateEdge(id, edge);
        return Result.ok();
    }

    @Operation(summary = "删除关系边")
    @DeleteMapping("/admin/docgraph/edges/{id}")
    @PreAuthorize("hasAuthority('docgraph:graph:write')")
    public Result<Void> delete(@PathVariable Long id) {
        edgeService.deleteEdge(id);
        return Result.ok();
    }

    @Operation(summary = "确认自动抽取边")
    @PutMapping("/admin/docgraph/edges/{id}/confirm")
    @PreAuthorize("hasAuthority('docgraph:graph:write')")
    public Result<Void> confirm(@PathVariable Long id) {
        edgeService.confirm(id);
        return Result.ok();
    }

    @Operation(summary = "拒绝自动抽取边")
    @PutMapping("/admin/docgraph/edges/{id}/reject")
    @PreAuthorize("hasAuthority('docgraph:graph:write')")
    public Result<Void> reject(@PathVariable Long id) {
        edgeService.reject(id);
        return Result.ok();
    }

    @Operation(summary = "触发自动抽取候选边")
    @PostMapping("/admin/docgraph/extract")
    @PreAuthorize("hasAuthority('docgraph:graph:write')")
    public Result<Map<String, Integer>> extract(@RequestBody Map<String, Long> body) {
        Long kbId = body.get("kbId");
        if (kbId == null) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "kbId 不能为空");
        }
        int added = graphManageService.extractAutoEdges(kbId);
        return Result.ok(Map.of("addedEdges", added));
    }

    @Operation(summary = "重建同步关联图")
    @PostMapping("/admin/docgraph/sync")
    @PreAuthorize("hasAuthority('docgraph:graph:write')")
    public Result<Void> sync(@RequestBody Map<String, Long> body) {
        Long kbId = body.get("kbId");
        if (kbId == null) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "kbId 不能为空");
        }
        graphManageService.syncGraph(kbId);
        return Result.ok();
    }
}