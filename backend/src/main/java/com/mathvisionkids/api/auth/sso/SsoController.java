package com.mathvisionkids.api.auth.sso;

import com.mathvisionkids.api.auth.AuthResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/api/v1/auth/sso")
public class SsoController {

    private final SsoHandoffService ssoHandoffService;

    public SsoController(SsoHandoffService ssoHandoffService) {
        this.ssoHandoffService = ssoHandoffService;
    }

    /**
     * Issues a short-lived, single-use SSO handoff ticket for the authenticated user.
     * Requires Bearer authentication.
     */
    @PostMapping("/ticket")
    public ResponseEntity<SsoTicketResponse> createTicket(
            Principal principal,
            @Valid @RequestBody SsoTicketRequest request
    ) {
        SsoTicketResponse response = ssoHandoffService.createHandoffTicket(principal.getName(), request.getTargetApp());
        return ResponseEntity.ok(response);
    }

    /**
     * Exchanges a one-time handoff ticket for new JWT access and refresh tokens.
     * Public endpoint: the one-time code is the credential.
     */
    @PostMapping("/exchange")
    public ResponseEntity<AuthResponse> exchangeTicket(
            @Valid @RequestBody SsoExchangeRequest request
    ) {
        AuthResponse response = ssoHandoffService.exchangeHandoffTicket(request.getCode(), request.getTargetApp());
        return ResponseEntity.ok(response);
    }
}
