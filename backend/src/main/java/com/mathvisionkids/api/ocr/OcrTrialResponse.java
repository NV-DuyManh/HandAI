package com.mathvisionkids.api.ocr;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OcrTrialResponse {
    private UUID trialId;
    private String status;
    private String recognizedText;
    private String predictedText;
    private String verifiedTextRaw;
    private String verifiedTextNormalized;
    private String verdict;
    private String source;
    private String domain;
    private String dataOrigin;
    private boolean trainingEligible;
    private boolean privacyConfirmed;
    @com.fasterxml.jackson.annotation.JsonProperty("isTestData")
    private boolean isTestData;
    private java.math.BigDecimal confidence;
    private String modelName;
    private String modelVersion;
    private String checkpointSha256;
    private String vocabSha256;
    private String preprocessingVersion;
    private Instant createdAt;
    private Instant feedbackAt;

    public static OcrTrialResponse fromEntity(OcrTrial trial) {
        return OcrTrialResponse.builder()
                .trialId(trial.getTrialId())
                .status("COMPLETED")
                .recognizedText(trial.getPredictedText())
                .predictedText(trial.getPredictedText())
                .verifiedTextRaw(trial.getVerifiedTextRaw())
                .verifiedTextNormalized(trial.getVerifiedTextNormalized())
                .verdict(trial.getVerdict())
                .source(trial.getSource())
                .domain(trial.getDomain())
                .dataOrigin(trial.getDataOrigin())
                .trainingEligible(trial.isTrainingEligible())
                .privacyConfirmed(trial.isPrivacyConfirmed())
                .isTestData(trial.isTestData())
                .confidence(trial.getConfidence())
                .modelName(trial.getModelName())
                .modelVersion(trial.getModelVersion())
                .checkpointSha256(trial.getCheckpointSha256())
                .vocabSha256(trial.getVocabSha256())
                .preprocessingVersion(trial.getPreprocessingVersion())
                .createdAt(trial.getCreatedAt())
                .feedbackAt(trial.getFeedbackAt())
                .build();
    }
}
