package com.mathvisionkids.api.ocr.multiline;

import com.mathvisionkids.api.ocr.OcrStorageVerifier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class HandAiOcrControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OcrMultilineTrialRepository trialRepository;

    @MockBean
    private OcrStorageVerifier ocrStorageVerifier;

    @MockBean
    private OcrMultilineService multilineService;

    private OcrMultilineTrial testTrial;

    @BeforeEach
    void setUp() {
        when(ocrStorageVerifier.verifyStorageIntegrity(any(), any())).thenReturn(true);

        testTrial = new OcrMultilineTrial();
        testTrial.setSource("CAMERA");
        testTrial.setPageImageObjectKey("ocr-trials/multiline/test_handai_page.jpg");
        testTrial.setPageImageSha256("74378a86c7d3813ff3abf0bc7f93caa4fbdba5c2db4dbf13fefb5d77d0f7870b");
        testTrial.setPageWidth(800);
        testTrial.setPageHeight(600);
        testTrial.setPrivacyConfirmed(true);
        testTrial.setTestData(true);
        testTrial.setDataOrigin("HAND_AI_DEMO");
        testTrial.setDomain("HANDWRITING_TEXT");
        testTrial.setStatus("COMPLETED");
        testTrial = trialRepository.save(testTrial);
    }

    @Test
    void testGuestHealthGetPermitAllWithoutAuth() throws Exception {
        // GET /api/v1/handai/health -> HTTP 200 without JWT
        mockMvc.perform(get("/api/v1/handai/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.mode").value("HAND_AI_GUEST"))
                .andExpect(jsonPath("$.guestOcrEnabled").value(true));
    }

    @Test
    void testGuestHealthPostPermitAllWithoutAuth() throws Exception {
        // POST /api/v1/handai/health -> HTTP 200 without JWT
        mockMvc.perform(post("/api/v1/handai/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.mode").value("HAND_AI_GUEST"))
                .andExpect(jsonPath("$.guestOcrEnabled").value(true));
    }

    @Test
    void testGuestDetectLinesPermitAllWithoutAuth() throws Exception {
        // Unauthenticated guest request to /api/v1/handai/ocr/multiline/detect
        MultilineDetectResponse mockDetectResponse = MultilineDetectResponse.builder()
                .width(800)
                .height(600)
                .lines(List.of(
                        new LineBoxDto("line_1", 10, 20, 300, 40, 1, "test 1"),
                        new LineBoxDto("line_2", 10, 70, 300, 40, 2, "test 2")
                ))
                .detectorVersion("v2.1_morphology")
                .build();
        when(multilineService.detectLines(any(), any(), any(), any())).thenReturn(mockDetectResponse);

        MockMultipartFile file = new MockMultipartFile("image", "notebook.jpg", "image/jpeg", new byte[]{1, 2, 3});
        mockMvc.perform(multipart("/api/v1/handai/ocr/multiline/detect")
                        .file(file)
                        .param("privacyConfirmed", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lines.length()").value(2))
                .andExpect(jsonPath("$.width").value(800))
                .andExpect(jsonPath("$.height").value(600));
    }

    @Test
    void testGuestGetTrialPermitAllWithoutAuth() throws Exception {
        // Unauthenticated guest request to /api/v1/handai/ocr/multiline/trials/{id}
        MultilineTrialResponse mockTrialResponse = MultilineTrialResponse.builder()
                .trialId(testTrial.getTrialId())
                .status("COMPLETED")
                .pageWidth(800)
                .pageHeight(600)
                .build();
        when(multilineService.getTrial(eq(testTrial.getTrialId()))).thenReturn(mockTrialResponse);

        mockMvc.perform(get("/api/v1/handai/ocr/multiline/trials/" + testTrial.getTrialId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trialId").value(testTrial.getTrialId().toString()));
    }

    @Test
    void testMathVisionDetectEndpointStillRequiresAuth() throws Exception {
        // MathVision endpoint: POST /api/v1/ocr/multiline/detect must return 401 without JWT
        MockMultipartFile file = new MockMultipartFile("image", "notebook.jpg", "image/jpeg", new byte[]{1, 2, 3});
        mockMvc.perform(multipart("/api/v1/ocr/multiline/detect")
                        .file(file)
                        .param("privacyConfirmed", "true"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void testMathVisionTrialEndpointStillRequiresAuth() throws Exception {
        // MathVision endpoint: GET /api/v1/ocr/multiline/trials/{id} must return 401 without JWT
        mockMvc.perform(get("/api/v1/ocr/multiline/trials/" + testTrial.getTrialId()))
                .andExpect(status().isUnauthorized());
    }
}
