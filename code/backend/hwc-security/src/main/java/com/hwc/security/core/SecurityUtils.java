package com.hwc.security.core;

import com.hwc.common.constant.HwcConstants;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;
import java.util.Set;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static LoginUser getLoginUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof LoginUser loginUser) {
            return loginUser;
        }
        return null;
    }

    public static Long getUserId() {
        LoginUser user = getLoginUser();
        return user == null ? null : user.getUserId();
    }

    public static String getUsername() {
        LoginUser user = getLoginUser();
        return user == null ? "anonymous" : user.getUsername();
    }

    public static String getEnd() {
        LoginUser user = getLoginUser();
        return user == null ? null : user.getEnd();
    }

    public static boolean isAdminEnd() {
        return HwcConstants.END_ADMIN.equals(getEnd());
    }

    public static Set<String> getPermissions() {
        LoginUser user = getLoginUser();
        return user == null ? Collections.emptySet() : user.getPermissions();
    }
}