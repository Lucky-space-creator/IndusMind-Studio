package com.hwc.knowledge.api;

import com.hwc.domain.knowledge.KbDocument;
import com.hwc.domain.knowledge.KbSegment;

import java.util.List;

/**
 * 知识库对外查询 Facade（跨模块唯一入口，供 hwc-docgraph 等下游模块使用）。
 */
public interface KnowledgeQueryFacade {

    List<KbDocument> listEnabledDocuments(Long kbId);

    List<KbSegment> listSegmentsByDoc(Long docId);

    List<KbSegment> listSegmentsByDoc(Long docId, int limit);

    List<Long> listKbIdsByDevType(Long devTypeId);
}