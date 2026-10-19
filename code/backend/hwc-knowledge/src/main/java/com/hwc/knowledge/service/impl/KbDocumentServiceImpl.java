package com.hwc.knowledge.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.domain.knowledge.KbDocument;
import com.hwc.domain.knowledge.KbKnowledgeBase;
import com.hwc.domain.knowledge.KbSegment;
import com.hwc.aiclient.client.RagClient;
import com.hwc.aiclient.model.RagDeleteRequest;
import com.hwc.aiclient.model.RagDocumentStatusRequest;
import com.hwc.aiclient.model.RagIndexRequest;
import com.hwc.infra.minio.MinioService;
import com.hwc.knowledge.mapper.KbDocumentMapper;
import com.hwc.knowledge.mapper.KbKnowledgeBaseMapper;
import com.hwc.knowledge.mapper.KbSegmentMapper;
import com.hwc.knowledge.parse.DocumentParser;
import com.hwc.knowledge.parse.TextSegmenter;
import com.hwc.knowledge.service.KbDocumentService;
import com.hwc.knowledge.service.KbIndexTaskService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class KbDocumentServiceImpl extends ServiceImpl<KbDocumentMapper, KbDocument> implements KbDocumentService {

    private static final String MINIO_BUCKET = "hwc-knowledge";
    private static final int CHUNK_SIZE = 800;
    private static final int OVERLAP = 100;

    private final KbKnowledgeBaseMapper kbMapper;
    private final KbSegmentMapper segmentMapper;
    private final DocumentParser documentParser;
    private final MinioService minioService;
    private final RagClient ragClient;
    private final KbIndexTaskService indexTaskService;

    public KbDocumentServiceImpl(KbKnowledgeBaseMapper kbMapper,
                                 KbSegmentMapper segmentMapper,
                                 DocumentParser documentParser,
                                 MinioService minioService,
                                 RagClient ragClient,
                                 KbIndexTaskService indexTaskService) {
        this.kbMapper = kbMapper;
        this.segmentMapper = segmentMapper;
        this.documentParser = documentParser;
        this.minioService = minioService;
        this.ragClient = ragClient;
        this.indexTaskService = indexTaskService;
    }

    @Override
    @Transactional
    public KbDocument upload(Long kbId, String docName, String docType, MultipartFile file) {
        KbKnowledgeBase kb = kbMapper.selectById(kbId);
        if (kb == null) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "知识库不存在");
        }

        String fileUrl = minioService.upload(MINIO_BUCKET, "docs", file);
        String text = documentParser.extractText(file);

        KbDocument doc = new KbDocument();
        doc.setKbId(kbId);
        doc.setDocName(docName == null || docName.isBlank() ? file.getOriginalFilename() : docName);
        doc.setDocType(docType == null || docType.isBlank() ? "manual" : docType);
        doc.setStatus("enabled");
        doc.setFileUrl(fileUrl);
        doc.setFileType(resolveFileType(file.getOriginalFilename()));
        doc.setFileSize(file.getSize());
        save(doc);

        List<KbSegment> segments = persistSegments(doc.getId(), text);

        doc.setSegmentCount(segments.size());
        updateById(doc);

        indexTaskService.submitIndexTask(kbId, doc.getId(), "index", toIndexRequest(doc, segments));

        kb.setDocCount(kb.getDocCount() + 1);
        kbMapper.updateById(kb);
        return doc;
    }

    @Override
    @Transactional
    public void changeStatus(Long docId, String targetStatus) {
        KbDocument doc = getById(docId);
        if (doc == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "文档不存在");
        }
        doc.setStatus(targetStatus);
        updateById(doc);
        try {
            RagDocumentStatusRequest request = new RagDocumentStatusRequest();
            request.setDocIds(List.of(docId));
            request.setTargetStatus(targetStatus);
            ragClient.updateDocumentStatus(request);
        } catch (BizException e) {
            log.warn("文档状态同步向量库失败（稍后可重建索引恢复）: docId={}, {}", docId, e.getMessage());
        }
    }

    @Override
    @Transactional
    public void removeDocument(Long docId) {
        KbDocument doc = getById(docId);
        if (doc == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "文档不存在");
        }
        segmentMapper.delete(new LambdaQueryWrapper<KbSegment>().eq(KbSegment::getDocId, docId));
        removeById(docId);
        try {
            RagDeleteRequest request = new RagDeleteRequest();
            request.setKbId(doc.getKbId());
            request.setDocId(docId);
            ragClient.delete(request);
        } catch (BizException e) {
            log.warn("文档删除同步向量库失败（稍后可重建索引恢复）: docId={}, {}", docId, e.getMessage());
        }
        KbKnowledgeBase kb = kbMapper.selectById(doc.getKbId());
        if (kb != null && kb.getDocCount() > 0) {
            kb.setDocCount(kb.getDocCount() - 1);
            kbMapper.updateById(kb);
        }
    }

    private List<KbSegment> persistSegments(Long docId, String text) {
        TextSegmenter segmenter = new TextSegmenter(CHUNK_SIZE, OVERLAP);
        List<TextSegmenter.Segment> pieces = segmenter.segment(text);
        List<KbSegment> segments = new ArrayList<>();
        for (TextSegmenter.Segment piece : pieces) {
            KbSegment segment = new KbSegment();
            segment.setDocId(docId);
            segment.setSeqNo(piece.getSeqNo());
            segment.setContent(piece.getContent());
            segment.setChapter(piece.getChapter());
            segment.setCharCount(piece.getCharCount());
            segmentMapper.insert(segment);
            segments.add(segment);
        }
        return segments;
    }

    private RagIndexRequest toIndexRequest(KbDocument doc, List<KbSegment> segments) {
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
            items.add(item);
        }
        request.setSegments(items);
        return request;
    }

    private String resolveFileType(String filename) {
        if (filename == null) {
            return null;
        }
        int dot = filename.lastIndexOf('.');
        if (dot < 0) {
            return null;
        }
        return filename.substring(dot + 1).toLowerCase();
    }
}