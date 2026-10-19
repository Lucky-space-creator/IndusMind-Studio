package com.hwc.domain.docgraph;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("kb_graph_edge")
public class KbGraphEdge extends BaseEntity {

    private Long fromNodeId;

    private Long toNodeId;

    private String relationType;

    private String source;

    private BigDecimal confidence;

    private String status;

    private String remark;
}