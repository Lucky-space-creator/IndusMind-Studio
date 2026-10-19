package com.hwc.knowledge.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hwc.domain.knowledge.KbKnowledgeBase;

public interface KbKnowledgeBaseService extends IService<KbKnowledgeBase> {

    void removeKnowledgeBase(Long kbId);
}