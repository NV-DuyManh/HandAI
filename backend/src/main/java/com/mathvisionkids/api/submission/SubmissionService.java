package com.mathvisionkids.api.submission;

import com.mathvisionkids.api.analysis.AiAnalysisGateway;
import com.mathvisionkids.api.audit.AuditEvent;
import com.mathvisionkids.api.audit.AuditEventRepository;
import com.mathvisionkids.api.common.ApiException;
import com.mathvisionkids.api.storage.ObjectStorageService;
import com.mathvisionkids.api.user.Student;
import com.mathvisionkids.api.user.StudentRepository;
import com.mathvisionkids.api.analysis.TeacherDecision;
import com.mathvisionkids.api.analysis.TeacherDecisionRepository;
import com.mathvisionkids.api.user.Teacher;
import com.mathvisionkids.api.user.TeacherRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@Service
public class SubmissionService {
    private final SubmissionRepository submissionRepository;
    private final SubmissionImageRepository submissionImageRepository;
    private final ObjectStorageService objectStorageService;
    private final AiAnalysisGateway aiAnalysisGateway;
    private final AuditEventRepository auditEventRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final TeacherDecisionRepository teacherDecisionRepository;

    public SubmissionService(SubmissionRepository submissionRepository,
                             SubmissionImageRepository submissionImageRepository,
                             ObjectStorageService objectStorageService,
                             AiAnalysisGateway aiAnalysisGateway,
                             AuditEventRepository auditEventRepository,
                             StudentRepository studentRepository,
                             TeacherRepository teacherRepository,
                             TeacherDecisionRepository teacherDecisionRepository) {
        this.submissionRepository = submissionRepository;
        this.submissionImageRepository = submissionImageRepository;
        this.objectStorageService = objectStorageService;
        this.aiAnalysisGateway = aiAnalysisGateway;
        this.auditEventRepository = auditEventRepository;
        this.studentRepository = studentRepository;
        this.teacherRepository = teacherRepository;
        this.teacherDecisionRepository = teacherDecisionRepository;
    }

    @Transactional
    public SubmissionResponse createStudentSubmission(String email, MultipartFile file, String source) {
        Student student = studentRepository.findByEmail(email)
                .map(u -> studentRepository.findById(u.getId()).orElse(null))
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Student not found", HttpStatus.NOT_FOUND));
        
        if (file == null || file.isEmpty()) {
            throw new ApiException("VALIDATION_ERROR", "Image is missing", HttpStatus.BAD_REQUEST);
        }

        String contentType = file.getContentType();
        if (contentType == null || (!contentType.equals("image/jpeg") && !contentType.equals("image/png") && !contentType.equals("image/webp"))) {
            throw new ApiException("UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG, and WebP are supported", HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }

        try {
            String filePath = objectStorageService.store(file, "submissions");

            Submission submission = new Submission();
            submission.setStudent(student);
            submission.setStatus("IMAGE_UPLOADED");
            submissionRepository.save(submission);

            SubmissionImage image = new SubmissionImage();
            image.setSubmission(submission);
            image.setFilePath(filePath);
            image.setContentType(contentType);
            image.setFileSize(file.getSize());
            image.setSource(source);
            submissionImageRepository.save(image);

            AuditEvent auditEvent = new AuditEvent();
            auditEvent.setSubmission(submission);
            auditEvent.setUser(student);
            auditEvent.setEventType("SUBMISSION_CREATED");
            auditEventRepository.save(auditEvent);

            // Transition to PROCESSING
            submission.setStatus("PROCESSING");
            submissionRepository.save(submission);

            AuditEvent auditEvent2 = new AuditEvent();
            auditEvent2.setSubmission(submission);
            auditEvent2.setUser(student);
            auditEvent2.setEventType("AI_PROCESSING_STARTED");
            final UUID studentSubmissionId = submission.getSubmissionId();
            if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
                org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            java.util.concurrent.CompletableFuture.runAsync(() -> {
                                try {
                                    aiAnalysisGateway.analyze(studentSubmissionId);
                                } catch (Exception e) {
                                    org.slf4j.LoggerFactory.getLogger(SubmissionService.class)
                                            .error("Error analyzing student submissionId: {} in async trigger", studentSubmissionId, e);
                                }
                            });
                        }
                    }
                );
            } else {
                aiAnalysisGateway.analyze(studentSubmissionId);
            }

            SubmissionResponse response = new SubmissionResponse();
            response.setSubmissionId(submission.getSubmissionId());
            response.setStatus(submission.getStatus());
            response.setCreatedAt(submission.getCreatedAt());
            return response;
        } catch (IOException e) {
            throw new ApiException("INTERNAL_ERROR", "Failed to store image", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Transactional(readOnly = true)
    public Submission getStudentSubmission(String email, UUID submissionId) {
        Student student = studentRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Student not found", HttpStatus.NOT_FOUND));
        
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Submission not found", HttpStatus.NOT_FOUND));

        if (submission.getStudent() == null || !submission.getStudent().getId().equals(student.getId())) {
            throw new ApiException("FORBIDDEN", "Not authorized", HttpStatus.FORBIDDEN);
        }
        
        return submission;
    }

    @Transactional
    public void confirmToken(String email, UUID submissionId, String tokenClass, String newClass) {
        Submission submission = getStudentSubmission(email, submissionId);
        // Business logic to update token confirmation. For Phase 3.1 MVP just state change.
        if (!"FEEDBACK_READY".equals(submission.getStatus()) && !"NEEDS_CONFIRMATION".equals(submission.getStatus())) {
            throw new ApiException("INVALID_STATE", "Submission not in valid state for confirmation", HttpStatus.BAD_REQUEST);
        }
        // Save logic would go here
    }

    private static final java.util.Set<String> APPROVABLE_STATES = java.util.Set.of(
            "PROPOSED_GRADE", "REVIEW_REQUIRED", "FEEDBACK_READY"
    );

    private static final java.util.Set<String> RETRYABLE_STATES = java.util.Set.of(
            "NEEDS_RETAKE", "CROP_REQUIRED", "NEEDS_CONFIRMATION", "FEEDBACK_READY"
    );

    @Transactional
    public void retrySubmission(String email, UUID submissionId, MultipartFile file, String source) {
        Submission submission = getStudentSubmission(email, submissionId);
        if (!RETRYABLE_STATES.contains(submission.getStatus())) {
            throw new ApiException("INVALID_STATE", "Submission cannot be retried at this state", HttpStatus.BAD_REQUEST);
        }
        
        if (file == null || file.isEmpty()) {
            throw new ApiException("VALIDATION_ERROR", "Image is missing", HttpStatus.BAD_REQUEST);
        }

        String contentType = file.getContentType();
        if (contentType == null || (!contentType.equals("image/jpeg") && !contentType.equals("image/png") && !contentType.equals("image/webp"))) {
            throw new ApiException("UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG, and WebP are supported", HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }

        String filePath = null;
        try {
            filePath = objectStorageService.store(file, "submissions");

            SubmissionImage image = new SubmissionImage();
            image.setSubmission(submission);
            image.setFilePath(filePath);
            image.setContentType(contentType);
            image.setFileSize(file.getSize());
            image.setSource(source);
            submissionImageRepository.save(image);
        } catch (Exception e) {
            e.printStackTrace();
            if (filePath != null) {
                try {
                    objectStorageService.delete(filePath);
                } catch (IOException ignored) {}
            }
            throw new ApiException("INTERNAL_ERROR", "Failed to store retry image", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        submission.setStatus("PROCESSING");
        submissionRepository.save(submission);
        
        AuditEvent auditEvent = new AuditEvent();
        auditEvent.setSubmission(submission);
        auditEvent.setUser(studentRepository.findByEmail(email).orElseThrow());
        auditEvent.setEventType("RETRY_REQUESTED");
        auditEventRepository.save(auditEvent);

        AuditEvent auditEvent1 = new AuditEvent();
        auditEvent1.setSubmission(submission);
        auditEvent1.setUser(studentRepository.findByEmail(email).orElseThrow());
        auditEvent1.setEventType("IMAGE_UPLOADED");
        auditEventRepository.save(auditEvent1);

        AuditEvent auditEvent2 = new AuditEvent();
        auditEvent2.setSubmission(submission);
        auditEvent2.setUser(studentRepository.findByEmail(email).orElseThrow());
        auditEvent2.setEventType("AI_PROCESSING_STARTED");
        auditEventRepository.save(auditEvent2);

        aiAnalysisGateway.analyze(submission.getSubmissionId());
    }
    
    @Transactional(readOnly = true)
    public Submission getTeacherSubmission(String email, UUID submissionId) {
        Teacher teacher = teacherRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Teacher not found", HttpStatus.NOT_FOUND));
        
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Submission not found", HttpStatus.NOT_FOUND));

        if (submission.getBatch() != null && !submission.getBatch().getTeacher().getId().equals(teacher.getId())) {
             throw new ApiException("FORBIDDEN", "Not authorized", HttpStatus.FORBIDDEN);
        }
        
        return submission;
    }
    
    @Transactional
    public void approveSubmission(String email, UUID submissionId) {
        Submission submission = getTeacherSubmission(email, submissionId);

        if (!APPROVABLE_STATES.contains(submission.getStatus())) {
            throw new ApiException("INVALID_STATE", "Submission not in approvable state", HttpStatus.BAD_REQUEST);
        }
        
        submission.setStatus("TEACHER_APPROVED");
        submissionRepository.save(submission);
        
        TeacherDecision decision = new TeacherDecision();
        decision.setSubmission(submission);
        decision.setTeacher(teacherRepository.findByEmail(email).orElseThrow());
        decision.setType("APPROVED");
        decision.setFinalScore(submission.getAssignment() != null && submission.getAssignment().getMaxScore() != null ? submission.getAssignment().getMaxScore() : 10);
        teacherDecisionRepository.save(decision);
        
        AuditEvent auditEvent = new AuditEvent();
        auditEvent.setSubmission(submission);
        auditEvent.setUser(teacherRepository.findByEmail(email).orElseThrow());
        auditEvent.setEventType("TEACHER_APPROVED");
        auditEventRepository.save(auditEvent);
    }
    
    @Transactional
    public void overrideSubmission(String email, UUID submissionId, Map<String, Object> overrideData) {
        Submission submission = getTeacherSubmission(email, submissionId);

        if (!APPROVABLE_STATES.contains(submission.getStatus())) {
            throw new ApiException("INVALID_STATE", "Submission not in overridable state", HttpStatus.BAD_REQUEST);
        }

        String reason = (String) overrideData.get("reason");
        if (reason == null || reason.isBlank()) {
            throw new ApiException("VALIDATION_ERROR", "Reason is required for override", HttpStatus.BAD_REQUEST);
        }
        
        submission.setStatus("TEACHER_OVERRIDDEN");
        submissionRepository.save(submission);
        
        TeacherDecision decision = new TeacherDecision();
        decision.setSubmission(submission);
        decision.setTeacher(teacherRepository.findByEmail(email).orElseThrow());
        decision.setType("OVERRIDDEN");
        Number scoreNum = null;
        if (overrideData.containsKey("score")) {
            Object s = overrideData.get("score");
            if (s instanceof Number) {
                scoreNum = (Number) s;
            }
        }
        if (scoreNum == null && overrideData.containsKey("finalScore")) {
            Object fs = overrideData.get("finalScore");
            if (fs instanceof Number) {
                scoreNum = (Number) fs;
            }
        }
        decision.setFinalScore(scoreNum != null ? (int) Math.round(scoreNum.doubleValue()) : 0);
        decision.setReason(reason);
        teacherDecisionRepository.save(decision);
        
        AuditEvent auditEvent = new AuditEvent();
        auditEvent.setSubmission(submission);
        auditEvent.setUser(teacherRepository.findByEmail(email).orElseThrow());
        auditEvent.setEventType("TEACHER_OVERRIDDEN");
        auditEventRepository.save(auditEvent);
    }
}
