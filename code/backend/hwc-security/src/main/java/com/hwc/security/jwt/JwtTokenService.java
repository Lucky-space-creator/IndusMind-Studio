package com.hwc.security.jwt;

import com.hwc.common.constant.HwcConstants;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
public class JwtTokenService {

    private final JwtProperties properties;
    private final SecretKey userKey;
    private final SecretKey adminKey;

    public JwtTokenService(JwtProperties properties) {
        this.properties = properties;
        this.userKey = Keys.hmacShaKeyFor(properties.getUserSecret().getBytes(StandardCharsets.UTF_8));
        this.adminKey = Keys.hmacShaKeyFor(properties.getAdminSecret().getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(Long userId, String username, String end) {
        Map<String, Object> claims = new HashMap<>();
        claims.put(HwcConstants.CLAIM_USER_ID, userId);
        claims.put(HwcConstants.CLAIM_USERNAME, username);
        claims.put(HwcConstants.CLAIM_END, end);
        Instant now = Instant.now();
        Instant expire = now.plusSeconds(properties.getExpireHours() * 3600);
        return Jwts.builder()
                .claims(claims)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expire))
                .signWith(keyOf(end))
                .compact();
    }

    public Claims parseToken(String token, String expectedEnd) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(keyOf(expectedEnd))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            String end = claims.get(HwcConstants.CLAIM_END, String.class);
            if (!expectedEnd.equals(end)) {
                throw new BizException(CommonErrorCode.UNAUTHORIZED, "令牌端类型不匹配");
            }
            return claims;
        } catch (JwtException | IllegalArgumentException e) {
            throw new BizException(CommonErrorCode.UNAUTHORIZED, "登录已过期或令牌无效");
        }
    }

    private SecretKey keyOf(String end) {
        return HwcConstants.END_ADMIN.equals(end) ? adminKey : userKey;
    }
}