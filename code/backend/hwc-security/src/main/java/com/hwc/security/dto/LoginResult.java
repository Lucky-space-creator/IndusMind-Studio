package com.hwc.security.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class LoginResult {

    private String token;
    private Long userId;
    private String username;
    private String realName;
    private String end;
    private List<String> roles;
    private List<String> permissions;
}