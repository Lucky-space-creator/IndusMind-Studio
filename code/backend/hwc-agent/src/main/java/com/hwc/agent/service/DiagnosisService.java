package com.hwc.agent.service;

import com.hwc.aiclient.model.DiagnosisRunResponse;

public interface DiagnosisService {

    DiagnosisRunResponse run(Long deviceId, Long datasetId, Long flowId, String phenomenon);
}