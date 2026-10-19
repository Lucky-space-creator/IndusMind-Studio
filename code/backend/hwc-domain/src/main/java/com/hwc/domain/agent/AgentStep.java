package com.hwc.domain.agent;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.AppendEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agent_step")
public class AgentStep extends AppendEntity {

    private Long runId;

    private Integer stepOrder;

    private Long agentId;

    private String phase;

    private String summary;

    private String detail;

    private String citations;

    private Integer durationMs;

    private String status;
}