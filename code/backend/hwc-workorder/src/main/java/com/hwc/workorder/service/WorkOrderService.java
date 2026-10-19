package com.hwc.workorder.service;

import com.hwc.domain.workorder.WoWorkOrder;

import java.io.ByteArrayOutputStream;

public interface WorkOrderService {

    WoWorkOrder generate(Long diagnosisId);

    ByteArrayOutputStream renderPdf(Long orderId);

    String archivePdf(Long orderId);
}