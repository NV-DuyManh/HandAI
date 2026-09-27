package com.mathvisionkids.api.ocr.multiline;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface OcrMultilineTrialRepository extends JpaRepository<OcrMultilineTrial, UUID> {
}
