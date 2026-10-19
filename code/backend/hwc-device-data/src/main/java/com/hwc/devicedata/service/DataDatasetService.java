package com.hwc.devicedata.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hwc.devicedata.model.SimulateRequest;
import com.hwc.domain.devicedata.DataDataset;
import org.springframework.web.multipart.MultipartFile;

public interface DataDatasetService extends IService<DataDataset> {

    DataDataset importCsv(Long deviceId, String name, MultipartFile file);

    DataDataset simulate(SimulateRequest request);

    void deleteDataset(Long datasetId);
}