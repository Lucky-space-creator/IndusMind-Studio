package com.hwc.agent.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.aiclient.client.AgentClient;
import com.hwc.aiclient.model.ChatRequest;
import com.hwc.aiclient.model.ChatResponse;
import com.hwc.agent.mapper.ChatMessageMapper;
import com.hwc.agent.mapper.ChatSessionMapper;
import com.hwc.agent.model.ChatResult;
import com.hwc.agent.service.ChatService;
import com.hwc.common.context.TraceContext;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.domain.agent.ChatMessage;
import com.hwc.domain.agent.ChatSession;
import com.hwc.security.core.SecurityUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatServiceImpl implements ChatService {

    private final ChatSessionMapper sessionMapper;
    private final ChatMessageMapper messageMapper;
    private final AgentClient agentClient;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public ChatResult chat(Long sessionId, String question, List<Long> kbIds, String matchStrictness) {
        if (question == null || question.isBlank()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "问题不能为空");
        }
        ChatSession session = ensureSession(sessionId, question);

        ChatMessage userMessage = new ChatMessage();
        userMessage.setSessionId(session.getId());
        userMessage.setRole("user");
        userMessage.setContent(question);
        messageMapper.insert(userMessage);

        ChatRequest request = new ChatRequest();
        request.setSessionId(String.valueOf(session.getId()));
        request.setQuestion(question);
        request.setKbIds(kbIds);
        request.setMatchStrictness(matchStrictness != null && !matchStrictness.isBlank() ? matchStrictness : "medium");
        ChatResponse response = agentClient.chat(request);

        ChatMessage assistantMessage = new ChatMessage();
        assistantMessage.setSessionId(session.getId());
        assistantMessage.setRole("assistant");
        assistantMessage.setContent(response.getAnswer());
        assistantMessage.setCitations(toJson(response.getCitations()));
        messageMapper.insert(assistantMessage);

        session.setMessageCount((session.getMessageCount() == null ? 0 : session.getMessageCount()) + 2);
        session.setLastMessageTime(LocalDateTime.now());
        sessionMapper.updateById(session);

        ChatResult result = new ChatResult();
        result.setSessionId(session.getId());
        result.setAnswer(response.getAnswer());
        result.setCitations(response.getCitations());
        result.setHit(response.getHit());
        result.setTraceId(TraceContext.getTraceId());
        return result;
    }

    private ChatSession ensureSession(Long sessionId, String question) {
        if (sessionId != null) {
            ChatSession session = sessionMapper.selectById(sessionId);
            if (session == null) {
                throw new BizException(CommonErrorCode.NOT_FOUND, "会话不存在");
            }
            return session;
        }
        ChatSession session = new ChatSession();
        session.setUserId(SecurityUtils.getUserId());
        session.setTitle(question.length() > 20 ? question.substring(0, 20) : question);
        session.setMessageCount(0);
        session.setLastMessageTime(LocalDateTime.now());
        session.setStatus("active");
        sessionMapper.insert(session);
        return session;
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("引用序列化失败: {}", e.getMessage());
            return null;
        }
    }
}