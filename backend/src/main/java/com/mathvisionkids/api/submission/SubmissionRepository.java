package com.mathvisionkids.api.submission;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface SubmissionRepository extends JpaRepository<Submission, UUID> {
    List<Submission> findByStudent_Id(UUID studentId);
    List<Submission> findByBatch_BatchId(UUID batchId);
    List<Submission> findByBatch_BatchIdAndStatus(UUID batchId, String status);
}
