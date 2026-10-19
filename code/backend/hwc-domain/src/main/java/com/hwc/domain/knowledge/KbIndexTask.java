package com.hwc.domain.knowledge;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("kb_index_task")
public class KbIndexTask extends BaseEntity {

    private Long kbId;

    private Long docId;

    private String taskType;

    private String status;

    private Integer progress;

    private String indexVersion;

    private String errorMsg;

    private LocalDateTime startedAt;

    private LocalDateTime finishedAt;
}