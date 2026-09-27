package com.mathvisionkids.api.analysis;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface TeacherDecisionRepository extends JpaRepository<TeacherDecision, UUID> {
    Optional<TeacherDecision> findBySubmission_SubmissionId(UUID submissionId);
}
