package com.hwc.domain.system;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_role_data_scope")
public class SysRoleDataScope extends BaseEntity {

    private Long roleId;

    private String scopeType;

    private Long scopeId;

    private String remark;
}