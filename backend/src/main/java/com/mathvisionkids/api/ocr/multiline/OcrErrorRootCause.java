package com.mathvisionkids.api.ocr.multiline;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ocr_error_root_causes")
@Getter
@Setter
@NoArgsConstructor
public class OcrErrorRootCause {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trial_id")
    private OcrMultilineTrial trial;

    @Column(name = "line_id")
    private String lineId;

    @Column(name = "error_type", nullable = false)
    private String errorType; // VIETNAMESE_TONE_ERROR, SIMILAR_CHARACTER_CONFUSION, etc.

    @Column(name = "root_cause", nullable = false)
    private String rootCause; // RECOGNITION_ERROR, LANGUAGE_CORRECTION_ERROR, SEGMENTATION_ERROR, IMAGE_QUALITY_ERROR

    @Column(name = "cause_description", columnDefinition = "TEXT")
    private String causeDescription;

    @Column(name = "severity", nullable = false)
    private String severity = "MEDIUM"; // LOW, MEDIUM, HIGH

    @Column(name = "confidence", nullable = false)
    private Double confidence = 0.0;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
