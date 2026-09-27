package com.mathvisionkids.api.auth;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathvisionkids.api.user.User;
import com.mathvisionkids.api.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private User testUser;

    @BeforeEach
    public void setup() {
        // Use TransactionTemplate to ensure the user is committed before MockMvc runs its own transactions.
        // @Transactional on @BeforeEach does NOT commit before the test method runs.
        TransactionTemplate tt = new TransactionTemplate(transactionManager);
        testUser = tt.execute(status -> {
            User u = new User();
            u.setEmail("test" + UUID.randomUUID() + "@student.com");
            u.setPasswordHash(passwordEncoder.encode("password"));
            u.setRole("STUDENT");
            u.setDisplayName("Test Student");
            return userRepository.save(u);
        });
    }

    @AfterEach
    public void cleanup() {
        if (testUser != null && testUser.getId() != null) {
            TransactionTemplate tt = new TransactionTemplate(transactionManager);
            tt.execute(status -> {
                refreshTokenRepository.deleteByUser(testUser);
                userRepository.deleteById(testUser.getId());
                return null;
            });
        }
    }

    @Test
    public void testLoginReturnsRefreshToken() throws Exception {
        Map<String, String> loginRequest = new HashMap<>();
        loginRequest.put("email", testUser.getEmail());
        loginRequest.put("password", "password");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andExpect(jsonPath("$.refreshToken").exists());
    }

    @Test
    public void testValidRefreshSucceedsAndRotates() throws Exception {
        // 1. Login
        Map<String, String> loginRequest = new HashMap<>();
        loginRequest.put("email", testUser.getEmail());
        loginRequest.put("password", "password");

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String loginResponse = loginResult.getResponse().getContentAsString();
        Map<String, String> authData = objectMapper.readValue(loginResponse, new TypeReference<Map<String, String>>() {});
        String oldRefreshToken = authData.get("refreshToken");

        // 2. Refresh
        Map<String, String> refreshReq = new HashMap<>();
        refreshReq.put("refreshToken", oldRefreshToken);

        MvcResult refreshResult = mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(refreshReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andExpect(jsonPath("$.refreshToken").exists())
                .andReturn();

        String refreshResp = refreshResult.getResponse().getContentAsString();
        Map<String, String> refreshData = objectMapper.readValue(refreshResp, new TypeReference<Map<String, String>>() {});
        String newRefreshToken = refreshData.get("refreshToken");

        assertNotEquals(oldRefreshToken, newRefreshToken);
    }

    @Test
    public void testReusedRotatedTokenIsRejected() throws Exception {
        // 1. Login
        Map<String, String> loginRequest = new HashMap<>();
        loginRequest.put("email", testUser.getEmail());
        loginRequest.put("password", "password");

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String loginResponse = loginResult.getResponse().getContentAsString();
        Map<String, String> authData = objectMapper.readValue(loginResponse, new TypeReference<Map<String, String>>() {});
        String oldRefreshToken = authData.get("refreshToken");

        // 2. Refresh to rotate it
        Map<String, String> refreshReq = new HashMap<>();
        refreshReq.put("refreshToken", oldRefreshToken);
        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(refreshReq)))
                .andExpect(status().isOk());

        // 3. Attempt to use old token again (replay attack) — should trigger compromise revocation
        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(refreshReq)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void testLogoutRevokesToken() throws Exception {
        // 1. Login
        Map<String, String> loginRequest = new HashMap<>();
        loginRequest.put("email", testUser.getEmail());
        loginRequest.put("password", "password");

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String loginResponse = loginResult.getResponse().getContentAsString();
        Map<String, String> authData = objectMapper.readValue(loginResponse, new TypeReference<Map<String, String>>() {});
        String jwtToken = authData.get("accessToken");
        String refreshToken = authData.get("refreshToken");

        // 2. Logout
        mockMvc.perform(post("/api/v1/auth/logout")
                .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk());

        // 3. Attempt to refresh with revoked token
        Map<String, String> refreshReq = new HashMap<>();
        refreshReq.put("refreshToken", refreshToken);

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(refreshReq)))
                .andExpect(status().isUnauthorized());
    }
}
