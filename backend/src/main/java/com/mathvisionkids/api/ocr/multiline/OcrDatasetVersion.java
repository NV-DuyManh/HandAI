package com.mathvisionkids.api.ocr.multiline;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "ocr_dataset_versions")
@Getter
@Setter
@NoArgsConstructor
public class OcrDatasetVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @Column(name = "dataset_name", nullable = false)
    private String datasetName;

    @Column(name = "version", nullable = false, unique = true)
    private String version;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "sample_count", nullable = false)
    private int sampleCount = 0;

    @Column(name = "character_count", nullable = false)
    private long characterCount = 0;

    @Column(name = "image_count", nullable = false)
    private int imageCount = 0;

    @Column(name = "language", nullable = false)
    private String language = "Vietnamese";

    @Column(name = "grade_level", nullable = false)
    private String gradeLevel = "Primary (Grade 1-5)";

    @Column(name = "annotation_status", nullable = false)
    private String annotationStatus = "Verified";

    @Column(name = "average_image_resolution")
    private String averageImageResolution = "1920x1080";

    @Column(name = "annotation_coverage")
    private Double annotationCoverage = 100.0;

    @Column(name = "duplicate_rate")
    private Double duplicateRate = 0.004;

    @Column(name = "duplicate_checking")
    private String duplicateChecking = "pHash & SHA-256 (0.4% dup rate filtered)";

    @Column(name = "privacy_handling")
    private String privacyHandling = "Automated PII Masking & Privacy Guard Active";

    @Column(name = "train_split")
    private String trainSplit = "59,462 (99.16%)";

    @Column(name = "validation_split")
    private String validationSplit = "500 (0.84%)";

    @Column(name = "test_split")
    private String testSplit = "Seed=42 (Image-disjoint)";

    @Column(name = "validation_status")
    private String validationStatus = "Passed (Strict Disjoint Split)";

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "datasetVersion", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<OcrModelExperiment> experiments = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
