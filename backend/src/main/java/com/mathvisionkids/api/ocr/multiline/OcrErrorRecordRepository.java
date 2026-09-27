package com.mathvisionkids.api.ocr.multiline;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OcrErrorRecordRepository extends JpaRepository<OcrErrorRecord, UUID> {
    List<OcrErrorRecord> findByTrial_TrialId(UUID trialId);
    List<OcrErrorRecord> findByErrorType(String errorType);
}
