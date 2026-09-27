package com.mathvisionkids.api.batch;

import com.mathvisionkids.api.analysis.AiAnalysisGateway;
import com.mathvisionkids.api.assignment.Assignment;
import com.mathvisionkids.api.assignment.AssignmentRepository;
import com.mathvisionkids.api.audit.AuditEvent;
import com.mathvisionkids.api.audit.AuditEventRepository;
import com.mathvisionkids.api.common.ApiException;
import com.mathvisionkids.api.storage.ObjectStorageService;
import com.mathvisionkids.api.submission.Submission;
import com.mathvisionkids.api.submission.SubmissionImage;
import com.mathvisionkids.api.submission.SubmissionImageRepository;
import com.mathvisionkids.api.submission.SubmissionRepository;
import com.mathvisionkids.api.user.Teacher;
import com.mathvisionkids.api.user.TeacherRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class BatchService {
    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(BatchService.class);
    private final BatchRepository batchRepository;
    private final AssignmentRepository assignmentRepository;
    private final TeacherRepository teacherRepository;
    private final SubmissionRepository submissionRepository;
    private final SubmissionImageRepository submissionImageRepository;
    private final AuditEventRepository auditEventRepository;
    private final ObjectStorageService objectStorageService;
    private final AiAnalysisGateway aiAnalysisGateway;
    private final com.mathvisionkids.api.user.StudentRepository studentRepository;

    public BatchService(BatchRepository batchRepository, AssignmentRepository assignmentRepository, TeacherRepository teacherRepository, SubmissionRepository submissionRepository, SubmissionImageRepository submissionImageRepository, AuditEventRepository auditEventRepository, ObjectStorageService objectStorageService, AiAnalysisGateway aiAnalysisGateway, com.mathvisionkids.api.user.StudentRepository studentRepository) {
        this.batchRepository = batchRepository;
        this.assignmentRepository = assignmentRepository;
        this.teacherRepository = teacherRepository;
        this.submissionRepository = submissionRepository;
        this.submissionImageRepository = submissionImageRepository;
        this.auditEventRepository = auditEventRepository;
        this.objectStorageService = objectStorageService;
        this.aiAnalysisGateway = aiAnalysisGateway;
        this.studentRepository = studentRepository;
    }

    @Transactional
    public Batch createBatch(String teacherEmail, UUID assignmentId) {
        Teacher teacher = teacherRepository.findByEmail(teacherEmail)
                .map(u -> teacherRepository.findById(u.getId()).orElse(null))
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Teacher not found", HttpStatus.NOT_FOUND));

        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Assignment not found", HttpStatus.NOT_FOUND));

        if (!assignment.getTeacher().getId().equals(teacher.getId())) {
            throw new ApiException("FORBIDDEN", "Not authorized for this assignment", HttpStatus.FORBIDDEN);
        }

        Batch batch = new Batch();
        batch.setAssignment(assignment);
        batch.setTeacher(teacher);
        batch.setStatus("CREATED");
        return batchRepository.save(batch);
    }

    @Transactional
    public void uploadImages(String teacherEmail, UUID batchId, List<MultipartFile> images, List<BatchImageMapping> mappings) {
        Teacher teacher = teacherRepository.findByEmail(teacherEmail)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Teacher not found", HttpStatus.NOT_FOUND));

        Batch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "Batch not found", HttpStatus.NOT_FOUND));

        if (!batch.getTeacher().getId().equals(teacher.getId())) {
            throw new ApiException("FORBIDDEN", "Not authorized for this batch", HttpStatus.FORBIDDEN);
        }

        if (images.size() < 1 || images.size() > 30) {
            throw new ApiException("VALIDATION_ERROR", "Image count must be between 1 and 30", HttpStatus.BAD_REQUEST);
        }
        
        if (mappings.size() != images.size()) {
            throw new ApiException("VALIDATION_ERROR", "Mappings count must match images count", HttpStatus.BAD_REQUEST);
        }

        batch.setStatus("UPLOADING");
        batchRepository.save(batch);

        int count = 0;
        List<UUID> createdSubmissionIds = new ArrayList<>();
        for (int i = 0; i < images.size(); i++) {
            MultipartFile file = images.get(i);
            BatchImageMapping mapping = mappings.get(i);
            
            // Validate mapping
            if (mapping.getStudentId() == null) {
                throw new ApiException("VALIDATION_ERROR", "Missing student mapping for index " + i, HttpStatus.BAD_REQUEST);
            }
            
            if (mapping.getFileIndex() == null || mapping.getFileIndex() != i) {
                throw new ApiException("VALIDATION_ERROR", "Invalid file index in mapping at index " + i, HttpStatus.BAD_REQUEST);
            }

            final int index = i;
            com.mathvisionkids.api.user.Student student = studentRepository.findById(mapping.getStudentId())
                    .orElseThrow(() -> new ApiException("VALIDATION_ERROR", "Unknown student for index " + index, HttpStatus.BAD_REQUEST));
                    
            if (batch.getAssignment().getClassroom() == null || batch.getAssignment().getClassroom().getStudents().stream().noneMatch(s -> s.getId().equals(student.getId()))) {
                throw new ApiException("VALIDATION_ERROR", "Student outside classroom for index " + index, HttpStatus.BAD_REQUEST);
            }
            
            try {
                String contentType = file.getContentType();
                if (contentType == null || (!contentType.equals("image/jpeg") && !contentType.equals("image/png") && !contentType.equals("image/webp"))) {
                    continue; // Skip unsupported
                }

                String filePath = objectStorageService.store(file, "batches/" + batchId.toString());

                try {
                    Submission submission = new Submission();
                    submission.setBatch(batch);
                    submission.setAssignment(batch.getAssignment());
                    submission.setStudent(student);
                    
                    submission.setStatus("PROCESSING");
                    submissionRepository.save(submission);
    
                    SubmissionImage image = new SubmissionImage();
                    image.setSubmission(submission);
                    image.setFilePath(filePath);
                    image.setContentType(contentType);
                    image.setFileSize(file.getSize());
                    image.setSource("CAMERA");
                    submissionImageRepository.saveAndFlush(image);
                    
                    count++;
                    
                    AuditEvent auditEvent = new AuditEvent();
                    auditEvent.setSubmission(submission);
                    auditEvent.setUser(teacher);
                    auditEvent.setEventType("AI_PROCESSING_STARTED");
                    auditEventRepository.save(auditEvent);
                    
                    createdSubmissionIds.add(submission.getSubmissionId());
                } catch (Exception dbException) {
                    try {
                        objectStorageService.delete(filePath);
                    } catch (IOException ignored) {}
                    throw new ApiException("INTERNAL_ERROR", "Database transaction failed. Orphaned file removed.", HttpStatus.INTERNAL_SERVER_ERROR);
                }

            } catch (IOException e) {
                // Ignore partial failure
            }
        }
        
        batch.setTotalCount(batch.getTotalCount() + count);
        batch.setStatus("PROCESSING");
        batchRepository.save(batch);

        final List<UUID> toAnalyze = createdSubmissionIds;
        logger.info("uploadImages completed, registering afterCommit for {} submissions", toAnalyze.size());
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        java.util.concurrent.CompletableFuture.runAsync(() -> {
                            logger.info("BatchService afterCommit async trigger firing for {} submissions", toAnalyze.size());
                            for (UUID subId : toAnalyze) {
                                try {
                                    aiAnalysisGateway.analyze(subId);
                                } catch (Exception e) {
                                    logger.error("Error analyzing submissionId: {} in afterCommit", subId, e);
                                }
                            }
                        });
                    }
                }
            );
        } else {
            for (UUID subId : toAnalyze) {
                aiAnalysisGateway.analyze(subId);
            }
        }
    }
    
    @Transactional(readOnly = true)
    public List<Batch> getBatches(String teacherEmail) {
        Teacher teacher = teacherRepository.findByEmail(teacherEmail).orElseThrow();
        return batchRepository.findByTeacher_IdOrderByCreatedAtDesc(teacher.getId());
    }
    
    @Transactional(readOnly = true)
    public Batch getBatch(String teacherEmail, UUID batchId) {
        Teacher teacher = teacherRepository.findByEmail(teacherEmail).orElseThrow();
        Batch batch = batchRepository.findById(batchId).orElseThrow();
        if (!batch.getTeacher().getId().equals(teacher.getId())) throw new ApiException("FORBIDDEN", "Forbidden", HttpStatus.FORBIDDEN);
        return batch;
    }

    @Transactional(readOnly = true)
    public List<UUID> getBatchReviewQueue(String teacherEmail, UUID batchId) {
        Teacher teacher = teacherRepository.findByEmail(teacherEmail).orElseThrow();
        Batch batch = batchRepository.findById(batchId).orElseThrow();
        if (!batch.getTeacher().getId().equals(teacher.getId())) throw new ApiException("FORBIDDEN", "Forbidden", HttpStatus.FORBIDDEN);
        
        return submissionRepository.findByBatch_BatchId(batchId).stream()
                .filter(s -> "REVIEW_REQUIRED".equals(s.getStatus()) || "PROPOSED_GRADE".equals(s.getStatus()))
                .map(Submission::getSubmissionId)
                .toList();
    }
}
