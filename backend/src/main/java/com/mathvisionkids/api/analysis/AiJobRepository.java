package com.mathvisionkids.api.analysis;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface AiJobRepository extends JpaRepository<AiJob, UUID> {
    List<AiJob> findBySubmission_SubmissionId(UUID submissionId);
}
