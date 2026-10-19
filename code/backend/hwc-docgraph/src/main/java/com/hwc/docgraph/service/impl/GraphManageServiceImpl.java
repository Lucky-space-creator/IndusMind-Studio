package com.hwc.docgraph.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.aiclient.client.DocGraphClient;
import com.hwc.aiclient.model.GraphExtractRequest;
import com.hwc.aiclient.model.GraphSyncRequest;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.domain.docgraph.KbGraphEdge;
import com.hwc.domain.docgraph.KbGraphNode;
import com.hwc.domain.knowledge.KbDocument;
import com.hwc.domain.knowledge.KbSegment;
import com.hwc.knowledge.api.KnowledgeQueryFacade;
import com.hwc.docgraph.mapper.KbGraphEdgeMapper;
import com.hwc.docgraph.mapper.KbGraphNodeMapper;
import com.hwc.docgraph.service.GraphManageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class GraphManageServiceImpl implements GraphManageService {

    private static final int EXTRACT_SEGMENT_LIMIT = 60;

    private final KbGraphNodeMapper nodeMapper;
    private final KbGraphEdgeMapper edgeMapper;
    private final KnowledgeQueryFacade knowledgeQueryFacade;
    private final DocGraphClient docGraphClient;

    @Override
    @Transactional
    public int extractAutoEdges(Long kbId) {
        List<KbDocument> documents = knowledgeQueryFacade.listEnabledDocuments(kbId);
        if (documents.isEmpty()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "知识库下没有启用状态的文档");
        }
        int added = 0;
        for (KbDocument doc : documents) {
            List<KbSegment> segments = knowledgeQueryFacade.listSegmentsByDoc(doc.getId(), EXTRACT_SEGMENT_LIMIT);
            if (segments.isEmpty()) {
                continue;
            }
            ensureDocumentNode(kbId, doc.getId(), doc.getDocName());
            for (KbSegment segment : segments) {
                ensureSegmentNode(kbId, segment);
            }
            added += extractForDocument(kbId, segments);
        }
        return added;
    }

    @Override
    public void syncGraph(Long kbId) {
        List<KbGraphNode> nodes = nodeMapper.selectList(
                new LambdaQueryWrapper<KbGraphNode>().eq(KbGraphNode::getKbId, kbId));
        List<KbGraphEdge> edges = edgeMapper.selectList(
                new LambdaQueryWrapper<KbGraphEdge>().eq(KbGraphEdge::getStatus, "confirmed"));
        if (nodes.isEmpty()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "知识库尚未构建任何图节点");
        }

        GraphSyncRequest request = new GraphSyncRequest();
        request.setKbId(kbId);
        List<GraphSyncRequest.NodeItem> nodeItems = new ArrayList<>();
        for (KbGraphNode node : nodes) {
            GraphSyncRequest.NodeItem item = new GraphSyncRequest.NodeItem();
            item.setNodeId(node.getId());
            item.setNodeType(node.getNodeType());
            item.setRefId(node.getRefId());
            item.setTitle(node.getTitle());
            nodeItems.add(item);
        }
        List<GraphSyncRequest.EdgeItem> edgeItems = new ArrayList<>();
        for (KbGraphEdge edge : edges) {
            GraphSyncRequest.EdgeItem item = new GraphSyncRequest.EdgeItem();
            item.setFromNodeId(edge.getFromNodeId());
            item.setToNodeId(edge.getToNodeId());
            item.setRelationType(edge.getRelationType());
            item.setSource(edge.getSource());
            edgeItems.add(item);
        }
        request.setNodes(nodeItems);
        request.setEdges(edgeItems);
        docGraphClient.sync(request);
    }

    private int extractForDocument(Long kbId, List<KbSegment> segments) {
        GraphExtractRequest request = new GraphExtractRequest();
        request.setKbId(kbId);
        List<GraphExtractRequest.SegmentRef> refs = new ArrayList<>();
        for (KbSegment segment : segments) {
            GraphExtractRequest.SegmentRef ref = new GraphExtractRequest.SegmentRef();
            ref.setSegmentId(segment.getId());
            ref.setDocId(segment.getDocId());
            ref.setContent(segment.getContent());
            ref.setChapter(segment.getChapter());
            refs.add(ref);
        }
        request.setSegments(refs);

        List<GraphExtractRequest.CandidateEdge> candidates = docGraphClient.extract(request);
        int added = 0;
        for (GraphExtractRequest.CandidateEdge candidate : candidates) {
            KbGraphNode fromNode = findNode(candidate.getFromNodeType(), candidate.getFromRefId());
            KbGraphNode toNode = findNode(candidate.getToNodeType(), candidate.getToRefId());
            if (fromNode == null || toNode == null || fromNode.getId().equals(toNode.getId())) {
                continue;
            }
            if (edgeExists(fromNode.getId(), toNode.getId(), candidate.getRelationType())) {
                continue;
            }
            KbGraphEdge edge = new KbGraphEdge();
            edge.setFromNodeId(fromNode.getId());
            edge.setToNodeId(toNode.getId());
            edge.setRelationType(candidate.getRelationType());
            edge.setSource("auto");
            edge.setConfidence(candidate.getConfidence());
            edge.setStatus("pending");
            edgeMapper.insert(edge);
            added++;
        }
        return added;
    }

    private void ensureDocumentNode(Long kbId, Long docId, String title) {
        KbGraphNode existing = findNode("document", docId);
        if (existing != null) {
            return;
        }
        KbGraphNode node = new KbGraphNode();
        node.setKbId(kbId);
        node.setNodeType("document");
        node.setRefId(docId);
        node.setTitle(title);
        nodeMapper.insert(node);
    }

    private void ensureSegmentNode(Long kbId, KbSegment segment) {
        KbGraphNode existing = findNode("segment", segment.getId());
        if (existing != null) {
            return;
        }
        KbGraphNode node = new KbGraphNode();
        node.setKbId(kbId);
        node.setNodeType("segment");
        node.setRefId(segment.getId());
        node.setTitle(resolveTitle(segment));
        node.setExtra(segment.getChapter() == null ? null : "{\"chapter\":\"" + segment.getChapter() + "\"}");
        nodeMapper.insert(node);
    }

    private String resolveTitle(KbSegment segment) {
        String chapter = segment.getChapter();
        String content = segment.getContent();
        if (chapter != null && !chapter.isBlank()) {
            return chapter;
        }
        if (content == null) {
            return "片段-" + segment.getSeqNo();
        }
        return content.length() > 50 ? content.substring(0, 50) : content;
    }

    private KbGraphNode findNode(String nodeType, Long refId) {
        if (nodeType == null || refId == null) {
            return null;
        }
        return nodeMapper.selectOne(new LambdaQueryWrapper<KbGraphNode>()
                .eq(KbGraphNode::getNodeType, nodeType)
                .eq(KbGraphNode::getRefId, refId));
    }

    private boolean edgeExists(Long fromNodeId, Long toNodeId, String relationType) {
        Long count = edgeMapper.selectCount(new LambdaQueryWrapper<KbGraphEdge>()
                .eq(KbGraphEdge::getFromNodeId, fromNodeId)
                .eq(KbGraphEdge::getToNodeId, toNodeId)
                .eq(KbGraphEdge::getRelationType, relationType));
        return count != null && count > 0;
    }
}