package com.mathvisionkids.api.ocr.multiline;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ocr_error_records")
@Getter
@Setter
@NoArgsConstructor
public class OcrErrorRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trial_id", nullable = false)
    private OcrMultilineTrial trial;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "line_id", nullable = false)
    private OcrMultilineLine line;

    @Column(name = "error_type", nullable = false)
    private String errorType; // VIETNAMESE_TONE_ERROR, SIMILAR_CHARACTER_CONFUSION, MISSING_CHARACTER, LOW_IMAGE_QUALITY

    @Column(name = "severity", nullable = false)
    private String severity = "LOW";

    @Column(name = "wrong_character")
    private String wrongCharacter;

    @Column(name = "correct_character")
    private String correctCharacter;

    @Column(name = "wrong_text", columnDefinition = "TEXT")
    private String wrongText;

    @Column(name = "ground_truth_text", columnDefinition = "TEXT")
    private String groundTruthText;

    @Column(name = "confidence")
    private Double confidence;

    @Column(name = "decision_source", nullable = false)
    private String decisionSource = "CRNN_RAW"; // CRNN_RAW, AI_CORRECTION, MANUAL_EDIT

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
