package com.hwc.knowledge.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.IService;
import com.hwc.domain.knowledge.KbDocument;
import org.springframework.web.multipart.MultipartFile;

public interface KbDocumentService extends IService<KbDocument> {

    KbDocument upload(Long kbId, String docName, String docType, MultipartFile file);

    void changeStatus(Long docId, String targetStatus);

    void removeDocument(Long docId);
}