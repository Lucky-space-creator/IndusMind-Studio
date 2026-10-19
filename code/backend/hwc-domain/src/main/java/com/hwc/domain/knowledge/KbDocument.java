package com.hwc.domain.knowledge;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseVersionLockEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("kb_document")
public class KbDocument extends BaseVersionLockEntity {

    private Long kbId;

    private String docName;

    private String docType;

    private String version;

    private String status;

    private String fileUrl;

    private String fileType;

    private Long fileSize;

    private Integer segmentCount;

    private String remark;
}