package com.hwc.domain.agent;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agent_tool_binding")
public class AgentToolBinding extends BaseEntity {

    private Long agentId;

    private String kbIds;

    private String matchStrictness;

    private String tools;

    private String remark;
}