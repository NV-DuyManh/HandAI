package com.mathvisionkids.api.analysis;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface AnalysisResultRepository extends JpaRepository<AnalysisResult, UUID> {
    Optional<AnalysisResult> findBySubmission_SubmissionId(UUID submissionId);
    boolean existsBySubmission_SubmissionId(UUID submissionId);
}
