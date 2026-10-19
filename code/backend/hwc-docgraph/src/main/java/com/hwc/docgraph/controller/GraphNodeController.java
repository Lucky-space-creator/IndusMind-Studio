package com.hwc.docgraph.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.aiclient.client.DocGraphClient;
import com.hwc.aiclient.model.GraphQueryRequest;
import com.hwc.aiclient.model.GraphQueryResponse;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.domain.docgraph.KbGraphNode;
import com.hwc.docgraph.mapper.KbGraphNodeMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "文档关联图节点")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class GraphNodeController {

    private final KbGraphNodeMapper nodeMapper;
    private final DocGraphClient docGraphClient;

    @Operation(summary = "图节点分页")
    @GetMapping({"/admin/docgraph/nodes", "/user/docgraph/nodes"})
    @PreAuthorize("hasAuthority('docgraph:graph:read')")
    public Result<PageResult<KbGraphNode>> page(@RequestParam(defaultValue = "1") long current,
                                                @RequestParam(defaultValue = "10") long size,
                                                @RequestParam(required = false) Long kbId,
                                                @RequestParam(required = false) String nodeType,
                                                @RequestParam(required = false) String keyword) {
        LambdaQueryWrapper<KbGraphNode> wrapper = new LambdaQueryWrapper<KbGraphNode>()
                .eq(kbId != null, KbGraphNode::getKbId, kbId)
                .eq(nodeType != null && !nodeType.isBlank(), KbGraphNode::getNodeType, nodeType)
                .like(keyword != null && !keyword.isBlank(), KbGraphNode::getTitle, keyword)
                .orderByDesc(KbGraphNode::getId);
        Page<KbGraphNode> page = nodeMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "节点关联查询（GraphRAG）")
    @GetMapping("/admin/docgraph/nodes/{id}/related")
    @PreAuthorize("hasAuthority('docgraph:graph:read')")
    public Result<GraphQueryResponse> related(@PathVariable Long id,
                                              @RequestParam(required = false) List<String> relationTypes,
                                              @RequestParam(defaultValue = "1") Integer depth) {
        KbGraphNode node = nodeMapper.selectById(id);
        if (node == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "图节点不存在");
        }
        GraphQueryRequest request = new GraphQueryRequest();
        request.setNodeRefId(node.getRefId());
        request.setNodeType(node.getNodeType());
        request.setRelationTypes(relationTypes);
        request.setDepth(Math.max(1, Math.min(depth, 3)));
        return Result.ok(docGraphClient.query(request));
    }
}