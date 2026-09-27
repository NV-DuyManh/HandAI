package com.mathvisionkids.api.analysis;

import com.mathvisionkids.api.submission.Submission;
import com.mathvisionkids.api.submission.SubmissionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/internal/v1/ai/jobs")
public class InternalAiCallbackController {

    private final AiJobRepository aiJobRepository;
    private final SubmissionRepository submissionRepository;
    private final AnalysisResultRepository analysisResultRepository;
    private final String internalApiKey;

    public InternalAiCallbackController(
            AiJobRepository aiJobRepository,
            SubmissionRepository submissionRepository,
            AnalysisResultRepository analysisResultRepository,
            @org.springframework.beans.factory.annotation.Value("${ai.callback.api-key:secret-key-default}") String internalApiKey) {
        this.aiJobRepository = aiJobRepository;
        this.submissionRepository = submissionRepository;
        this.analysisResultRepository = analysisResultRepository;
        this.internalApiKey = internalApiKey;
    }

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(InternalAiCallbackController.class);

    @PostMapping("/{jobId}/callback")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Void> aiJobCompleted(
            @PathVariable("jobId") UUID jobId,
            @RequestHeader(value = "X-Internal-API-Key", required = false) String apiKey,
            @RequestBody AiCallbackRequest request) {

        // ── Authentication ─────────────────────────────────────────────────
        if (apiKey == null || !apiKey.equals(internalApiKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // ── Job lookup ─────────────────────────────────────────────────────
        AiJob job = aiJobRepository.findById(jobId)
                .orElseThrow(() -> new com.mathvisionkids.api.common.ApiException(
                        "NOT_FOUND", "Job not found", HttpStatus.NOT_FOUND));

        try {
            // ── Idempotency: ignore repeat callbacks for completed jobs ─────────
            if ("COMPLETED".equals(job.getStatus())) {
                return ResponseEntity.ok().build();
            }

            // ── Mark job complete ──────────────────────────────────────────────
            job.setStatus("COMPLETED");
            job.setCompletedAt(Instant.now());
            aiJobRepository.save(job);

            Submission submission = job.getSubmission();

            if (!"PROCESSING".equals(submission.getStatus())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).build();
            }

            // ── Persist AnalysisResult ─────────────────────────────────────────
            if (!analysisResultRepository.existsBySubmission_SubmissionId(submission.getSubmissionId())) {
                AnalysisResult result = new AnalysisResult();
                result.setSubmission(submission);
                result.setStatus(request.getStatus());

                if (request.getGradeProposal() != null) {
                    result.setGradeProposal(request.getGradeProposal());
                }
                if (request.getEvidence() != null && !request.getEvidence().isEmpty()) {
                    result.setEvidence(java.util.Collections.singletonMap("items", request.getEvidence()));
                }
                if (request.getStudentFeedback() != null) {
                    result.setStudentFeedback(request.getStudentFeedback());
                }
                Map<String, Object> reviewReasons = request.getConfidenceBundle() != null
                        ? new java.util.HashMap<>(request.getConfidenceBundle())
                        : new java.util.HashMap<>();
                if (request.getReasonCode() != null) {
                    reviewReasons.put("reasonCode", request.getReasonCode());
                }
                if (request.getDiagnostics() != null) {
                    reviewReasons.put("diagnostics", request.getDiagnostics());
                }
                if (!reviewReasons.isEmpty()) {
                    result.setReviewReasons(reviewReasons);
                }
                if (request.getRecognizedExercise() != null) {
                    result.setRecognizedExercise(
                            java.util.Collections.singletonMap("expression", request.getRecognizedExercise()));
                }
                if (request.getModelVersion() != null && !request.getModelVersion().isBlank()) {
                    result.setModelVersion(request.getModelVersion());
                } else {
                    result.setModelVersion("fixture-v1");
                }

                analysisResultRepository.save(result);
            }

            // ── Update submission status based on AI result status ─────────────
            String newStatus = mapAiStatusToSubmissionStatus(request.getStatus());
            submission.setStatus(newStatus);
            submissionRepository.save(submission);

            return ResponseEntity.ok().build();
        } catch (Exception e) {
            logger.error("Error handling AI callback for jobId: {}", jobId, e);
            throw e;
        }
    }

    /**
     * Maps AI pipeline terminal status to Submission business status.
     *
     * PROPOSED_GRADE   → PROPOSED_GRADE  (teacher grading complete, awaiting decision)
     * FEEDBACK_READY   → FEEDBACK_READY  (student feedback generated)
     * REVIEW_REQUIRED  → REVIEW_REQUIRED (insufficient evidence, needs manual review)
     * NEEDS_CONFIRMATION → NEEDS_CONFIRMATION (uncertainty, prompts confirmation/retake)
     * NEEDS_RETAKE     → NEEDS_RETAKE    (image quality insufficient)
     * CROP_REQUIRED    → NEEDS_RETAKE    (image crop insufficient)
     * OUT_OF_SCOPE     → REVIEW_REQUIRED (unsupported exercise, teacher reviews)
     * MODEL_NOT_AVAILABLE → REVIEW_REQUIRED
     * anything else   → REVIEW_REQUIRED
     */
    private String mapAiStatusToSubmissionStatus(String aiStatus) {
        if (aiStatus == null) return "REVIEW_REQUIRED";
        return switch (aiStatus) {
            case "PROPOSED_GRADE",
                 "COMPLETED"         -> "PROPOSED_GRADE";
            case "FEEDBACK_READY"    -> "FEEDBACK_READY";
            case "REVIEW_REQUIRED"   -> "REVIEW_REQUIRED";
            case "NEEDS_RETAKE",
                 "CROP_REQUIRED"     -> "NEEDS_RETAKE";
            case "NEEDS_CONFIRMATION" -> "NEEDS_CONFIRMATION";
            default                  -> "REVIEW_REQUIRED";
        };
    }
}
