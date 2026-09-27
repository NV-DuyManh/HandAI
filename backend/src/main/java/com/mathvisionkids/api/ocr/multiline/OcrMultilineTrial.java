package com.mathvisionkids.api.ocr.multiline;

import com.mathvisionkids.api.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "ocr_multiline_trials")
@Getter
@Setter
@NoArgsConstructor
public class OcrMultilineTrial {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "trial_id")
    private UUID trialId;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false)
    private String source = "CAMERA";

    @Column(name = "page_image_object_key", nullable = false)
    private String pageImageObjectKey;

    @Column(name = "page_image_sha256", nullable = false)
    private String pageImageSha256;

    @Column(name = "page_width")
    private Integer pageWidth;

    @Column(name = "page_height")
    private Integer pageHeight;

    @Column(name = "privacy_confirmed", nullable = false)
    private boolean privacyConfirmed = false;

    @Column(name = "is_test_data", nullable = false)
    private boolean isTestData = false;

    @Column(name = "data_origin", nullable = false)
    private String dataOrigin = "PHYSICAL_USER";

    @Column(nullable = false)
    private String domain = "HANDWRITING_TEXT";

    @Column(nullable = false)
    private String status = "COMPLETED";

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "trial", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("lineOrder ASC")
    private List<OcrMultilineLine> lines = new ArrayList<>();

    @OneToMany(mappedBy = "trial", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<OcrErrorRecord> errorRecords = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "experiment_id")
    private OcrModelExperiment modelExperiment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dataset_version_id")
    private OcrDatasetVersion datasetVersion;

    @Column(name = "model_version_str")
    private String modelVersionStr;

    @Column(name = "dataset_version_str")
    private String datasetVersionStr;

    @Column(name = "engine_version_str")
    private String engineVersionStr;

    @Column(name = "canonical_matched")
    private Boolean canonicalMatched;

    @Column(name = "fixture_id")
    private String fixtureId;

    @Column(name = "recognition_source")
    private String recognitionSource;

    @Column(name = "recognition_engine")
    private String recognitionEngine;

    @Column(name = "segmentation_source")
    private String segmentationSource;

    @Column(name = "correction_source")
    private String correctionSource;

    @Column(name = "final_text_source")
    private String finalTextSource;

    @Transient
    private String requestId;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }


    @com.fasterxml.jackson.annotation.JsonProperty("userId")
    public UUID getUserId() {
        return user != null ? user.getId() : null;
    }
}
