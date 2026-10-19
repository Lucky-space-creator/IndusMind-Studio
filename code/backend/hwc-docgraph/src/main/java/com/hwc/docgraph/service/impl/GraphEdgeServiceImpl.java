package com.hwc.docgraph.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.domain.docgraph.KbGraphEdge;
import com.hwc.domain.docgraph.KbGraphNode;
import com.hwc.docgraph.mapper.KbGraphEdgeMapper;
import com.hwc.docgraph.mapper.KbGraphNodeMapper;
import com.hwc.docgraph.service.GraphEdgeService;
import com.hwc.docgraph.service.GraphManageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class GraphEdgeServiceImpl implements GraphEdgeService {

    private static final Set<String> VALID_RELATIONS = Set.of(
            "reference", "supplement", "replacement", "prerequisite", "same_device", "same_fault");

    private final KbGraphEdgeMapper edgeMapper;
    private final KbGraphNodeMapper nodeMapper;
    private final GraphManageService graphManageService;

    @Override
    public KbGraphEdge createManualEdge(KbGraphEdge edge) {
        validateRelation(edge.getRelationType());
        KbGraphNode fromNode = requireNode(edge.getFromNodeId());
        KbGraphNode toNode = requireNode(edge.getToNodeId());
        if (fromNode.getId().equals(toNode.getId())) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "起止节点不能相同");
        }
        if (edgeExists(fromNode.getId(), toNode.getId(), edge.getRelationType())) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "相同节点间已存在该类型的关系边");
        }
        edge.setSource("manual");
        edge.setStatus("confirmed");
        edge.setConfidence(null);
        edgeMapper.insert(edge);
        syncQuietly(fromNode.getKbId());
        return edge;
    }

    @Override
    public void updateEdge(Long id, KbGraphEdge patch) {
        KbGraphEdge edge = requireEdge(id);
        validateRelation(patch.getRelationType());
        Long fromNodeId = patch.getFromNodeId() != null ? patch.getFromNodeId() : edge.getFromNodeId();
        Long toNodeId = patch.getToNodeId() != null ? patch.getToNodeId() : edge.getToNodeId();
        if (!fromNodeId.equals(edge.getFromNodeId()) || !toNodeId.equals(edge.getToNodeId())
                || !patch.getRelationType().equals(edge.getRelationType())) {
            if (edgeExists(fromNodeId, toNodeId, patch.getRelationType())) {
                throw new BizException(CommonErrorCode.PARAM_INVALID, "相同节点间已存在该类型的关系边");
            }
        }
        KbGraphNode fromNode = requireNode(fromNodeId);
        requireNode(toNodeId);
        edge.setFromNodeId(fromNodeId);
        edge.setToNodeId(toNodeId);
        edge.setRelationType(patch.getRelationType());
        edge.setRemark(patch.getRemark());
        edgeMapper.updateById(edge);
        syncQuietly(fromNode.getKbId());
    }

    @Override
    public void deleteEdge(Long id) {
        KbGraphEdge edge = requireEdge(id);
        KbGraphNode fromNode = nodeMapper.selectById(edge.getFromNodeId());
        edgeMapper.deleteById(id);
        if (fromNode != null) {
            syncQuietly(fromNode.getKbId());
        }
    }

    @Override
    public void confirm(Long id) {
        KbGraphEdge edge = requireEdge(id);
        if (!"pending".equals(edge.getStatus())) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "仅待确认状态的自动边可确认");
        }
        edge.setStatus("confirmed");
        edgeMapper.updateById(edge);
        KbGraphNode fromNode = nodeMapper.selectById(edge.getFromNodeId());
        if (fromNode != null) {
            syncQuietly(fromNode.getKbId());
        }
    }

    @Override
    public void reject(Long id) {
        KbGraphEdge edge = requireEdge(id);
        if (!"pending".equals(edge.getStatus())) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "仅待确认状态的自动边可拒绝");
        }
        edge.setStatus("rejected");
        edgeMapper.updateById(edge);
    }

    private KbGraphNode requireNode(Long nodeId) {
        KbGraphNode node = nodeMapper.selectById(nodeId);
        if (node == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "图节点不存在: " + nodeId);
        }
        return node;
    }

    private KbGraphEdge requireEdge(Long id) {
        KbGraphEdge edge = edgeMapper.selectById(id);
        if (edge == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "关系边不存在");
        }
        return edge;
    }

    private void validateRelation(String relationType) {
        if (!VALID_RELATIONS.contains(relationType)) {
            throw new BizException(CommonErrorCode.PARAM_INVALID,
                    "关系类型仅支持: " + String.join("/", VALID_RELATIONS));
        }
    }

    private boolean edgeExists(Long fromNodeId, Long toNodeId, String relationType) {
        Long count = edgeMapper.selectCount(new LambdaQueryWrapper<KbGraphEdge>()
                .eq(KbGraphEdge::getFromNodeId, fromNodeId)
                .eq(KbGraphEdge::getToNodeId, toNodeId)
                .eq(KbGraphEdge::getRelationType, relationType));
        return count != null && count > 0;
    }

    private void syncQuietly(Long kbId) {
        try {
            graphManageService.syncGraph(kbId);
        } catch (Exception e) {
            log.warn("人工操作后同步关联图失败（可稍后手动重建）: kbId={}, {}", kbId, e.getMessage());
        }
    }
}