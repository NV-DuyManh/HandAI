package com.mathvisionkids.api.ocr;

import com.mathvisionkids.api.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ocr_trials")
@Getter
@Setter
@NoArgsConstructor
public class OcrTrial {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "trial_id")
    private UUID trialId;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false)
    private String source;

    @Column(name = "line_image_object_key", nullable = false)
    private String lineImageObjectKey;

    @Column(name = "line_image_sha256", nullable = false)
    private String lineImageSha256;

    @Column(name = "image_width")
    private Integer imageWidth;

    @Column(name = "image_height")
    private Integer imageHeight;

    @Column(name = "predicted_text")
    private String predictedText;

    @Column(name = "verified_text_raw")
    private String verifiedTextRaw;

    @Column(nullable = false)
    private String verdict = "UNVERIFIED";

    @Column(name = "model_name", nullable = false)
    private String modelName;

    @Column(name = "model_version", nullable = false)
    private String modelVersion;

    @Column(name = "checkpoint_sha256", nullable = false)
    private String checkpointSha256;

    @Column(name = "vocab_sha256", nullable = false)
    private String vocabSha256;

    @Column(name = "preprocessing_version", nullable = false)
    private String preprocessingVersion = "v1_resize_64x1024_imagenet";

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "feedback_at")
    private Instant feedbackAt;

    @Column(name = "training_eligible", nullable = false)
    private boolean trainingEligible = false;

    @Column(name = "privacy_confirmed", nullable = false)
    private boolean privacyConfirmed = false;

    @Column(name = "is_test_data", nullable = false)
    private boolean isTestData = false;

    @Column(name = "domain", nullable = false)
    private String domain = "HANDWRITING_TEXT";

    @Column(name = "data_origin", nullable = false)
    private String dataOrigin = "PHYSICAL_USER";

    @Column(name = "verified_text_normalized")
    private String verifiedTextNormalized;

    @Column(name = "confidence")
    private java.math.BigDecimal confidence;

    @com.fasterxml.jackson.annotation.JsonProperty("userId")
    public UUID getUserId() {
        return user != null ? user.getId() : null;
    }
}
