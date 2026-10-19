package com.hwc.domain.agent;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agent_definition")
public class AgentDefinition extends BaseEntity {

    private String code;

    private String name;

    private String domain;

    private String responsibility;

    private String instruction;

    private String boundary;

    private String params;

    private String outputFormat;

    private String modelConfig;

    private Integer status;

    private Integer sort;
}