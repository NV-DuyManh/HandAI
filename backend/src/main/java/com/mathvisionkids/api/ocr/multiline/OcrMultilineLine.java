package com.mathvisionkids.api.ocr.multiline;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ocr_multiline_lines")
@Getter
@Setter
@NoArgsConstructor
public class OcrMultilineLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "line_id")
    private UUID lineId;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trial_id", nullable = false)
    private OcrMultilineTrial trial;

    @Column(name = "line_order", nullable = false)
    private int lineOrder;

    @Column(nullable = false)
    private int x;

    @Column(nullable = false)
    private int y;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(name = "line_image_object_key", nullable = false)
    private String lineImageObjectKey;

    @Column(name = "line_image_sha256", nullable = false)
    private String lineImageSha256;

    @Column(name = "predicted_text", nullable = false)
    private String predictedText;

    @Column(name = "verified_text_raw")
    private String verifiedTextRaw;

    @Column(name = "verified_text_normalized")
    private String verifiedTextNormalized;

    @Column(nullable = false)
    private String verdict = "UNVERIFIED";

    @Column(name = "training_eligible", nullable = false)
    private boolean trainingEligible = false;

    @Column(name = "model_name")
    private String modelName = "Vietnamese-Handwriting-OCR-Full";

    @Column(name = "model_version")
    private String modelVersion = "1.0.0";

    @Column(name = "checkpoint_sha256")
    private String checkpointSha256;

    @Column(name = "vocab_sha256")
    private String vocabSha256;

    @Column(name = "preprocessing_version")
    private String preprocessingVersion = "v1_resize_64x1024_imagenet";

    @Column(name = "raw_ocr_text")
    private String rawOcrText;

    @Column(name = "raw_ocr_confidence")
    private Double rawOcrConfidence;

    @Column(name = "corrected_text")
    private String correctedText;

    @Column(name = "correction_confidence")
    private Double correctionConfidence;

    @Column(name = "correction_applied")
    private Boolean correctionApplied;

    @Column(name = "correction_decision")
    private String correctionDecision;

    @Column(name = "groq_suggestion")
    private String groqSuggestion;

    @Column(name = "groq_confidence")
    private Double groqConfidence;

    @Column(name = "groq_decision")
    private String groqDecision;

    @Column(name = "groq_status")
    private String groqStatus;

    @Column(name = "groq_model")
    private String groqModel;

    @Column(name = "gemini_suggestion")
    private String geminiSuggestion;

    @Column(name = "gemini_confidence")
    private Double geminiConfidence;

    @Column(name = "gemini_decision")
    private String geminiDecision;

    @Column(name = "gemini_status")
    private String geminiStatus;

    @Column(name = "gemini_model")
    private String geminiModel;

    @Column(name = "suggestions_json")
    private String suggestionsJson;

    @Column(name = "feedback_at")
    private Instant feedbackAt;

    @OneToMany(mappedBy = "line", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private java.util.List<OcrErrorRecord> errorRecords = new java.util.ArrayList<>();

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();
}

