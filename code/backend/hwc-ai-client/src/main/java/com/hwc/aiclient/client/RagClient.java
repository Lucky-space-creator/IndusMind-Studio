package com.hwc.aiclient.client;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwc.aiclient.model.RagDeleteRequest;
import com.hwc.aiclient.model.RagDocumentStatusRequest;
import com.hwc.aiclient.model.RagIndexRequest;
import com.hwc.aiclient.model.RagIndexResponse;
import com.hwc.aiclient.model.RagSearchRequest;
import com.hwc.aiclient.model.RagSearchResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
@Configuration
public class RagClient extends AbstractAiClient {

    public RagClient(RestClient.Builder builder, AiServiceProperties properties, ObjectMapper objectMapper) {
        super(builder, properties, objectMapper, "RAG");
    }

    public RagIndexResponse index(RagIndexRequest request) {
        return post("/rag/index", request, RagIndexResponse.class);
    }

    public RagIndexResponse reindex(RagIndexRequest request) {
        return post("/rag/reindex", request, RagIndexResponse.class);
    }

    public RagSearchResponse search(RagSearchRequest request) {
        return post("/rag/search", request, RagSearchResponse.class);
    }

    public Map<String, Object> updateDocumentStatus(RagDocumentStatusRequest request) {
        return post("/rag/document-status", request,
                new TypeReference<Map<String, Object>>() {
                });
    }

    public Map<String, Object> delete(RagDeleteRequest request) {
        return post("/rag/delete", request,
                new TypeReference<Map<String, Object>>() {
                });
    }
}