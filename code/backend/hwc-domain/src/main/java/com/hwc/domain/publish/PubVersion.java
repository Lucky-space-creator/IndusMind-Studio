package com.hwc.domain.publish;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseVersionLockEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("pub_version")
public class PubVersion extends BaseVersionLockEntity {

    private Long serviceId;

    private String version;

    private String configSnapshot;

    private String changelog;

    private String publishedBy;

    private LocalDateTime publishedAt;
}