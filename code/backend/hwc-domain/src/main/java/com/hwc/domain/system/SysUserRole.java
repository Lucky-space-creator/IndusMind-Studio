package com.hwc.domain.system;

import com.baomidou.mybatisplus.annotation.TableName;
import com.hwc.domain.base.InsertEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_user_role")
public class SysUserRole extends InsertEntity {

    private Long userId;

    private Long roleId;
}