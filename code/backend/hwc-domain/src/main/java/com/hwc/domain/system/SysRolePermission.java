package com.hwc.domain.system;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.InsertEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_role_permission")
public class SysRolePermission extends InsertEntity {

    private Long roleId;

    private Long permissionId;
}