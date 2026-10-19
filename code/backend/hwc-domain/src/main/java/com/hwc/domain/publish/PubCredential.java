package com.hwc.domain.publish;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("pub_credential")
public class PubCredential extends BaseEntity {

    private Long serviceId;

    private String accessKey;

    private String secretKey;

    private String status;

    private LocalDateTime expireTime;

    private String remark;
}