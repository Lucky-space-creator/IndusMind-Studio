package com.hwc.aiclient.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.math.BigDecimal;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class Citation {

    private Long docId;
    private Long segmentId;
    private String docName;
    private String chapter;
    private Integer pageNo;
    private BigDecimal score;
}