package com.mathvisionkids.api.analysis;

import com.mathvisionkids.api.audit.AuditEvent;
import com.mathvisionkids.api.audit.AuditEventRepository;
import com.mathvisionkids.api.submission.Submission;
import com.mathvisionkids.api.submission.SubmissionRepository;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.UUID;


public class StubAiAnalysisGateway implements AiAnalysisGateway {

    private final SubmissionRepository submissionRepository;
    private final AnalysisResultRepository analysisResultRepository;
    private final AuditEventRepository auditEventRepository;
    private final AiJobRepository aiJobRepository;

    public StubAiAnalysisGateway(SubmissionRepository submissionRepository, AnalysisResultRepository analysisResultRepository, AuditEventRepository auditEventRepository, AiJobRepository aiJobRepository) {
        this.submissionRepository = submissionRepository;
        this.analysisResultRepository = analysisResultRepository;
        this.auditEventRepository = auditEventRepository;
        this.aiJobRepository = aiJobRepository;
    }

    @Override
    public void analyze(UUID submissionId) {
        // Create AI Job
        Submission submission = submissionRepository.findById(submissionId).orElseThrow();
        AiJob job = new AiJob();
        job.setSubmission(submission);
        job.setStatus("PENDING");
        aiJobRepository.save(job);
        
        processAnalysis(submissionId);
    }

    @Async
    @Transactional
    public void processAnalysis(UUID submissionId) {
        try {
            // Simulate AI processing delay
            Thread.sleep(2000);

            Submission submission = submissionRepository.findById(submissionId).orElseThrow();
            
            if (!"PROCESSING".equals(submission.getStatus())) {
                return;
            }

            // Create fake analysis result
            AnalysisResult result = new AnalysisResult();
            result.setSubmission(submission);
            result.setStatus("SUCCESS");
            
            // Example stubbed outcome - normally depends on fixture, but we'll default to FEEDBACK_READY for simple flow
            result.setConfidence(0.95);
            result.setGradeProposal(new HashMap<>() {{
                put("score", 95);
                put("isOfficial", false);
            }});
            result.setModelVersion("stub-v1");
            
            analysisResultRepository.save(result);
            
            aiJobRepository.findBySubmission_SubmissionId(submissionId).stream().findFirst().ifPresent(j -> {
                j.setStatus("COMPLETED");
                aiJobRepository.save(j);
            });

            submission.setStatus("PROPOSED_GRADE"); // Teacher batch grading: PROPOSED_GRADE. Student tutoring: FEEDBACK_READY.
            submissionRepository.save(submission);

            AuditEvent auditEvent = new AuditEvent();
            auditEvent.setSubmission(submission);
            auditEvent.setEventType("AI_RESULT_CREATED");
            auditEventRepository.save(auditEvent);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
