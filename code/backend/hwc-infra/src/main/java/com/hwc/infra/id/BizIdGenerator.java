package com.hwc.infra.id;

import cn.hutool.core.lang.Snowflake;
import cn.hutool.core.util.IdUtil;

public final class BizIdGenerator {

    private static final Snowflake SNOWFLAKE = IdUtil.getSnowflake();

    private BizIdGenerator() {
    }

    public static long nextId() {
        return SNOWFLAKE.nextId();
    }

    public static String orderNo() {
        return "WO" + SNOWFLAKE.nextId();
    }
}