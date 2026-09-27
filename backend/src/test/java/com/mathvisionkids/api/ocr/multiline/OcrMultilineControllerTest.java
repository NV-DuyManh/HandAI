package com.mathvisionkids.api.ocr.multiline;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathvisionkids.api.ocr.OcrStorageVerifier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;


import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class OcrMultilineControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OcrMultilineTrialRepository trialRepository;

    @Autowired
    private OcrMultilineLineRepository lineRepository;

    @org.springframework.boot.test.mock.mockito.MockBean
    private OcrStorageVerifier ocrStorageVerifier;

    private OcrMultilineTrial testTrial;
    private OcrMultilineLine testLine1;
    private OcrMultilineLine testLine2;

    @BeforeEach
    void setUp() {
        testTrial = new OcrMultilineTrial();
        testTrial.setSource("CAMERA");
        testTrial.setPageImageObjectKey("ocr-trials/multiline/test_page.jpg");
        testTrial.setPageImageSha256("74378a86c7d3813ff3abf0bc7f93caa4fbdba5c2db4dbf13fefb5d77d0f7870b");
        testTrial.setPageWidth(800);
        testTrial.setPageHeight(600);
        testTrial.setPrivacyConfirmed(true);
        testTrial.setTestData(false);
        testTrial.setDataOrigin("PHYSICAL_USER");
        testTrial.setDomain("HANDWRITING_TEXT");
        testTrial.setStatus("COMPLETED");
        testTrial = trialRepository.save(testTrial);

        testLine1 = new OcrMultilineLine();
        testLine1.setTrial(testTrial);
        testLine1.setLineOrder(1);
        testLine1.setX(50);
        testLine1.setY(100);
        testLine1.setWidth(400);
        testLine1.setHeight(50);
        testLine1.setLineImageObjectKey("ocr-trials/multiline/crops/line_1.jpg");
        testLine1.setLineImageSha256("b3f86880982d5d790d7e75488b4e88144dec485d0f0c5219e230dcba186bdd39");
        testLine1.setPredictedText("hôm nay trời nắng");
        testLine1.setVerdict("UNVERIFIED");
        testLine1.setTrainingEligible(false);
        testLine1 = lineRepository.save(testLine1);

        testLine2 = new OcrMultilineLine();
        testLine2.setTrial(testTrial);
        testLine2.setLineOrder(2);
        testLine2.setX(50);
        testLine2.setY(200);
        testLine2.setWidth(400);
        testLine2.setHeight(50);
        testLine2.setLineImageObjectKey("ocr-trials/multiline/crops/line_2.jpg");
        testLine2.setLineImageSha256("e8024c9000a642dbaeec648947eaa2efa0895f401ee9f4e5b34be8e0fb3115b1");
        testLine2.setPredictedText("Em yêu trường em");
        testLine2.setVerdict("UNVERIFIED");
        testLine2.setTrainingEligible(false);
        testLine2 = lineRepository.save(testLine2);
        org.mockito.Mockito.when(ocrStorageVerifier.verifyStorageIntegrity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any())).thenReturn(true);
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testGetTrialSuccess() throws Exception {
        mockMvc.perform(get("/api/v1/ocr/multiline/trials/" + testTrial.getTrialId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trialId").value(testTrial.getTrialId().toString()))
                .andExpect(jsonPath("$.lines.length()").value(2))
                .andExpect(jsonPath("$.lines[0].predictedText").value("hôm nay trời nắng"))
                .andExpect(jsonPath("$.lines[1].predictedText").value("Em yêu trường em"));
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testDetectLinesPrivacyFalseRejected() throws Exception {
        MockMultipartFile file = new MockMultipartFile("image", "page.jpg", "image/jpeg", new byte[]{1, 2, 3});
        mockMvc.perform(multipart("/api/v1/ocr/multiline/detect")
                        .file(file)
                        .param("privacyConfirmed", "false"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "teacher@test.com", roles = {"TEACHER"})
    void testTeacherRoleAccessForbidden() throws Exception {
        mockMvc.perform(get("/api/v1/ocr/multiline/trials/" + testTrial.getTrialId()))
                .andExpect(status().isForbidden());
    }

    @Test
    void testUnauthenticatedAccessUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/ocr/multiline/trials/" + testTrial.getTrialId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testRecordLineFeedbackCorrectSuccess() throws Exception {
        MultilineFeedbackRequest request = new MultilineFeedbackRequest("CORRECT", null, false);
        mockMvc.perform(post("/api/v1/ocr/multiline/trials/" + testTrial.getTrialId() + "/lines/" + testLine1.getLineId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.verifiedTextRaw").value("hôm nay trời nắng"))
                .andExpect(jsonPath("$.trainingEligible").value(true));

        OcrMultilineLine updated = lineRepository.findById(testLine1.getLineId()).orElseThrow();
        assertEquals("CORRECT", updated.getVerdict());
        assertTrue(updated.isTrainingEligible());
        assertEquals("hôm nay trời nắng", updated.getVerifiedTextRaw());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testRecordLineFeedbackCorrectContradictionFails() throws Exception {
        MultilineFeedbackRequest request = new MultilineFeedbackRequest("CORRECT", "khác hoàn toàn", false);
        mockMvc.perform(post("/api/v1/ocr/multiline/trials/" + testTrial.getTrialId() + "/lines/" + testLine1.getLineId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testRecordLineFeedbackCorrectedPreservesExactRaw() throws Exception {
        String exactRaw = "  Hôm nay trời nắng đẹp  ";
        MultilineFeedbackRequest request = new MultilineFeedbackRequest("CORRECTED", exactRaw, false);
        mockMvc.perform(post("/api/v1/ocr/multiline/trials/" + testTrial.getTrialId() + "/lines/" + testLine1.getLineId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("CORRECTED"))
                .andExpect(jsonPath("$.verifiedTextRaw").value(exactRaw))
                .andExpect(jsonPath("$.verifiedTextNormalized").value("Hôm nay trời nắng đẹp"))
                .andExpect(jsonPath("$.trainingEligible").value(true));

        OcrMultilineLine updated = lineRepository.findById(testLine1.getLineId()).orElseThrow();
        assertEquals(exactRaw, updated.getVerifiedTextRaw());
        assertEquals("Hôm nay trời nắng đẹp", updated.getVerifiedTextNormalized());
        assertTrue(updated.isTrainingEligible());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testRecordLineFeedbackSkipped() throws Exception {
        MultilineFeedbackRequest request = new MultilineFeedbackRequest("SKIPPED", null, false);
        mockMvc.perform(post("/api/v1/ocr/multiline/trials/" + testTrial.getTrialId() + "/lines/" + testLine2.getLineId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("SKIPPED"))
                .andExpect(jsonPath("$.trainingEligible").value(false));

        OcrMultilineLine updated = lineRepository.findById(testLine2.getLineId()).orElseThrow();
        assertEquals("SKIPPED", updated.getVerdict());
        assertFalse(updated.isTrainingEligible());
        assertNull(updated.getVerifiedTextRaw());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testPrivacyFailClosedPreventsLineTrainingEligibility() throws Exception {
        testTrial.setPrivacyConfirmed(false);
        trialRepository.save(testTrial);

        MultilineFeedbackRequest request = new MultilineFeedbackRequest("CORRECT", null, false);
        mockMvc.perform(post("/api/v1/ocr/multiline/trials/" + testTrial.getTrialId() + "/lines/" + testLine1.getLineId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trainingEligible").value(false));

        OcrMultilineLine updated = lineRepository.findById(testLine1.getLineId()).orElseThrow();
        assertFalse(updated.isTrainingEligible());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testTestDataPreventsTrainingEligibility() throws Exception {
        testTrial.setTestData(true);
        trialRepository.save(testTrial);

        MultilineFeedbackRequest request = new MultilineFeedbackRequest("CORRECT", null, false);
        mockMvc.perform(post("/api/v1/ocr/multiline/trials/" + testTrial.getTrialId() + "/lines/" + testLine1.getLineId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trainingEligible").value(false));

        OcrMultilineLine updated = lineRepository.findById(testLine1.getLineId()).orElseThrow();
        assertFalse(updated.isTrainingEligible());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testDomainMustBeHandwritingTextForTrainingEligibility() throws Exception {
        testTrial.setDomain("ARITHMETIC_EXPRESSION");
        trialRepository.save(testTrial);

        MultilineFeedbackRequest request = new MultilineFeedbackRequest("CORRECT", null, false);
        mockMvc.perform(post("/api/v1/ocr/multiline/trials/" + testTrial.getTrialId() + "/lines/" + testLine1.getLineId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trainingEligible").value(false));

        OcrMultilineLine updated = lineRepository.findById(testLine1.getLineId()).orElseThrow();
        assertFalse(updated.isTrainingEligible());
    }

    @Test
    @WithMockUser(username = "student@test.com", roles = {"STUDENT"})
    void testRecordLineFeedbackStorageIntegrityFailureMarksNotEligible() throws Exception {
        org.mockito.Mockito.when(ocrStorageVerifier.verifyStorageIntegrity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any())).thenReturn(false);

        MultilineFeedbackRequest request = new MultilineFeedbackRequest("CORRECT", null, false);
        mockMvc.perform(post("/api/v1/ocr/multiline/trials/" + testTrial.getTrialId() + "/lines/" + testLine1.getLineId() + "/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.trainingEligible").value(false));

        OcrMultilineLine updated = lineRepository.findById(testLine1.getLineId()).orElseThrow();
        assertEquals("CORRECT", updated.getVerdict());
        assertFalse(updated.isTrainingEligible(), "Must be false when storage integrity fails");
    }
}
