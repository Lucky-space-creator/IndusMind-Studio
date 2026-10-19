package com.hwc.security.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hwc.domain.system.SysUser;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SysUserMapper extends BaseMapper<SysUser> {

    SysUser selectByUsername(@Param("username") String username);

    int updateLastLoginTime(@Param("id") Long id);

    boolean existsByUsername(@Param("username") String username, @Param("excludeId") Long excludeId);
}