package com.mathvisionkids.api.config;

import com.mathvisionkids.api.admin.AdminService;
import com.mathvisionkids.api.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class GlobalExceptionHandlerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminService adminService;

    @Test
    @WithMockUser(roles = "ADMIN")
    public void testUnexpectedExceptionHidesSensitiveDetailsAndStackTraces() throws Exception {
        String sensitiveLeak = "NullPointerException at org.hibernate.SQL: SELECT * FROM users at org.springframework.orm "
                + "in file E:/MathVisionKid/services/business-api/AdminService.java:42 java.lang.NullPointerException with JDBC secret password";

        when(adminService.getDashboard()).thenThrow(new NullPointerException(sensitiveLeak));

        MvcResult result = mockMvc.perform(get("/api/v1/admin/dashboard"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.error.message").value("An unexpected error occurred"))
                .andExpect(jsonPath("$.error.requestId").isString())
                .andReturn();

        String body = result.getResponse().getContentAsString();

        // Strict verification: Client response must NOT contain any internal stack trace or environment details
        assertFalse(body.contains("stackTrace"), "Must not expose stackTrace field in response");
        assertFalse(body.contains("NullPointerException"), "Must not expose exception class name");
        assertFalse(body.contains("org.springframework"), "Must not expose Spring internals");
        assertFalse(body.contains("org.hibernate"), "Must not expose Hibernate internals");
        assertFalse(body.contains("java.lang."), "Must not expose Java package internals");
        assertFalse(body.contains(".java:"), "Must not expose Java source line numbers");
        assertFalse(body.contains("MathVisionKid"), "Must not expose local repository path");
        assertFalse(body.contains("SQL"), "Must not expose SQL statements");
        assertFalse(body.contains("JDBC"), "Must not expose JDBC internals");
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    public void testDomainValidationExceptionPreservesSafeMessage() throws Exception {
        when(adminService.getDashboard()).thenThrow(
                new ApiException("VALIDATION_ERROR", "Student outside classroom for index 0", HttpStatus.BAD_REQUEST));

        mockMvc.perform(get("/api/v1/admin/dashboard"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.message").value("Student outside classroom for index 0"))
                .andExpect(jsonPath("$.error.requestId").isString());
    }
}
