package com.mathvisionkids.api.auth.sso;

import com.mathvisionkids.api.auth.AuthResponse;
import com.mathvisionkids.api.auth.JwtUtil;
import com.mathvisionkids.api.auth.RefreshTokenService;
import com.mathvisionkids.api.common.ApiException;
import com.mathvisionkids.api.user.User;
import com.mathvisionkids.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SsoHandoffServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private RefreshTokenService refreshTokenService;

    private SsoHandoffService ssoHandoffService;

    private User teacherUser;
    private User adminUser;
    private User studentUser;

    @BeforeEach
    void setUp() {
        ssoHandoffService = new SsoHandoffService(userRepository, jwtUtil, refreshTokenService);

        teacherUser = new User();
        teacherUser.setId(UUID.randomUUID());
        teacherUser.setEmail("teacher@mathvision.local");
        teacherUser.setRole("TEACHER");
        teacherUser.setActive(true);

        adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setEmail("admin@mathvision.local");
        adminUser.setRole("ADMIN");
        adminUser.setActive(true);

        studentUser = new User();
        studentUser.setId(UUID.randomUUID());
        studentUser.setEmail("student@mathvision.local");
        studentUser.setRole("STUDENT");
        studentUser.setActive(true);
    }

    @Test
    @DisplayName("Teacher can create and exchange SSO handoff ticket")
    void testTeacherSsoFlowSuccess() {
        when(userRepository.findByEmail("teacher@mathvision.local")).thenReturn(Optional.of(teacherUser));
        when(userRepository.findById(teacherUser.getId())).thenReturn(Optional.of(teacherUser));
        when(jwtUtil.generateToken(eq(teacherUser.getEmail()), eq(teacherUser.getRole()))).thenReturn("mock-teacher-jwt");
        when(refreshTokenService.createRefreshToken(teacherUser.getId())).thenReturn("mock-teacher-refresh");

        SsoTicketResponse ticket = ssoHandoffService.createHandoffTicket("teacher@mathvision.local", "TEACHER");
        assertNotNull(ticket.getCode());
        assertTrue(ticket.getCode().startsWith("mvk_sso_"));
        assertEquals("TEACHER", ticket.getTargetApp());
        assertEquals(60, ticket.getExpiresIn());

        AuthResponse auth = ssoHandoffService.exchangeHandoffTicket(ticket.getCode(), "TEACHER");
        assertNotNull(auth);
        assertEquals("mock-teacher-jwt", auth.getAccessToken());
        assertEquals("mock-teacher-refresh", auth.getRefreshToken());
    }

    @Test
    @DisplayName("Admin can create and exchange SSO handoff ticket")
    void testAdminSsoFlowSuccess() {
        when(userRepository.findByEmail("admin@mathvision.local")).thenReturn(Optional.of(adminUser));
        when(userRepository.findById(adminUser.getId())).thenReturn(Optional.of(adminUser));
        when(jwtUtil.generateToken(eq(adminUser.getEmail()), eq(adminUser.getRole()))).thenReturn("mock-admin-jwt");
        when(refreshTokenService.createRefreshToken(adminUser.getId())).thenReturn("mock-admin-refresh");

        SsoTicketResponse ticket = ssoHandoffService.createHandoffTicket("admin@mathvision.local", "ADMIN");
        assertNotNull(ticket.getCode());
        assertEquals("ADMIN", ticket.getTargetApp());

        AuthResponse auth = ssoHandoffService.exchangeHandoffTicket(ticket.getCode(), "ADMIN");
        assertEquals("mock-admin-jwt", auth.getAccessToken());
    }

    @Test
    @DisplayName("Student is forbidden from requesting TEACHER ticket")
    void testStudentCannotRequestTeacherTicket() {
        when(userRepository.findByEmail("student@mathvision.local")).thenReturn(Optional.of(studentUser));

        ApiException ex = assertThrows(ApiException.class, () ->
                ssoHandoffService.createHandoffTicket("student@mathvision.local", "TEACHER")
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertEquals("FORBIDDEN", ex.getCode());
    }

    @Test
    @DisplayName("Single-use ticket replay protection: second exchange fails")
    void testSingleUseTicketReplayFails() {
        when(userRepository.findByEmail("teacher@mathvision.local")).thenReturn(Optional.of(teacherUser));
        when(userRepository.findById(teacherUser.getId())).thenReturn(Optional.of(teacherUser));
        when(jwtUtil.generateToken(any(), any())).thenReturn("mock-jwt");
        when(refreshTokenService.createRefreshToken(any())).thenReturn("mock-refresh");

        SsoTicketResponse ticket = ssoHandoffService.createHandoffTicket("teacher@mathvision.local", "TEACHER");
        AuthResponse firstExchange = ssoHandoffService.exchangeHandoffTicket(ticket.getCode(), "TEACHER");
        assertNotNull(firstExchange);

        // Replay attempt
        ApiException ex = assertThrows(ApiException.class, () ->
                ssoHandoffService.exchangeHandoffTicket(ticket.getCode(), "TEACHER")
        );
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        assertEquals("INVALID_TICKET", ex.getCode());
    }

    @Test
    @DisplayName("Target app mismatch: Teacher ticket cannot be exchanged for ADMIN")
    void testTargetAppMismatch() {
        when(userRepository.findByEmail("teacher@mathvision.local")).thenReturn(Optional.of(teacherUser));

        SsoTicketResponse ticket = ssoHandoffService.createHandoffTicket("teacher@mathvision.local", "TEACHER");

        ApiException ex = assertThrows(ApiException.class, () ->
                ssoHandoffService.exchangeHandoffTicket(ticket.getCode(), "ADMIN")
        );
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        assertEquals("TARGET_MISMATCH", ex.getCode());
    }

    @Test
    @DisplayName("Unknown or non-existent ticket code fails exchange")
    void testUnknownTicketCodeFails() {
        ApiException ex = assertThrows(ApiException.class, () ->
                ssoHandoffService.exchangeHandoffTicket("mvk_sso_nonexistent_code", "TEACHER")
        );
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        assertEquals("INVALID_TICKET", ex.getCode());
    }

    @Test
    @DisplayName("Expired ticket is rejected on exchange")
    void testExpiredTicketRejected() {
        SsoTicket expiredTicket = new SsoTicket(
                "mvk_sso_expired_code_12345",
                teacherUser.getId(),
                teacherUser.getEmail(),
                teacherUser.getRole(),
                "TEACHER",
                java.time.Instant.now().minusSeconds(10)
        );
        ssoHandoffService.storeTicketForTesting(expiredTicket);

        ApiException ex = assertThrows(ApiException.class, () ->
                ssoHandoffService.exchangeHandoffTicket("mvk_sso_expired_code_12345", "TEACHER")
        );
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        assertTrue("EXPIRED_TICKET".equals(ex.getCode()) || "INVALID_TICKET".equals(ex.getCode()));
    }

    @Test
    @DisplayName("Ticket cache hygiene: cleanupExpiredTickets removes expired entries")
    void testExpiredTicketHygieneCleanup() {
        SsoTicket expiredTicket = new SsoTicket(
                "mvk_sso_expired_hygiene_test",
                teacherUser.getId(),
                teacherUser.getEmail(),
                teacherUser.getRole(),
                "TEACHER",
                java.time.Instant.now().minusSeconds(10)
        );
        ssoHandoffService.storeTicketForTesting(expiredTicket);

        ssoHandoffService.cleanupExpiredTickets();
        assertEquals(0, ssoHandoffService.getActiveTicketCount());
    }
}
