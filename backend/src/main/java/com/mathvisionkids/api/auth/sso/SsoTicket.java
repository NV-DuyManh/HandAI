package com.mathvisionkids.api.auth.sso;

import java.time.Instant;
import java.util.UUID;

public record SsoTicket(
        String code,
        UUID userId,
        String email,
        String role,
        String targetApp,
        Instant expiresAt
) {
    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }
}
