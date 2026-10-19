package com.hwc.domain.system;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_role")
public class SysRole extends BaseEntity {

    private String code;

    private String name;

    private String endType;

    private Integer builtIn;

    private Integer sort;

    private String description;
}