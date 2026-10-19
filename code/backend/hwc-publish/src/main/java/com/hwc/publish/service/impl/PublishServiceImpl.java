package com.hwc.publish.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hwc.agent.api.DiagnosisQueryFacade;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.domain.agent.AgentFlow;
import com.hwc.domain.agent.AgentFlowNode;
import com.hwc.domain.publish.PubCredential;
import com.hwc.domain.publish.PubService;
import com.hwc.domain.publish.PubVersion;

import com.hwc.publish.mapper.PubCredentialMapper;
import com.hwc.publish.mapper.PubServiceMapper;
import com.hwc.publish.mapper.PubVersionMapper;
import com.hwc.publish.service.PublishService;
import com.hwc.publish.util.AesCipher;
import com.hwc.security.core.SecurityUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;

/**
 * 服务发布：上线生成凭证（AES 密文落库）与版本快照，暂停/轮换凭证。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublishServiceImpl implements PublishService {

    private final PubServiceMapper serviceMapper;
    private final PubCredentialMapper credentialMapper;
    private final PubVersionMapper versionMapper;

    private final DiagnosisQueryFacade diagnosisQueryFacade;
    private final AesCipher aesCipher;
    private final ObjectMapper objectMapper;
    private final SecureRandom random = new SecureRandom();

    @Override
    @Transactional
    public PubService createService(PubService service) {
        if (service.getFlowId() == null) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "必须关联协同流程");
        }
        AgentFlow flow = diagnosisQueryFacade.getFlow(service.getFlowId());
        if (flow == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "协同流程不存在");
        }
        Long duplicated = serviceMapper.selectCount(new LambdaQueryWrapper<PubService>()
                .eq(PubService::getCode, service.getCode()));
        if (duplicated != null && duplicated > 0) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "服务编码已存在: " + service.getCode());
        }
        service.setStatus("offline");
        service.setCurrentVersion(null);
        serviceMapper.insert(service);
        return service;
    }

    @Override
    @Transactional
    public CredentialIssue publish(Long serviceId, String changelog) {
        PubService service = requireService(serviceId);
        AgentFlow flow = diagnosisQueryFacade.getFlow(service.getFlowId());
        if (flow == null || !"published".equals(flow.getStatus())) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "关联流程未发布，无法上线服务");
        }

        Long versionCount = versionMapper.selectCount(new LambdaQueryWrapper<PubVersion>()
                .eq(PubVersion::getServiceId, serviceId));
        String version = "v" + ((versionCount == null ? 0 : versionCount) + 1);

        PubVersion pubVersion = new PubVersion();
        pubVersion.setServiceId(serviceId);
        pubVersion.setVersion(version);
        pubVersion.setConfigSnapshot(buildSnapshot(service.getFlowId()));
        pubVersion.setChangelog(changelog);
        pubVersion.setPublishedBy(SecurityUtils.getUsername());
        pubVersion.setPublishedAt(LocalDateTime.now());
        versionMapper.insert(pubVersion);

        service.setStatus("online");
        service.setCurrentVersion(version);
        serviceMapper.updateById(service);
        return issueCredential(serviceId);
    }

    @Override
    @Transactional
    public void pause(Long serviceId) {
        PubService service = requireService(serviceId);
        service.setStatus("paused");
        serviceMapper.updateById(service);
    }

    @Override
    @Transactional
    public CredentialIssue rotateCredential(Long serviceId) {
        requireService(serviceId);
        return issueCredential(serviceId);
    }

    private CredentialIssue issueCredential(Long serviceId) {
        credentialMapper.selectList(new LambdaQueryWrapper<PubCredential>()
                        .eq(PubCredential::getServiceId, serviceId)
                        .eq(PubCredential::getStatus, "active"))
                .forEach(credential -> {
                    credential.setStatus("revoked");
                    credentialMapper.updateById(credential);
                });

        String accessKey = "ak-" + randomHex(16);
        String secretKey = randomHex(24);
        PubCredential credential = new PubCredential();
        credential.setServiceId(serviceId);
        credential.setAccessKey(accessKey);
        credential.setSecretKey(aesCipher.encrypt(secretKey));
        credential.setStatus("active");
        credential.setExpireTime(LocalDateTime.now().plusYears(1));
        credentialMapper.insert(credential);
        return new CredentialIssue(credential.getId(), accessKey, secretKey);
    }

    private String buildSnapshot(Long flowId) {
        List<AgentFlowNode> nodes = diagnosisQueryFacade.listFlowNodes(flowId);
        try {
            return objectMapper.writeValueAsString(nodes);
        } catch (Exception e) {
            log.warn("版本快照序列化失败: {}", e.getMessage());
            return "[]";
        }
    }

    private PubService requireService(Long serviceId) {
        PubService service = serviceMapper.selectById(serviceId);
        if (service == null) {
            throw new BizException(CommonErrorCode.NOT_FOUND, "发布服务不存在");
        }
        return service;
    }

    private String randomHex(int bytes) {
        byte[] buffer = new byte[bytes];
        random.nextBytes(buffer);
        return HexFormat.of().formatHex(buffer);
    }
}