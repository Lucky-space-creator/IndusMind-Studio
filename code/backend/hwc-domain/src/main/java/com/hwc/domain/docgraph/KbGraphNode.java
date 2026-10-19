package com.hwc.domain.docgraph;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("kb_graph_node")
public class KbGraphNode extends BaseEntity {

    private Long kbId;

    private String nodeType;

    private Long refId;

    private String title;

    private String extra;
}