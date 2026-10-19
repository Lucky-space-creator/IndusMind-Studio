package com.hwc.agent.model;

import com.hwc.aiclient.model.Citation;
import lombok.Data;

import java.util.List;

/**
 * 问答结果（含会话归属）。
 */
@Data
public class ChatResult {

    private Long sessionId;
    private String answer;
    private List<Citation> citations;
    private Boolean hit;
    private String traceId;
}