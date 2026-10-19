package com.hwc.knowledge.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hwc.domain.knowledge.KbDocument;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface KbDocumentMapper extends BaseMapper<KbDocument> {
}