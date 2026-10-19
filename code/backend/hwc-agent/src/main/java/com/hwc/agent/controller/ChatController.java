package com.hwc.agent.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.common.result.PageResult;
import com.hwc.common.result.Result;
import com.hwc.agent.mapper.ChatMessageMapper;
import com.hwc.agent.mapper.ChatSessionMapper;
import com.hwc.agent.model.ChatResult;
import com.hwc.agent.service.ChatService;
import com.hwc.domain.agent.ChatMessage;
import com.hwc.domain.agent.ChatSession;
import com.hwc.security.core.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Tag(name = "智能问答")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final ChatSessionMapper sessionMapper;
    private final ChatMessageMapper messageMapper;

    @Operation(summary = "我的会话列表")
    @GetMapping("/user/chat/sessions")
    @PreAuthorize("hasAuthority('chat:read')")
    public Result<PageResult<ChatSession>> sessions(@RequestParam(defaultValue = "1") long current,
                                                    @RequestParam(defaultValue = "20") long size) {
        LambdaQueryWrapper<ChatSession> wrapper = new LambdaQueryWrapper<ChatSession>()
                .eq(ChatSession::getUserId, SecurityUtils.getUserId())
                .orderByDesc(ChatSession::getLastMessageTime);
        Page<ChatSession> page = sessionMapper.selectPage(new Page<>(current, size), wrapper);
        return Result.ok(PageResult.of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize()));
    }

    @Operation(summary = "发起问答")
    @PostMapping("/user/chat")
    @PreAuthorize("hasAuthority('chat:write')")
    public Result<ChatResult> chat(@RequestBody Map<String, Object> body) {
        Long sessionId = body.get("sessionId") == null ? null : Long.valueOf(String.valueOf(body.get("sessionId")));
        String question = body.get("question") == null ? null : String.valueOf(body.get("question"));
        @SuppressWarnings("unchecked")
        List<Number> kbIdNumbers = body.get("kbIds") == null ? List.of() : (List<Number>) body.get("kbIds");
        List<Long> kbIds = kbIdNumbers.stream().map(Number::longValue).toList();
        String strictness = body.get("matchStrictness") == null ? null : String.valueOf(body.get("matchStrictness"));
        return Result.ok(chatService.chat(sessionId, question, kbIds, strictness));
    }

    @Operation(summary = "会话消息历史")
    @GetMapping("/user/chat/sessions/{id}/messages")
    @PreAuthorize("hasAuthority('chat:read')")
    public Result<List<ChatMessage>> messages(@PathVariable Long id) {
        ChatSession session = sessionMapper.selectById(id);
        if (session == null || !session.getUserId().equals(SecurityUtils.getUserId())) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "会话不存在");
        }
        return Result.ok(messageMapper.selectList(new LambdaQueryWrapper<ChatMessage>()
                .eq(ChatMessage::getSessionId, id)
                .orderByAsc(ChatMessage::getId)));
    }
}