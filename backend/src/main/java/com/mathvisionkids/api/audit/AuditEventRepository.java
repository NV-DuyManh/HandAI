package com.mathvisionkids.api.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {
    List<AuditEvent> findBySubmission_SubmissionIdOrderByCreatedAtDesc(UUID submissionId);
    Page<AuditEvent> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<AuditEvent> findByEventTypeOrderByCreatedAtDesc(String eventType, Pageable pageable);
}
