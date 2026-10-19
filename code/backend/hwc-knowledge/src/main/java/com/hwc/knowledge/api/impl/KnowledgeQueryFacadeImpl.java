package com.hwc.knowledge.api.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.domain.knowledge.KbDocument;
import com.hwc.domain.knowledge.KbKnowledgeBase;
import com.hwc.domain.knowledge.KbSegment;
import com.hwc.knowledge.api.KnowledgeQueryFacade;
import com.hwc.knowledge.mapper.KbDocumentMapper;
import com.hwc.knowledge.mapper.KbKnowledgeBaseMapper;
import com.hwc.knowledge.mapper.KbSegmentMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class KnowledgeQueryFacadeImpl implements KnowledgeQueryFacade {

    private final KbDocumentMapper documentMapper;
    private final KbKnowledgeBaseMapper kbMapper;
    private final KbSegmentMapper segmentMapper;

    @Override
    public List<KbDocument> listEnabledDocuments(Long kbId) {
        return documentMapper.selectList(new LambdaQueryWrapper<KbDocument>()
                .eq(KbDocument::getKbId, kbId)
                .eq(KbDocument::getStatus, "enabled")
                .orderByAsc(KbDocument::getId));
    }

    @Override
    public List<KbSegment> listSegmentsByDoc(Long docId) {
        return segmentMapper.selectList(new LambdaQueryWrapper<KbSegment>()
                .eq(KbSegment::getDocId, docId)
                .orderByAsc(KbSegment::getSeqNo));
    }

    @Override
    public List<KbSegment> listSegmentsByDoc(Long docId, int limit) {
        return segmentMapper.selectList(new LambdaQueryWrapper<KbSegment>()
                .eq(KbSegment::getDocId, docId)
                .orderByAsc(KbSegment::getSeqNo)
                .last("LIMIT " + Math.max(1, limit)));
    }

    @Override
    public List<Long> listKbIdsByDevType(Long devTypeId) {
        return kbMapper.selectList(new LambdaQueryWrapper<KbKnowledgeBase>()
                        .eq(KbKnowledgeBase::getDevTypeId, devTypeId)
                        .select(KbKnowledgeBase::getId))
                .stream().map(KbKnowledgeBase::getId).toList();
    }
}