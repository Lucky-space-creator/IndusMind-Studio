package com.hwc.security.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hwc.domain.system.SysRole;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SysRoleMapper extends BaseMapper<SysRole> {

    List<SysRole> selectUserRolesByEnd(@Param("userId") Long userId, @Param("end") String end);

    boolean existsByRoleCode(@Param("code") String code, @Param("excludeId") Long excludeId);

    SysRole selectByRoleIdForUpdate(@Param("id") Long id);
}