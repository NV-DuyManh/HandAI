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
@Table(name = "ocr_model_experiments")
@Getter
@Setter
@NoArgsConstructor
public class OcrModelExperiment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @Column(name = "experiment_id", nullable = false, unique = true)
    private String experimentId;

    @Column(name = "model_name", nullable = false)
    private String modelName;

    @Column(name = "model_version", nullable = false)
    private String modelVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dataset_version_id")
    private OcrDatasetVersion datasetVersion;

    @Column(name = "dataset_version_name")
    private String datasetVersionName;

    @Column(nullable = false)
    private String framework = "PyTorch 2.6.0+cu124";

    @Column(nullable = false)
    private String architecture = "CRNN (4-block Conv2D + GroupNorm(8, C) + BiLSTM(128) + Linear(320) + CTC Loss)";

    @Column(nullable = false)
    private String parameters = "5,962,560 (~5.96M params)";

    @Column(name = "checkpoint_sha256")
    private String checkpointSha256;

    @Column(name = "training_date")
    private String trainingDate;

    @Column(nullable = false)
    private String status = "ACTIVE";

    @Column(name = "line_accuracy", nullable = false)
    private double lineAccuracy = 0.0;

    @Column(name = "character_accuracy", nullable = false)
    private double characterAccuracy = 0.0;

    @Column(nullable = false)
    private double cer = 0.0;

    @Column(nullable = false)
    private double wer = 0.0;

    @Column(nullable = false)
    private double latency = 0.0;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "modelExperiment", fetch = FetchType.LAZY)
    private List<OcrMultilineTrial> trials = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
