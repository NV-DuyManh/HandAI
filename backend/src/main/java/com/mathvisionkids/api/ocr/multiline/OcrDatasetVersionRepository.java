package com.mathvisionkids.api.ocr.multiline;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OcrDatasetVersionRepository extends JpaRepository<OcrDatasetVersion, UUID> {
    Optional<OcrDatasetVersion> findByVersion(String version);
}
