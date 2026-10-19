package com.hwc.agent.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hwc.domain.agent.ChatSession;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ChatSessionMapper extends BaseMapper<ChatSession> {
}