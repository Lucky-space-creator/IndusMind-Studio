package com.hwc.security.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hwc.domain.system.SysPermission;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SysPermissionMapper extends BaseMapper<SysPermission> {

    List<String> selectPermissionCodes(@Param("roleIds") List<Long> roleIds, @Param("end") String end);

    /** 权限点明细（含中文名称与模块），用于界面展示当前账号的具体权限 */
    List<SysPermission> selectPermissionDetails(@Param("roleIds") List<Long> roleIds, @Param("end") String end);
}