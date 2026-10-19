package com.hwc.publish.util;

import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 凭证密钥 AES-GCM 加解密（secret 以密文落库，比对时解密）。
 */
@Component
public class AesCipher {

    private static final int IV_LENGTH = 12;
    private static final int TAG_BITS = 128;

    private final SecretKeySpec keySpec;
    private final SecureRandom random = new SecureRandom();

    public AesCipher(@Value("${hwc.publish.credential-aes-key:hwc-aes-256-key-change-me-please!!}") String key) {
        try {
            byte[] keyBytes = MessageDigest.getInstance("SHA-256")
                    .digest(key.getBytes(StandardCharsets.UTF_8));
            this.keySpec = new SecretKeySpec(keyBytes, "AES");
        } catch (Exception e) {
            throw new IllegalStateException("AES 密钥初始化失败", e);
        }
    }

    public String encrypt(String plain) {
        try {
            byte[] iv = new byte[IV_LENGTH];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] output = new byte[IV_LENGTH + encrypted.length];
            System.arraycopy(iv, 0, output, 0, IV_LENGTH);
            System.arraycopy(encrypted, 0, output, IV_LENGTH, encrypted.length);
            return Base64.getEncoder().encodeToString(output);
        } catch (Exception e) {
            throw new BizException(CommonErrorCode.INTERNAL_ERROR, "凭证加密失败");
        }
    }

    public String decrypt(String cipherText) {
        try {
            byte[] input = Base64.getDecoder().decode(cipherText);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec,
                    new GCMParameterSpec(TAG_BITS, input, 0, IV_LENGTH));
            byte[] plain = cipher.doFinal(input, IV_LENGTH, input.length - IV_LENGTH);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new BizException(CommonErrorCode.INTERNAL_ERROR, "凭证解密失败");
        }
    }
}