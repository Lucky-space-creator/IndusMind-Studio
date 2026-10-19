package com.hwc.publish.service;

import com.hwc.domain.publish.PubCredential;
import com.hwc.domain.publish.PubService;

public interface PublishService {

    PubService createService(PubService service);

    CredentialIssue publish(Long serviceId, String changelog);

    void pause(Long serviceId);

    CredentialIssue rotateCredential(Long serviceId);

    record CredentialIssue(Long credentialId, String accessKey, String secretKey) {
    }
}