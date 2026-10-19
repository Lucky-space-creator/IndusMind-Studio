package com.hwc.devicedata.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.device.api.DeviceQueryFacade;
import com.hwc.devicedata.mapper.DataCleanedMapper;
import com.hwc.devicedata.mapper.DataDatasetMapper;
import com.hwc.devicedata.mapper.DataRecordMapper;
import com.hwc.devicedata.model.SimulateRequest;
import com.hwc.devicedata.service.DataAnomalyService;
import com.hwc.devicedata.service.DataCleanService;
import com.hwc.devicedata.service.DataDatasetService;
import com.hwc.devicedata.simulate.DataSimulator;
import com.hwc.domain.device.DevInfo;
import com.hwc.domain.device.DevMetric;
import com.hwc.domain.devicedata.DataCleaned;
import com.hwc.domain.devicedata.DataDataset;
import com.hwc.domain.devicedata.DataRecord;
import com.hwc.infra.minio.MinioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DataDatasetServiceImpl extends ServiceImpl<DataDatasetMapper, DataDataset> implements DataDatasetService {

    private static final String MINIO_BUCKET = "hwc-data";
    private static final int MAX_TOTAL_POINTS = 200_000;
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final DataRecordMapper recordMapper;
    private final DataCleanedMapper cleanedMapper;
    private final DataAnomalyService anomalyService;
    private final DataCleanService cleanService;
    private final DeviceQueryFacade deviceQueryFacade;
    private final DataSimulator simulator;
    private final MinioService minioService;

    @Override
    @Transactional
    public DataDataset importCsv(Long deviceId, String name, MultipartFile file) {
        DevInfo device = requireDevice(deviceId);
        Map<String, Long> codeToId = metricCodeMap(device.getTypeId());

        Map<String, DataRecord> records = new LinkedHashMap<>();
        String fileUrl = null;
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            fileUrl = minioService.upload(MINIO_BUCKET, "datasets", file);
            String line;
            int lineNo = 0;
            while ((line = reader.readLine()) != null) {
                lineNo++;
                String trimmed = line.trim();
                if (trimmed.isEmpty()) {
                    continue;
                }
                String[] parts = trimmed.split("[,;]");
                if (parts.length < 3) {
                    throw new BizException(CommonErrorCode.PARAM_INVALID, "CSV 第" + lineNo + "行格式错误，应为: 采集时间,指标,值");
                }
                LocalDateTime collectTime = parseTime(parts[0].trim(), lineNo);
                Long metricId = resolveMetricId(parts[1].trim(), codeToId, lineNo);
                BigDecimal value = parseValue(parts[2].trim(), lineNo);
                DataRecord record = new DataRecord();
                record.setDatasetId(0L);
                record.setDeviceId(deviceId);
                record.setMetricId(metricId);
                record.setCollectTime(collectTime);
                record.setMetricValue(value);
                records.put(metricId + "|" + collectTime, record);
            }
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "CSV 文件读取失败: " + e.getMessage());
        }
        if (records.isEmpty()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "CSV 文件无有效数据行");
        }
        return persistDataset(deviceId, name != null && !name.isBlank() ? name : file.getOriginalFilename(),
                "import", fileUrl, new ArrayList<>(records.values()));
    }

    @Override
    @Transactional
    public DataDataset simulate(SimulateRequest request) {
        Long deviceId = request.getDeviceId();
        DevInfo device = requireDevice(deviceId);
        List<DevMetric> metrics = deviceQueryFacade.listMetricsByType(device.getTypeId());
        if (metrics.isEmpty()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "该设备类型未配置监测指标");
        }
        int hours = clamp(request.getHours() != null ? request.getHours() : 24, 1, 24 * 30);
        int intervalSec = clamp(request.getIntervalSec() != null ? request.getIntervalSec() : 60, 10, 3600);
        int pointsPerMetric = (int) ((long) hours * 3600 / intervalSec);
        if ((long) pointsPerMetric * metrics.size() > MAX_TOTAL_POINTS) {
            throw new BizException(CommonErrorCode.PARAM_INVALID,
                    "生成规模超出上限（" + MAX_TOTAL_POINTS + " 点），请缩短时长或增大采样间隔");
        }
        Map<Long, DevMetric> metricMap = metrics.stream()
                .collect(Collectors.toMap(DevMetric::getId, m -> m, (a, b) -> a));
        Map<Long, com.hwc.domain.device.DevMetricThreshold> thresholds =
                deviceQueryFacade.getThresholdMap(metrics.stream().map(DevMetric::getId).toList());

        List<DataSimulator.Injection> injections = buildInjections(request, metricMap);
        LocalDateTime startTime = LocalDateTime.now().minusHours(hours).withNano(0);

        List<DataRecord> records = new ArrayList<>();
        for (DevMetric metric : metrics) {
            records.addAll(simulator.generate(metric, thresholds.get(metric.getId()),
                    startTime, pointsPerMetric, intervalSec, injections).stream()
                    .map(point -> {
                        DataRecord record = new DataRecord();
                        record.setDatasetId(0L);
                        record.setDeviceId(deviceId);
                        record.setMetricId(metric.getId());
                        record.setCollectTime(point.collectTime());
                        record.setMetricValue(point.value());
                        return record;
                    }).toList());
        }
        DataDataset dataset = persistDataset(deviceId,
                request.getName() != null && !request.getName().isBlank() ? request.getName()
                        : device.getName() + " 模拟数据",
                "simulate", null, records);

        cleanService.clean(dataset.getId());
        anomalyService.extract(dataset.getId());
        return getById(dataset.getId());
    }

    @Override
    @Transactional
    public void deleteDataset(Long datasetId) {
        DataDataset dataset = getById(datasetId);
        if (dataset == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "数据集不存在");
        }
        recordMapper.delete(new LambdaQueryWrapper<DataRecord>().eq(DataRecord::getDatasetId, datasetId));
        cleanedMapper.delete(new LambdaQueryWrapper<DataCleaned>().eq(DataCleaned::getDatasetId, datasetId));
        anomalyService.deleteByDataset(datasetId);
        removeById(datasetId);
    }

    private DataDataset persistDataset(Long deviceId, String name, String sourceType,
                                       String fileUrl, List<DataRecord> records) {
        records.sort((a, b) -> a.getCollectTime().compareTo(b.getCollectTime()));
        Set<Long> metricIds = new LinkedHashSet<>();
        for (DataRecord record : records) {
            metricIds.add(record.getMetricId());
        }

        DataDataset dataset = new DataDataset();
        dataset.setName(name);
        dataset.setDeviceId(deviceId);
        dataset.setSourceType(sourceType);
        dataset.setFileUrl(fileUrl);
        dataset.setTimeStart(records.get(0).getCollectTime());
        dataset.setTimeEnd(records.get(records.size() - 1).getCollectTime());
        dataset.setRecordCount(records.size());
        dataset.setMetricIds(metricIds.stream().map(String::valueOf).collect(Collectors.joining(",", "[", "]")));
        dataset.setCleanedCount(0);
        dataset.setAnomalyCount(0);
        dataset.setStatus("uploaded");
        save(dataset);

        for (DataRecord record : records) {
            record.setDatasetId(dataset.getId());
            recordMapper.insert(record);
        }
        return dataset;
    }

    private List<DataSimulator.Injection> buildInjections(SimulateRequest request, Map<Long, DevMetric> metricMap) {
        List<DataSimulator.Injection> injections = new ArrayList<>();
        if (request.getFaultInjections() == null) {
            return injections;
        }
        int hours = clamp(request.getHours() != null ? request.getHours() : 24, 1, 24 * 30);
        for (SimulateRequest.FaultInjection fi : request.getFaultInjections()) {
            if (fi.getMetricId() == null || !metricMap.containsKey(fi.getMetricId())) {
                throw new BizException(CommonErrorCode.PARAM_INVALID, "故障注入指标不属于该设备: " + fi.getMetricId());
            }
            long from = (long) (clamp(fi.getFromHour() != null ? fi.getFromHour() : 0, 0, hours) * 3600);
            long to = (long) (clamp(fi.getToHour() != null ? fi.getToHour() : hours, 0, hours) * 3600);
            if (to <= from) {
                throw new BizException(CommonErrorCode.PARAM_INVALID, "故障注入时间窗无效（toHour 需大于 fromHour）");
            }
            String severity = "fault".equals(fi.getSeverity()) ? "fault" : "warn";
            injections.add(new DataSimulator.Injection(fi.getMetricId(), from, to, severity));
        }
        return injections;
    }

    private Map<String, Long> metricCodeMap(Long typeId) {
        List<DevMetric> metrics = deviceQueryFacade.listMetricsByType(typeId);
        if (metrics.isEmpty()) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "该设备类型未配置监测指标");
        }
        return metrics.stream().collect(Collectors.toMap(DevMetric::getCode, DevMetric::getId, (a, b) -> a));
    }

    private Long resolveMetricId(String token, Map<String, Long> codeToId, int lineNo) {
        if (token.chars().allMatch(Character::isDigit) && !token.isEmpty()) {
            return Long.valueOf(token);
        }
        Long byCode = codeToId.get(token);
        if (byCode == null) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "CSV 第" + lineNo + "行指标无法识别: " + token);
        }
        return byCode;
    }

    private LocalDateTime parseTime(String token, int lineNo) {
        String normalized = token.replace(' ', 'T');
        try {
            return LocalDateTime.parse(normalized.length() > 19 ? normalized.substring(0, 19) : normalized);
        } catch (Exception e) {
            throw new BizException(CommonErrorCode.PARAM_INVALID,
                    "CSV 第" + lineNo + "行时间格式错误: " + token + "（应为 yyyy-MM-dd HH:mm:ss）");
        }
    }

    private BigDecimal parseValue(String token, int lineNo) {
        try {
            return new BigDecimal(token);
        } catch (Exception e) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "CSV 第" + lineNo + "行数值格式错误: " + token);
        }
    }

    private DevInfo requireDevice(Long deviceId) {
        DevInfo device = deviceQueryFacade.getDevice(deviceId);
        if (device == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "设备不存在");
        }
        return device;
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }
}