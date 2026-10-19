package com.hwc.security.dto.account;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DataScopeVO {

    private Long id;
    private Long roleId;
    private String scopeType;
    private Long scopeId;
    private String remark;
}