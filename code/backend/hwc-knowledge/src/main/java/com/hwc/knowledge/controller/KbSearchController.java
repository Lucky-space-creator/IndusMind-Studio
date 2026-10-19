package com.hwc.knowledge.controller;

import com.hwc.aiclient.client.RagClient;
import com.hwc.aiclient.model.RagSearchRequest;
import com.hwc.aiclient.model.RagSearchResponse;
import com.hwc.common.result.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "知识检索")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class KbSearchController {

    private final RagClient ragClient;

    @Operation(summary = "知识检索（用户端）")
    @PostMapping("/user/knowledge/search")
    @PreAuthorize("hasAuthority('knowledge:search:read')")
    public Result<RagSearchResponse> searchUser(@RequestBody RagSearchRequest request) {
        return Result.ok(ragClient.search(normalize(request)));
    }

    @Operation(summary = "知识检索（管理端）")
    @PostMapping("/admin/knowledge/search")
    public Result<RagSearchResponse> searchAdmin(@RequestBody RagSearchRequest request) {
        return Result.ok(ragClient.search(normalize(request)));
    }

    private RagSearchRequest normalize(RagSearchRequest request) {
        if (request.getTopK() == null || request.getTopK() <= 0) {
            request.setTopK(5);
        }
        if (request.getStrictness() == null || request.getStrictness().isBlank()) {
            request.setStrictness("medium");
        }
        return request;
    }
}