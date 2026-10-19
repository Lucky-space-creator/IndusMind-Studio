package com.hwc.domain.publish;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("pub_service")
public class PubService extends BaseEntity {

    private Long flowId;

    private String code;

    private String name;

    private String status;

    private String currentVersion;

    private String description;
}