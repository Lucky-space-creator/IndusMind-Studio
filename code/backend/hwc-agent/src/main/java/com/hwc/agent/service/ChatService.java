package com.hwc.agent.service;

import com.hwc.agent.model.ChatResult;

public interface ChatService {

    ChatResult chat(Long sessionId, String question, java.util.List<Long> kbIds, String matchStrictness);
}