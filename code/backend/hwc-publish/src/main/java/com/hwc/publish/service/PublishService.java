package com.hwc.publish.service;

import com.hwc.domain.publish.PubCredential;
import com.hwc.domain.publish.PubService;

public interface PublishService {

    PubService createService(PubService service);

    /**
     * 修改已创建/已部署服务的基础配置。
     * <p>
     * 仅允许修改名称、说明与关联流程；服务编码是对外调用地址的一部分，
     * 状态与当前版本由发布/暂停流程托管，均不可经此接口变更。
     */
    PubService updateService(Long serviceId, PubService patch);

    CredentialIssue publish(Long serviceId, String changelog);

    void pause(Long serviceId);

    CredentialIssue rotateCredential(Long serviceId);

    record CredentialIssue(Long credentialId, String accessKey, String secretKey) {
    }
}