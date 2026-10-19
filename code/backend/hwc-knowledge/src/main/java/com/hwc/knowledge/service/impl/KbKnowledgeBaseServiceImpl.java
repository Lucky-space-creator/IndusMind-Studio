package com.hwc.knowledge.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.domain.knowledge.KbDocument;
import com.hwc.domain.knowledge.KbKnowledgeBase;
import com.hwc.knowledge.mapper.KbDocumentMapper;
import com.hwc.knowledge.mapper.KbKnowledgeBaseMapper;
import com.hwc.knowledge.service.KbKnowledgeBaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class KbKnowledgeBaseServiceImpl extends ServiceImpl<KbKnowledgeBaseMapper, KbKnowledgeBase> implements KbKnowledgeBaseService {

    private final KbDocumentMapper documentMapper;

    @Override
    public void removeKnowledgeBase(Long kbId) {
        KbKnowledgeBase kb = getById(kbId);
        if (kb == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "知识库不存在");
        }
        Long docCount = documentMapper.selectCount(
                new LambdaQueryWrapper<KbDocument>().eq(KbDocument::getKbId, kbId));
        if (docCount != null && docCount > 0) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "知识库下仍有文档，请先删除文档");
        }
        removeById(kbId);
    }
}