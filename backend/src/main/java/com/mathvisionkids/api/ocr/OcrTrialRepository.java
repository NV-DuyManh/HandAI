package com.mathvisionkids.api.ocr;

import com.mathvisionkids.api.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OcrTrialRepository extends JpaRepository<OcrTrial, UUID> {
    List<OcrTrial> findByTrainingEligibleTrueOrderByCreatedAtDesc();
    List<OcrTrial> findByTrainingEligibleTrueAndIsTestDataFalseOrderByCreatedAtDesc();
    List<OcrTrial> findByUserOrderByCreatedAtDesc(User user);
    long countByVerdict(String verdict);
    long countByVerdictAndIsTestDataFalse(String verdict);
    long countByIsTestDataFalse();
    long countByTrainingEligibleTrue();
    long countByTrainingEligibleTrueAndIsTestDataFalse();
    List<OcrTrial> findByVerdictInAndIsTestDataFalse(List<String> verdicts);
}
