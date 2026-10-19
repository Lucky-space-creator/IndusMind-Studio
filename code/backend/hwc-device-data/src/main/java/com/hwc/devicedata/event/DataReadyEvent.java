package com.hwc.devicedata.event;

/**
 * 数据集就绪事件（导入/模拟/清洗/异常提取完成后发布，看板等下游模块监听重算）。
 */
public record DataReadyEvent(Long datasetId, Long deviceId, int anomalyCount) {
}