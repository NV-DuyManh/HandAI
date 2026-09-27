package com.mathvisionkids.api.analysis;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathvisionkids.api.submission.Submission;
import com.mathvisionkids.api.submission.SubmissionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.util.Map;
import java.util.HashMap;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"ai.callback.api-key=test-secret-key"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
public class InternalAiCallbackControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AiJobRepository aiJobRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private AnalysisResultRepository analysisResultRepository;

    private AiJob testJob;
    private Submission testSubmission;

    @BeforeEach
    public void setup() {

        testSubmission = new Submission();
        testSubmission.setStatus("PROCESSING");
        submissionRepository.save(testSubmission);

        testJob = new AiJob();
        testJob.setSubmission(testSubmission);
        testJob.setStatus("PENDING");
        aiJobRepository.save(testJob);
    }

    @Test
    public void testValidCallback() throws Exception {
        String url = "/internal/v1/ai/jobs/" + testJob.getJobId() + "/callback";

        AiCallbackRequest payload = new AiCallbackRequest();
        payload.setStatus("COMPLETED");

        mockMvc.perform(post(url)
                .header("X-Internal-API-Key", "test-secret-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk());
                
        AiJob updatedJob = aiJobRepository.findById(testJob.getJobId()).orElseThrow();
        assert "COMPLETED".equals(updatedJob.getStatus());
        
        Submission updatedSubmission = submissionRepository.findById(testSubmission.getSubmissionId()).orElseThrow();
        assert "PROPOSED_GRADE".equals(updatedSubmission.getStatus());
    }

    @Test
    public void testCallbackWithReasonCode() throws Exception {
        String url = "/internal/v1/ai/jobs/" + testJob.getJobId() + "/callback";

        AiCallbackRequest payload = new AiCallbackRequest();
        payload.setStatus("REVIEW_REQUIRED");
        payload.setReasonCode("OCR_LOW_CONFIDENCE");

        mockMvc.perform(post(url)
                .header("X-Internal-API-Key", "test-secret-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk());

        Submission updatedSubmission = submissionRepository.findById(testSubmission.getSubmissionId()).orElseThrow();
        assert "REVIEW_REQUIRED".equals(updatedSubmission.getStatus());

        AnalysisResult ar = analysisResultRepository.findBySubmission_SubmissionId(testSubmission.getSubmissionId()).orElseThrow();
        assert ar.getReviewReasons() != null;
        assert "OCR_LOW_CONFIDENCE".equals(ar.getReviewReasons().get("reasonCode"));
    }

    @Test
    public void testCallbackWithDiagnostics() throws Exception {
        String url = "/internal/v1/ai/jobs/" + testJob.getJobId() + "/callback";

        AiCallbackRequest payload = new AiCallbackRequest();
        payload.setStatus("REVIEW_REQUIRED");
        payload.setReasonCode("DETECTOR_NO_TOKENS");
        Map<String, Object> diags = new HashMap<>();
        diags.put("detectorInvoked", true);
        diags.put("detectorTokenCount", 0);
        diags.put("qualityFlags", java.util.List.of("SLIGHT_BLUR"));
        payload.setDiagnostics(diags);

        mockMvc.perform(post(url)
                .header("X-Internal-API-Key", "test-secret-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk());

        AnalysisResult ar = analysisResultRepository.findBySubmission_SubmissionId(testSubmission.getSubmissionId()).orElseThrow();
        assert ar.getReviewReasons() != null;
        assert "DETECTOR_NO_TOKENS".equals(ar.getReviewReasons().get("reasonCode"));
        @SuppressWarnings("unchecked")
        Map<String, Object> savedDiags = (Map<String, Object>) ar.getReviewReasons().get("diagnostics");
        assert savedDiags != null;
        assert Boolean.TRUE.equals(savedDiags.get("detectorInvoked"));
        assert Integer.valueOf(0).equals(savedDiags.get("detectorTokenCount"));
    }

    @Test
    public void testMissingApiKey() throws Exception {
        AiCallbackRequest payload = new AiCallbackRequest();
        payload.setStatus("COMPLETED");

        mockMvc.perform(post("/internal/v1/ai/jobs/" + testJob.getJobId() + "/callback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void testInvalidApiKey() throws Exception {
        AiCallbackRequest payload = new AiCallbackRequest();
        payload.setStatus("COMPLETED");

        mockMvc.perform(post("/internal/v1/ai/jobs/" + testJob.getJobId() + "/callback")
                .header("X-Internal-API-Key", "wrong-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void testIdempotency() throws Exception {
        // Set to COMPLETED manually
        testJob.setStatus("COMPLETED");
        aiJobRepository.save(testJob);
        
        // This should normally conflict because submission is PROCESSING, but since job is COMPLETED, 
        // it returns OK immediately and doesn't try to transition.
        AiCallbackRequest payload = new AiCallbackRequest();
        payload.setStatus("COMPLETED");

        mockMvc.perform(post("/internal/v1/ai/jobs/" + testJob.getJobId() + "/callback")
                .header("X-Internal-API-Key", "test-secret-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk());
    }

    @Test
    public void testNeedsConfirmationCallbackTransitionsSubmissionToNeedsConfirmation() throws Exception {
        AiCallbackRequest payload = new AiCallbackRequest();
        payload.setStatus("NEEDS_CONFIRMATION");

        mockMvc.perform(post("/internal/v1/ai/jobs/" + testJob.getJobId() + "/callback")
                .header("X-Internal-API-Key", "test-secret-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk());

        AiJob updatedJob = aiJobRepository.findById(testJob.getJobId()).orElseThrow();
        assert "COMPLETED".equals(updatedJob.getStatus());

        Submission updatedSubmission = submissionRepository.findById(testSubmission.getSubmissionId()).orElseThrow();
        assert "NEEDS_CONFIRMATION".equals(updatedSubmission.getStatus());
    }

    @Test
    public void testReviewRequiredCallbackTransitionsSubmissionToReviewRequired() throws Exception {
        AiCallbackRequest payload = new AiCallbackRequest();
        payload.setStatus("REVIEW_REQUIRED");

        mockMvc.perform(post("/internal/v1/ai/jobs/" + testJob.getJobId() + "/callback")
                .header("X-Internal-API-Key", "test-secret-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk());

        AiJob updatedJob = aiJobRepository.findById(testJob.getJobId()).orElseThrow();
        assert "COMPLETED".equals(updatedJob.getStatus());

        Submission updatedSubmission = submissionRepository.findById(testSubmission.getSubmissionId()).orElseThrow();
        assert "REVIEW_REQUIRED".equals(updatedSubmission.getStatus());
    }

    @Test
    public void testCallbackWithModelProvenance() throws Exception {
        String url = "/internal/v1/ai/jobs/" + testJob.getJobId() + "/callback";

        AiCallbackRequest payload = new AiCallbackRequest();
        payload.setStatus("FEEDBACK_READY");
        payload.setModelVersion("MODEL:MathVision-Kids-Detection:1.0.0:e78f8fa5");

        mockMvc.perform(post(url)
                .header("X-Internal-API-Key", "test-secret-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk());

        AnalysisResult ar = analysisResultRepository.findBySubmission_SubmissionId(testSubmission.getSubmissionId()).orElseThrow();
        assert "MODEL:MathVision-Kids-Detection:1.0.0:e78f8fa5".equals(ar.getModelVersion());
    }
}
