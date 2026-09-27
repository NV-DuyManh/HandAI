package com.mathvisionkids.api.auth.sso;

import com.mathvisionkids.api.auth.AuthResponse;
import com.mathvisionkids.api.auth.JwtUtil;
import com.mathvisionkids.api.auth.RefreshTokenService;
import com.mathvisionkids.api.common.ApiException;
import com.mathvisionkids.api.user.User;
import com.mathvisionkids.api.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class SsoHandoffService {

    private static final int TICKET_TTL_SECONDS = 60;
    private final Map<String, SsoTicket> ticketStore = new ConcurrentHashMap<>();
    private final SecureRandom secureRandom = new SecureRandom();

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final RefreshTokenService refreshTokenService;

    public SsoHandoffService(UserRepository userRepository, JwtUtil jwtUtil, RefreshTokenService refreshTokenService) {
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
        this.refreshTokenService = refreshTokenService;
    }

    /**
     * Creates a short-lived, single-use SSO handoff ticket for an authenticated user.
     * Enforces strict RBAC: users cannot request tickets for roles they do not possess.
     */
    public SsoTicketResponse createHandoffTicket(String userEmail, String targetApp) {
        if (targetApp == null || targetApp.isBlank()) {
            throw new ApiException("VALIDATION_ERROR", "targetApp is required", HttpStatus.BAD_REQUEST);
        }

        String targetUpper = targetApp.trim().toUpperCase();
        if (!"TEACHER".equals(targetUpper) && !"ADMIN".equals(targetUpper)) {
            throw new ApiException("VALIDATION_ERROR", "Invalid targetApp. Must be TEACHER or ADMIN", HttpStatus.BAD_REQUEST);
        }

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new ApiException("ACCOUNT_INACTIVE", "User account is inactive", HttpStatus.FORBIDDEN);
        }

        String userRole = user.getRole() != null ? user.getRole().toUpperCase().replace("ROLE_", "") : "";
        if (!userRole.equals(targetUpper)) {
            log.warn("Unauthorized SSO ticket request by user {} (role: {}) for target app {}", userEmail, userRole, targetUpper);
            throw new ApiException("FORBIDDEN", "User role " + userRole + " is not authorized for target portal " + targetUpper, HttpStatus.FORBIDDEN);
        }

        // Clean up expired tickets lazily
        cleanupExpiredTickets();

        // Generate cryptographically secure random token
        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);
        String code = "mvk_sso_" + HexFormat.of().formatHex(randomBytes);

        Instant expiresAt = Instant.now().plusSeconds(TICKET_TTL_SECONDS);
        SsoTicket ticket = new SsoTicket(
                code,
                user.getId(),
                user.getEmail(),
                user.getRole(),
                targetUpper,
                expiresAt
        );

        ticketStore.put(code, ticket);
        log.info("Created SSO handoff ticket for user {} targeting app {}", userEmail, targetUpper);

        return SsoTicketResponse.builder()
                .code(code)
                .expiresIn(TICKET_TTL_SECONDS)
                .targetApp(targetUpper)
                .build();
    }

    /**
     * Atomically exchanges a one-time SSO handoff ticket for a fresh JWT session.
     * Enforces single-use, TTL expiration, and target app binding.
     */
    public AuthResponse exchangeHandoffTicket(String code, String targetApp) {
        if (code == null || code.isBlank()) {
            throw new ApiException("VALIDATION_ERROR", "SSO code is required", HttpStatus.BAD_REQUEST);
        }

        // Clean up expired tickets lazily on exchange as well
        cleanupExpiredTickets();

        // Atomic removal guarantees single-use and eliminates replay attacks
        SsoTicket ticket = ticketStore.remove(code.trim());
        if (ticket == null) {
            log.warn("Rejected SSO exchange: Ticket not found or already used");
            throw new ApiException("INVALID_TICKET", "Invalid, already used, or expired SSO handoff code", HttpStatus.UNAUTHORIZED);
        }

        if (ticket.isExpired()) {
            log.warn("Rejected SSO exchange: Ticket expired for user {}", ticket.email());
            throw new ApiException("EXPIRED_TICKET", "SSO handoff code has expired", HttpStatus.UNAUTHORIZED);
        }

        if (targetApp != null && !targetApp.isBlank()) {
            String targetUpper = targetApp.trim().toUpperCase();
            if (!ticket.targetApp().equalsIgnoreCase(targetUpper)) {
                log.warn("Rejected SSO exchange: Ticket target mismatch (expected: {}, requested: {})", ticket.targetApp(), targetUpper);
                throw new ApiException("TARGET_MISMATCH", "SSO handoff ticket is not valid for target app " + targetUpper, HttpStatus.UNAUTHORIZED);
            }
        }

        User user = userRepository.findById(ticket.userId())
                .orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new ApiException("ACCOUNT_INACTIVE", "User account is inactive", HttpStatus.FORBIDDEN);
        }

        String accessToken = jwtUtil.generateToken(user.getEmail(), user.getRole());
        String refreshToken = refreshTokenService.createRefreshToken(user.getId());

        log.info("Successfully exchanged SSO handoff ticket for user {} to portal {}", user.getEmail(), ticket.targetApp());
        return new AuthResponse(accessToken, refreshToken);
    }

    @org.springframework.scheduling.annotation.Scheduled(fixedRate = 60000)
    public void cleanupExpiredTickets() {
        int initialCount = ticketStore.size();
        ticketStore.entrySet().removeIf(entry -> entry.getValue().isExpired());
        int pruned = initialCount - ticketStore.size();
        if (pruned > 0) {
            log.debug("SSO cache hygiene: Pruned {} expired ticket(s)", pruned);
        }
    }

    public int getActiveTicketCount() {
        cleanupExpiredTickets();
        return ticketStore.size();
    }

    // Package-private helper for unit testing ticket expiration and cleanup
    void storeTicketForTesting(SsoTicket ticket) {
        ticketStore.put(ticket.code(), ticket);
    }
}
