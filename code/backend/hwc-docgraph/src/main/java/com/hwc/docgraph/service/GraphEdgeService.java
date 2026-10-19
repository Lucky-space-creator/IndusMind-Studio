package com.hwc.docgraph.service;

import com.hwc.domain.docgraph.KbGraphEdge;

public interface GraphEdgeService {

    KbGraphEdge createManualEdge(KbGraphEdge edge);

    void updateEdge(Long id, KbGraphEdge patch);

    void deleteEdge(Long id);

    void confirm(Long id);

    void reject(Long id);
}