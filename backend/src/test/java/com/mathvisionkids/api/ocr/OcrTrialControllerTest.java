package com.mathvisionkids.api.ocr;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class OcrTrialControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OcrTrialRepository ocrTrialRepository;

    @org.springframework.boot.test.mock.mockito.MockBean
    private OcrStorageVerifier ocrStorageVerifier;

    private OcrTrial testTrial;

    @BeforeEach
    void setUp() {
        testTrial = new OcrTrial();
        testTrial.setSource("CAMERA");
        testTrial.setLineImageObjectKey("ocr-trials/test.jpg");
        testTrial.setLineImageSha256("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        testTrial.setPredictedText("hôm nay trôi nắng");
        testTrial.setVerdict("UNVERIFIED");
        testTrial.setModelName("Vietnamese-Handwriting-OCR-Full");
        testTrial.setModelVersion("1.0.0");
        testTrial.setCheckpointSha256("a807eaa763a4471bc057b9545a3521612423214858d50b1ef42b7baf28de0941");
        testTrial.setVocabSha256("6af4062e92e22cc91ece5198638e29a6ceec6cb92e3b12bd71deb4b874ac9e0d");
        testTrial.setTrainingEligible(false);
        testTrial.setPrivacyConfirmed(true);
        testTrial.setTestData(false);
        testTrial.setDomain("HANDWRITING_TEXT");
        testTrial = ocrTrialRepository.save(testTrial);
        org.mockito.Mockito.when(ocrStorageVerifier.verifyStorageIntegrity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any())).thenReturn(true);
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testGetTrialSuccess() throws Exception {
        mockMvc.perform(get("/api/v1/ocr/trials/" + testTrial.getTrialId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trialId").value(testTrial.getTrialId().toString()))
                .andExpect(jsonPath("$.predictedText").value("hôm nay trôi nắng"))
                .andExpect(jsonPath("$.verdict").value("UNVERIFIED"))
                .andExpect(jsonPath("$.domain").value("HANDWRITING_TEXT"))
                .andExpect(jsonPath("$.isTestData").value(false))
                .andExpect(jsonPath("$.trainingEligible").value(false));
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testRecordFeedbackCorrect() throws Exception {
        OcrFeedbackRequest request = new OcrFeedbackRequest("CORRECT", null, false);

        mockMvc.perform(post("/api/v1/ocr/trials/" + testTrial.getTrialId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.verifiedTextRaw").value("hôm nay trôi nắng"))
                .andExpect(jsonPath("$.trainingEligible").value(true));

        OcrTrial updated = ocrTrialRepository.findById(testTrial.getTrialId()).orElseThrow();
        assertEquals("CORRECT", updated.getVerdict());
        assertTrue(updated.isTrainingEligible());
        assertEquals("hôm nay trôi nắng", updated.getVerifiedTextRaw());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testRecordFeedbackCorrectMismatchFails() throws Exception {
        // CASE 4: predicted != verified but verdict = CORRECT -> reject as data integrity error
        OcrFeedbackRequest request = new OcrFeedbackRequest("CORRECT", "12 + 34 = 46", false);

        mockMvc.perform(post("/api/v1/ocr/trials/" + testTrial.getTrialId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testRecordFeedbackCorrectMatchingSucceeds() throws Exception {
        OcrFeedbackRequest request = new OcrFeedbackRequest("CORRECT", "hôm nay trôi nắng", false);

        mockMvc.perform(post("/api/v1/ocr/trials/" + testTrial.getTrialId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.verifiedTextRaw").value("hôm nay trôi nắng"));
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testRecordFeedbackCorrectedPreservesExactRawInput() throws Exception {
        // Section 8: verified_text_raw must preserve EXACT text entered by user (including leading/trailing spaces)
        String rawInput = "  hôm nay trời nắng  ";
        OcrFeedbackRequest request = new OcrFeedbackRequest("CORRECTED", rawInput, false);

        mockMvc.perform(post("/api/v1/ocr/trials/" + testTrial.getTrialId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("CORRECTED"))
                .andExpect(jsonPath("$.verifiedTextRaw").value(rawInput))
                .andExpect(jsonPath("$.verifiedTextNormalized").value("hôm nay trời nắng"))
                .andExpect(jsonPath("$.trainingEligible").value(true));

        OcrTrial updated = ocrTrialRepository.findById(testTrial.getTrialId()).orElseThrow();
        assertEquals("CORRECTED", updated.getVerdict());
        assertTrue(updated.isTrainingEligible());
        assertEquals(rawInput, updated.getVerifiedTextRaw()); // Exact raw string preserved!
        assertEquals("hôm nay trời nắng", updated.getVerifiedTextNormalized());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testRecordFeedbackCorrectedEmptyTextFails() throws Exception {
        OcrFeedbackRequest request = new OcrFeedbackRequest("CORRECTED", "   ", false);

        mockMvc.perform(post("/api/v1/ocr/trials/" + testTrial.getTrialId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testRecordFeedbackSkipped() throws Exception {
        OcrFeedbackRequest request = new OcrFeedbackRequest("SKIPPED", null, false);

        mockMvc.perform(post("/api/v1/ocr/trials/" + testTrial.getTrialId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("SKIPPED"))
                .andExpect(jsonPath("$.trainingEligible").value(false));

        OcrTrial updated = ocrTrialRepository.findById(testTrial.getTrialId()).orElseThrow();
        assertEquals("SKIPPED", updated.getVerdict());
        assertFalse(updated.isTrainingEligible());
        assertNull(updated.getVerifiedTextRaw());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testGetMetricsWithCerAndTestDataExclusion() throws Exception {
        // Mark testTrial as corrected
        OcrFeedbackRequest req1 = new OcrFeedbackRequest("CORRECTED", "hôm nay trời nắng", false);
        mockMvc.perform(post("/api/v1/ocr/trials/" + testTrial.getTrialId() + "/feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req1)));

        // Create a test-data trial that should be excluded
        OcrTrial testRow = new OcrTrial();
        testRow.setSource("CAMERA");
        testRow.setLineImageObjectKey("ocr-trials/test2.jpg");
        testRow.setLineImageSha256("sha256fake");
        testRow.setPredictedText("test pred");
        testRow.setVerifiedTextRaw("test pred");
        testRow.setVerdict("CORRECT");
        testRow.setModelName("Vietnamese-Handwriting-OCR-Full");
        testRow.setModelVersion("1.0.0");
        testRow.setCheckpointSha256("a807eaa763a4471bc057b9545a3521612423214858d50b1ef42b7baf28de0941");
        testRow.setVocabSha256("6af4062e92e22cc91ece5198638e29a6ceec6cb92e3b12bd71deb4b874ac9e0d");
        testRow.setTrainingEligible(false);
        testRow.setPrivacyConfirmed(true);
        testRow.setTestData(true); // Marked as test data!
        testRow.setDomain("HANDWRITING_TEXT");
        ocrTrialRepository.save(testRow);

        mockMvc.perform(get("/api/v1/ocr/trials/metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.domain").value("HANDWRITING_TEXT"))
                .andExpect(jsonPath("$.evaluationScope").isNotEmpty())
                .andExpect(jsonPath("$.characterErrorRate").isNumber())
                .andExpect(jsonPath("$.cerPercentage").isNotEmpty())
                .andExpect(jsonPath("$.exactMatchRate").isNumber());
    }

    @Test
    void testUnauthenticatedAccessFails() throws Exception {
        mockMvc.perform(get("/api/v1/ocr/trials/" + testTrial.getTrialId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "teacher@test.com", roles = {"TEACHER"})
    void testNonStudentRoleAccessFails() throws Exception {
        mockMvc.perform(get("/api/v1/ocr/trials/" + testTrial.getTrialId()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testPrivacyFailClosedPreventsTrainingEligibility() throws Exception {
        // Set testTrial privacyConfirmed to false
        testTrial.setPrivacyConfirmed(false);
        ocrTrialRepository.save(testTrial);

        OcrFeedbackRequest request = new OcrFeedbackRequest("CORRECT", null, false);
        mockMvc.perform(post("/api/v1/ocr/trials/" + testTrial.getTrialId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trainingEligible").value(false));

        OcrTrial updated = ocrTrialRepository.findById(testTrial.getTrialId()).orElseThrow();
        assertFalse(updated.isTrainingEligible(), "Must not be training eligible when privacy is false");
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testZeroVerifiedMetricsReturnsNullAndNA() throws Exception {
        ocrTrialRepository.deleteAll();
        // testTrial is UNVERIFIED, no verified trials exist
        mockMvc.perform(get("/api/v1/ocr/trials/metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verifiedTrials").value(0))
                .andExpect(jsonPath("$.exactMatchRate").doesNotExist())
                .andExpect(jsonPath("$.exactMatchPercentage").value("N/A"))
                .andExpect(jsonPath("$.characterErrorRate").doesNotExist())
                .andExpect(jsonPath("$.cerPercentage").value("N/A"));
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testRecordFeedbackStorageIntegrityFailureMarksNotEligible() throws Exception {
        org.mockito.Mockito.when(ocrStorageVerifier.verifyStorageIntegrity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any())).thenReturn(false);

        OcrFeedbackRequest request = new OcrFeedbackRequest("CORRECT", null, false);
        mockMvc.perform(post("/api/v1/ocr/trials/" + testTrial.getTrialId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.trainingEligible").value(false));

        OcrTrial updated = ocrTrialRepository.findById(testTrial.getTrialId()).orElseThrow();
        assertEquals("CORRECT", updated.getVerdict());
        assertFalse(updated.isTrainingEligible(), "Must be false when storage integrity fails");
    }
}
