package com.hwc.common.result;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PageQuery {

    private long current = 1;
    private long size = 10;
    private String keyword;

    public long offset() {
        return Math.max(0, (current - 1) * size);
    }
}