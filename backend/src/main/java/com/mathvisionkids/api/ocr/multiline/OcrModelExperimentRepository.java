package com.mathvisionkids.api.ocr.multiline;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OcrModelExperimentRepository extends JpaRepository<OcrModelExperiment, UUID> {
    Optional<OcrModelExperiment> findByExperimentId(String experimentId);
    List<OcrModelExperiment> findByModelVersion(String modelVersion);
    List<OcrModelExperiment> findByStatus(String status);
}
