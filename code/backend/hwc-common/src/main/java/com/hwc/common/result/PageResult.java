package com.hwc.common.result;

import lombok.Getter;
import lombok.Setter;

import java.util.Collections;
import java.util.List;

@Getter
@Setter
public class PageResult<T> {

    private List<T> records;
    private long total;
    private long size;
    private long current;

    public static <T> PageResult<T> empty(long current, long size) {
        PageResult<T> page = new PageResult<>();
        page.setRecords(Collections.emptyList());
        page.setTotal(0);
        page.setCurrent(current);
        page.setSize(size);
        return page;
    }

    public static <T> PageResult<T> of(List<T> records, long total, long current, long size) {
        PageResult<T> page = new PageResult<>();
        page.setRecords(records);
        page.setTotal(total);
        page.setCurrent(current);
        page.setSize(size);
        return page;
    }
}