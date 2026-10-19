package com.hwc.docgraph.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hwc.domain.docgraph.KbGraphNode;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface KbGraphNodeMapper extends BaseMapper<KbGraphNode> {
}