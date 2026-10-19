package com.hwc.agent.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hwc.domain.agent.ChatMessage;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ChatMessageMapper extends BaseMapper<ChatMessage> {
}