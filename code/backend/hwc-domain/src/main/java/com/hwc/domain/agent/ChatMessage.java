package com.hwc.domain.agent;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.AppendEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("chat_message")
public class ChatMessage extends AppendEntity {

    private Long sessionId;

    private String role;

    private String content;

    private String citations;
}