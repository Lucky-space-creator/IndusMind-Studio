package com.hwc.knowledge.parse;

import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.TikaCoreProperties;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;

@Component
public class DocumentParser {

    public String extractText(MultipartFile file) {
        try (InputStream in = file.getInputStream()) {
            AutoDetectParser parser = new AutoDetectParser();
            BodyContentHandler handler = new BodyContentHandler(-1);
            Metadata metadata = new Metadata();
            metadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, file.getOriginalFilename());
            parser.parse(in, handler, metadata);
            return handler.toString();
        } catch (Exception e) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "文档解析失败：" + e.getMessage());
        }
    }
}