package com.hwc.domain.publish;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.AppendEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("pub_call_log")
public class PubCallLog extends AppendEntity {

    private Long serviceId;

    private Long credentialId;

    private String traceId;

    private String apiPath;

    private Integer latencyMs;

    private Integer success;

    private Integer httpStatus;

    private String errorMsg;

    private LocalDateTime callTime;
}