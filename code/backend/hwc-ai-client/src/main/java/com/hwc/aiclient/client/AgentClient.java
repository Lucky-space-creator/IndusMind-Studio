package com.hwc.aiclient.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwc.aiclient.model.ChatRequest;
import com.hwc.aiclient.model.ChatResponse;
import com.hwc.aiclient.model.DiagnosisRunRequest;
import com.hwc.aiclient.model.DiagnosisRunResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@Configuration
public class AgentClient extends AbstractAiClient {

    public AgentClient(RestClient.Builder builder, AiServiceProperties properties, ObjectMapper objectMapper) {
        super(builder, properties, objectMapper, "Agent");
    }

    public ChatResponse chat(ChatRequest request) {
        return post("/chat", request, ChatResponse.class);
    }

    public DiagnosisRunResponse runDiagnosis(DiagnosisRunRequest request) {
        return post("/diagnosis/run", request, DiagnosisRunResponse.class);
    }
}