package com.mathvisionkids.api.auth;

import com.mathvisionkids.api.common.ApiException;
import com.mathvisionkids.api.user.User;
import com.mathvisionkids.api.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

@Service
public class RefreshTokenService {
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;
    
    // Default 7 days
    private final long refreshTokenDurationMs = 7L * 24 * 60 * 60 * 1000;

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository, UserRepository userRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.userRepository = userRepository;
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Error hashing token", e);
        }
    }

    @Transactional
    public String createRefreshToken(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        String rawToken = UUID.randomUUID().toString();
        
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setExpiryDate(Instant.now().plusMillis(refreshTokenDurationMs));
        refreshToken.setTokenHash(hashToken(rawToken));
        refreshTokenRepository.save(refreshToken);

        return rawToken;
    }

    @Transactional
    public User verifyExpiration(String rawToken) {
        String tokenHash = hashToken(rawToken);
        RefreshToken token = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new ApiException("UNAUTHORIZED", "Refresh token is not in database!", HttpStatus.UNAUTHORIZED));

        if (token.isRevoked()) {
            // Compromised token detected: revoke all tokens for this user
            refreshTokenRepository.deleteByUser(token.getUser());
            throw new ApiException("UNAUTHORIZED", "Compromised token detected. All sessions revoked.", HttpStatus.UNAUTHORIZED);
        }

        if (token.getUser().getActive() != null && !token.getUser().getActive()) {
            refreshTokenRepository.deleteByUser(token.getUser());
            throw new ApiException("UNAUTHORIZED", "Account is disabled.", HttpStatus.UNAUTHORIZED);
        }

        if (token.getExpiryDate().compareTo(Instant.now()) < 0) {
            refreshTokenRepository.delete(token);
            throw new ApiException("UNAUTHORIZED", "Refresh token was expired. Please make a new signin request", HttpStatus.UNAUTHORIZED);
        }

        // Mark as revoked (used) since it's being rotated
        token.setRevoked(true);
        refreshTokenRepository.save(token);

        return token.getUser();
    }
    
    @Transactional
    public void deleteByUserId(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        refreshTokenRepository.deleteByUser(user);
    }
}
