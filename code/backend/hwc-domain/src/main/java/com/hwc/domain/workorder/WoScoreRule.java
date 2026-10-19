package com.hwc.domain.workorder;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("wo_score_rule")
public class WoScoreRule extends BaseEntity {

    private String scopeType;

    private Long scopeId;

    private String ruleConfig;

    private Integer status;

    private String remark;
}