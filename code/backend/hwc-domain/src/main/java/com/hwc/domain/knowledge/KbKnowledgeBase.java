package com.hwc.domain.knowledge;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("kb_knowledge_base")
public class KbKnowledgeBase extends BaseEntity {

    private String name;

    private Long devTypeId;

    private String vendor;

    private String faultLevel;

    private Integer docCount;

    private String indexStatus;

    private String description;
}