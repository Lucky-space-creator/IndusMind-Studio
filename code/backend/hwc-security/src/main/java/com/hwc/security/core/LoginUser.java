package com.hwc.security.core;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.io.Serializable;
import java.util.List;
import java.util.Set;

@Data
@AllArgsConstructor
public class LoginUser implements Serializable {

    private Long userId;
    private String username;
    private String nickname;
    private String end;
    private List<String> roles;
    private Set<String> permissions;

    public boolean hasPermission(String code) {
        return permissions != null && permissions.contains(code);
    }
}