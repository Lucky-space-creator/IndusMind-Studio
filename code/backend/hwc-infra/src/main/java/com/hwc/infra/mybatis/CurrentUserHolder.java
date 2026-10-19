package com.hwc.infra.mybatis;

public final class CurrentUserHolder {

    private static final ThreadLocal<String> USERNAME = new ThreadLocal<>();

    private CurrentUserHolder() {
    }

    public static void setUsername(String username) {
        USERNAME.set(username);
    }

    public static String getUsername() {
        return USERNAME.get();
    }

    public static void clear() {
        USERNAME.remove();
    }
}