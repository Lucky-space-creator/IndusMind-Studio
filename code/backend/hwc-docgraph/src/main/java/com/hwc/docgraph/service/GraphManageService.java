package com.hwc.docgraph.service;

public interface GraphManageService {

    int extractAutoEdges(Long kbId);

    void syncGraph(Long kbId);
}