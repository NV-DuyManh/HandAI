package com.mathvisionkids.api.ocr.multiline;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MultilineTrialResponse {
    private UUID trialId;
    private UUID userId;
    private String source;
    private String pageImageObjectKey;
    private String pageImageSha256;
    private Integer pageWidth;
    private Integer pageHeight;
    private boolean privacyConfirmed;
    private boolean isTestData;
    private String dataOrigin;
    private String domain;
    private String status;
    private Instant createdAt;
    private List<MultilineLineResponse> lines;
    private Boolean canonicalMatched;
    private String fixtureId;
    private String recognitionSource;
    private String recognitionEngine;
    private String segmentationSource;
    private String correctionSource;
    private String finalTextSource;
    private String requestId;

    public static MultilineTrialResponse fromEntity(OcrMultilineTrial entity) {
        if (entity == null) return null;
        List<MultilineLineResponse> lineResponses = entity.getLines() != null
                ? entity.getLines().stream().map(MultilineLineResponse::fromEntity).collect(Collectors.toList())
                : List.of();

        return MultilineTrialResponse.builder()
                .trialId(entity.getTrialId())
                .userId(entity.getUserId())
                .source(entity.getSource())
                .pageImageObjectKey(entity.getPageImageObjectKey())
                .pageImageSha256(entity.getPageImageSha256())
                .pageWidth(entity.getPageWidth())
                .pageHeight(entity.getPageHeight())
                .privacyConfirmed(entity.isPrivacyConfirmed())
                .isTestData(entity.isTestData())
                .dataOrigin(entity.getDataOrigin())
                .domain(entity.getDomain())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .lines(lineResponses)
                .canonicalMatched(entity.getCanonicalMatched())
                .fixtureId(entity.getFixtureId())
                .recognitionSource(entity.getRecognitionSource())
                .recognitionEngine(entity.getRecognitionEngine())
                .segmentationSource(entity.getSegmentationSource())
                .correctionSource(entity.getCorrectionSource())
                .finalTextSource(entity.getFinalTextSource())
                .requestId(entity.getRequestId())
                .build();
    }
}

