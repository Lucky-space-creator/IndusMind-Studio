package com.hwc.knowledge.controller;

import com.hwc.aiclient.client.RagClient;
import com.hwc.aiclient.model.RagSearchRequest;
import com.hwc.aiclient.model.RagSearchResponse;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.Result;
import com.hwc.knowledge.service.KbScopeResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Objects;

/**
 * 知识检索：检索范围受角色数据范围约束（REQ-M06-06 仅基于授权知识库）。
 */
@Slf4j
@Tag(name = "知识检索")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class KbSearchController {

    private final RagClient ragClient;
    private final KbScopeResolver kbScopeResolver;

    @Operation(summary = "知识检索（用户端）")
    @PostMapping("/user/knowledge/search")
    @PreAuthorize("hasAuthority('knowledge:search:read')")
    public Result<RagSearchResponse> searchUser(@RequestBody RagSearchRequest request, HttpServletRequest servletRequest) {
        return doSearch(request, servletRequest);
    }

    @Operation(summary = "知识检索（管理端）")
    @PostMapping("/admin/knowledge/search")
    public Result<RagSearchResponse> searchAdmin(@RequestBody RagSearchRequest request, HttpServletRequest servletRequest) {
        return doSearch(request, servletRequest);
    }

    private Result<RagSearchResponse> doSearch(RagSearchRequest request, HttpServletRequest servletRequest) {
        if (request.getQuery() == null || request.getQuery().isBlank()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "检索内容不能为空");
        }
        normalize(request);
        KbScopeResolver.KbScope scope = kbScopeResolver.currentScope();
        if (scope.allowsNone()) {
            // 受限且未授权任何知识库：直接返回空结果，不触达向量库
            log.debug("知识检索被数据范围拦截: uri={}", servletRequest.getRequestURI());
            return Result.ok(emptyResponse());
        }
        if (!scope.unrestricted()) {
            List<Long> requested = request.getKbIds();
            List<Long> allowed = scope.kbIds().stream().sorted().toList();
            if (requested == null || requested.isEmpty()) {
                request.setKbIds(allowed);
            } else {
                List<Long> intersected = requested.stream().filter(Objects::nonNull).filter(scope::allows).toList();
                if (intersected.isEmpty()) {
                    return Result.ok(emptyResponse());
                }
                request.setKbIds(intersected);
            }
        }
        return Result.ok(ragClient.search(request));
    }

    private RagSearchResponse emptyResponse() {
        RagSearchResponse response = new RagSearchResponse();
        response.setSegments(List.of());
        return response;
    }

    private void normalize(RagSearchRequest request) {
        if (request.getTopK() == null || request.getTopK() <= 0) {
            request.setTopK(5);
        }
        if (request.getStrictness() == null || request.getStrictness().isBlank()) {
            request.setStrictness("medium");
        }
    }
}
