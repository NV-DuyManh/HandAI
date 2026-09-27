package com.mathvisionkids.api.submission;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface SubmissionImageRepository extends JpaRepository<SubmissionImage, UUID> {
    Optional<SubmissionImage> findBySubmission_SubmissionId(UUID submissionId);
}
