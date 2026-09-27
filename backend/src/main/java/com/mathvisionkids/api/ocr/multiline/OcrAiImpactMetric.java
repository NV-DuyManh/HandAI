package com.mathvisionkids.api.ocr.multiline;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ocr_ai_impact_metrics")
@Getter
@Setter
@NoArgsConstructor
public class OcrAiImpactMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trial_id")
    private OcrMultilineTrial trial;

    @Column(name = "trial_str_id")
    private String trialStrId;

    @Column(name = "raw_accuracy", nullable = false)
    private Double rawAccuracy = 0.0;

    @Column(name = "final_accuracy", nullable = false)
    private Double finalAccuracy = 0.0;

    @Column(name = "accuracy_gain", nullable = false)
    private Double accuracyGain = 0.0;

    @Column(name = "raw_cer")
    private Double rawCer = 0.0;

    @Column(name = "final_cer")
    private Double finalCer = 0.0;

    @Column(name = "raw_wer")
    private Double rawWer = 0.0;

    @Column(name = "final_wer")
    private Double finalWer = 0.0;

    @Column(name = "total_ocr_errors", nullable = false)
    private Integer totalOcrErrors = 0;

    @Column(name = "corrected_errors", nullable = false)
    private Integer correctedErrors = 0;

    @Column(name = "rescue_rate", nullable = false)
    private Double rescueRate = 0.0;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
