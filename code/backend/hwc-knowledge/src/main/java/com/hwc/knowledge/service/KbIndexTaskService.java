package com.hwc.knowledge.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hwc.aiclient.model.RagIndexRequest;
import com.hwc.domain.knowledge.KbIndexTask;

public interface KbIndexTaskService extends IService<KbIndexTask> {

    void submitIndexTask(Long kbId, Long docId, String taskType, RagIndexRequest request);

    void rebuildIndex(Long kbId, Long docId);
}