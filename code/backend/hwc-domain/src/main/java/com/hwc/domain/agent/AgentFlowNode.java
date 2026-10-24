package com.hwc.domain.agent;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agent_flow_node")
public class AgentFlowNode extends BaseEntity {

    private Long flowId;

    private Integer nodeOrder;

    private String nodeName;

    private Long agentId;

    private String instanceKey;

    private String upstreamInstanceKey;

    private String triggerCondition;

    private Integer timeoutSeconds;

    private Integer positionX;

    private Integer positionY;

    private Integer sortSeq;

    private String remark;
}