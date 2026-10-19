package com.hwc.domain.knowledge;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("kb_segment")
public class KbSegment extends BaseEntity {

    private Long docId;

    private Integer seqNo;

    private String content;

    private String chapter;

    private Integer pageNo;

    private Integer charCount;

    private String keywords;
}