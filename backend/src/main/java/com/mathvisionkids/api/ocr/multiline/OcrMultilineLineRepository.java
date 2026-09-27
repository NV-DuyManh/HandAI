package com.mathvisionkids.api.ocr.multiline;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OcrMultilineLineRepository extends JpaRepository<OcrMultilineLine, UUID> {
    List<OcrMultilineLine> findByTrialOrderByLineOrderAsc(OcrMultilineTrial trial);
    Optional<OcrMultilineLine> findByLineIdAndTrial(UUID lineId, OcrMultilineTrial trial);
}
