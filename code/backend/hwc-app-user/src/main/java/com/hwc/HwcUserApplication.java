package com.hwc;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * 用户端启动应用（端口 8080）。
 * 主类位于 com.hwc 根包，默认扫描全部业务模块组件；
 * 各模块 Mapper 均以 @Mapper 注解由 MyBatis-Plus 自动注册。
 */
@SpringBootApplication
@EnableAsync
public class HwcUserApplication {

    public static void main(String[] args) {
        SpringApplication.run(HwcUserApplication.class, args);
    }
}