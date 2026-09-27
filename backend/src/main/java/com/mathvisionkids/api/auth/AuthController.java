package com.mathvisionkids.api.auth;

import com.mathvisionkids.api.user.StudentRepository;
import com.mathvisionkids.api.user.User;
import com.mathvisionkids.api.user.UserRepository;
import com.mathvisionkids.api.user.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/v1")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final RefreshTokenService refreshTokenService;

    public AuthController(AuthenticationManager authenticationManager, JwtUtil jwtUtil, UserRepository userRepository, StudentRepository studentRepository, RefreshTokenService refreshTokenService) {
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.studentRepository = studentRepository;
        this.refreshTokenService = refreshTokenService;
    }

    @PostMapping("/auth/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        String token = jwtUtil.generateToken(user.getEmail(), user.getRole());
        String refreshToken = refreshTokenService.createRefreshToken(user.getId());
        return ResponseEntity.ok(new AuthResponse(token, refreshToken));
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getMe(Principal principal) {
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        UserResponse response = new UserResponse();
        response.setUserId(user.getId());
        response.setEmail(user.getEmail());
        response.setRole(user.getRole());
        response.setDisplayName(user.getDisplayName());
        response.setActive(user.getActive());
        response.setCreatedAt(user.getCreatedAt());
        response.setUpdatedAt(user.getUpdatedAt());

        if ("STUDENT".equals(user.getRole())) {
            studentRepository.findById(user.getId()).ifPresent(student -> {
                response.setGradeLevel(student.getGradeLevel());
            });
        }

        return ResponseEntity.ok(response);
    }

    @PostMapping("/auth/refresh")
    public ResponseEntity<AuthResponse> refreshtoken(@Valid @RequestBody TokenRefreshRequest request) {
        String requestRefreshToken = request.getRefreshToken();

        User user = refreshTokenService.verifyExpiration(requestRefreshToken);
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole());
        String newRefreshToken = refreshTokenService.createRefreshToken(user.getId());
        
        return ResponseEntity.ok(new AuthResponse(token, newRefreshToken));
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<Void> logoutUser(Principal principal) {
        if (principal != null) {
            userRepository.findByEmail(principal.getName()).ifPresent(user -> {
                refreshTokenService.deleteByUserId(user.getId());
            });
        }
        return ResponseEntity.ok().build();
    }
}
