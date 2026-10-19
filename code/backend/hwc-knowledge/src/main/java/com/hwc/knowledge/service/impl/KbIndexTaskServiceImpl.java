package com.hwc.knowledge.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hwc.aiclient.client.RagClient;
import com.hwc.aiclient.model.RagIndexRequest;
import com.hwc.aiclient.model.RagIndexResponse;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.domain.knowledge.KbDocument;
import com.hwc.domain.knowledge.KbIndexTask;
import com.hwc.domain.knowledge.KbKnowledgeBase;
import com.hwc.domain.knowledge.KbSegment;
import com.hwc.knowledge.mapper.KbDocumentMapper;
import com.hwc.knowledge.mapper.KbIndexTaskMapper;
import com.hwc.knowledge.mapper.KbKnowledgeBaseMapper;
import com.hwc.knowledge.mapper.KbSegmentMapper;
import com.hwc.knowledge.service.KbIndexTaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class KbIndexTaskServiceImpl extends ServiceImpl<KbIndexTaskMapper, KbIndexTask> implements KbIndexTaskService {

    private final RagClient ragClient;
    private final KbDocumentMapper documentMapper;
    private final KbSegmentMapper segmentMapper;
    private final KbKnowledgeBaseMapper kbMapper;

    @Override
    public void submitIndexTask(Long kbId, Long docId, String taskType, RagIndexRequest request) {
        KbIndexTask task = new KbIndexTask();
        task.setKbId(kbId);
        task.setDocId(docId);
        task.setTaskType(taskType);
        task.setStatus("running");
        task.setProgress(0);
        task.setStartedAt(LocalDateTime.now());
        save(task);

        try {
            RagIndexResponse response = "reindex".equals(taskType)
                    ? ragClient.reindex(request)
                    : ragClient.index(request);
            task.setStatus("success");
            task.setProgress(100);
            if (response != null && response.getTaskId() != null) {
                task.setIndexVersion(response.getTaskId());
            }
        } catch (BizException e) {
            task.setStatus("failed");
            task.setErrorMsg(e.getMessage());
            log.warn("索引任务失败（可稍后重建恢复）: kbId={}, docId={}, {}", kbId, docId, e.getMessage());
        }
        task.setFinishedAt(LocalDateTime.now());
        updateById(task);

        KbKnowledgeBase kb = kbMapper.selectById(kbId);
        if (kb != null) {
            kb.setIndexStatus("success".equals(task.getStatus()) ? "ready" : "failed");
            kbMapper.updateById(kb);
        }
    }

    @Override
    public void rebuildIndex(Long kbId, Long docId) {
        KbDocument doc = documentMapper.selectById(docId);
        if (doc == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "文档不存在");
        }
        if (!doc.getKbId().equals(kbId)) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "文档不属于该知识库");
        }
        List<KbSegment> segments = segmentMapper.selectList(
                new LambdaQueryWrapper<KbSegment>()
                        .eq(KbSegment::getDocId, docId)
                        .orderByAsc(KbSegment::getSeqNo));
        submitIndexTask(kbId, docId, "reindex", toRequest(doc, segments));
    }

    private RagIndexRequest toRequest(KbDocument doc, List<KbSegment> segments) {
        RagIndexRequest request = new RagIndexRequest();
        request.setKbId(doc.getKbId());
        request.setDocId(doc.getId());
        request.setDocName(doc.getDocName());
        request.setDocStatus(doc.getStatus());
        List<RagIndexRequest.SegmentItem> items = new ArrayList<>();
        for (KbSegment segment : segments) {
            RagIndexRequest.SegmentItem item = new RagIndexRequest.SegmentItem();
            item.setSegmentId(segment.getId());
            item.setSeqNo(segment.getSeqNo());
            item.setContent(segment.getContent());
            item.setChapter(segment.getChapter());
            item.setPageNo(segment.getPageNo());
            item.setKeywords(segment.getKeywords());
            items.add(item);
        }
        request.setSegments(items);
        return request;
    }
}