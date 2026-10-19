package com.hwc.security.dto.account;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoleVO {

    private Long id;
    private String code;
    private String name;
    private String endType;
    private Integer builtIn;
    private Integer sort;
    private String description;
}