package com.hwc.security.config;

import com.hwc.security.filter.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@EnableConfigurationProperties({SecurityProperties.class, com.hwc.security.jwt.JwtProperties.class})
@ComponentScan(basePackages = "com.hwc.security")
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final SecurityProperties securityProperties;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(cors -> {
                })
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    for (String pattern : securityProperties.getWhitelist()) {
                        auth.requestMatchers(pattern).permitAll();
                    }
                    auth.anyRequest().authenticated();
                })
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint((req, resp, e) -> {
                            resp.setStatus(HttpStatus.UNAUTHORIZED.value());
                            resp.setContentType("application/json;charset=UTF-8");
                            resp.getWriter().write(
                                    "{\"code\":401,\"errorCode\":\"COMMON_4001\",\"message\":\"未登录或登录已过期\",\"data\":null,\"traceId\":\"\"}");
                        })
                        .accessDeniedHandler((req, resp, e) -> {
                            resp.setStatus(HttpStatus.FORBIDDEN.value());
                            resp.setContentType("application/json;charset=UTF-8");
                            resp.getWriter().write(
                                    "{\"code\":403,\"errorCode\":\"COMMON_4003\",\"message\":\"无访问权限\",\"data\":null,\"traceId\":\"\"}");
                        }))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}