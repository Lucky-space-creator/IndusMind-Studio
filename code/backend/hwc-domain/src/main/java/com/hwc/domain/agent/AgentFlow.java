package com.hwc.domain.agent;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseVersionLockEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agent_flow")
public class AgentFlow extends BaseVersionLockEntity {

    private String code;

    private String name;

    private Integer version;

    private String status;

    private Integer isPreset;

    private String description;
}