package com.hwc.aiclient.client;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwc.aiclient.model.GraphExtractRequest;
import com.hwc.aiclient.model.GraphQueryRequest;
import com.hwc.aiclient.model.GraphQueryResponse;
import com.hwc.aiclient.model.GraphSyncRequest;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Component
@Configuration
public class DocGraphClient extends AbstractAiClient {

    public DocGraphClient(RestClient.Builder builder, AiServiceProperties properties, ObjectMapper objectMapper) {
        super(builder, properties, objectMapper, "DocGraph");
    }

    public List<GraphExtractRequest.CandidateEdge> extract(GraphExtractRequest request) {
        return post("/graph/extract", request,
                new TypeReference<List<GraphExtractRequest.CandidateEdge>>() {
                });
    }

    public GraphQueryResponse query(GraphQueryRequest request) {
        return post("/graph/query", request, GraphQueryResponse.class);
    }

    public Map<String, Object> sync(GraphSyncRequest request) {
        return post("/graph/sync", request,
                new TypeReference<Map<String, Object>>() {
                });
    }
}