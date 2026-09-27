package com.mathvisionkids.api.ocr;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OcrMetricsResponse {
    private long totalTrials;
    private long verifiedTrials;
    private long correctCount;
    private long correctedCount;
    private long skippedCount;
    private long unverifiedCount;
    private Double exactMatchRate;
    private String exactMatchPercentage;
    private Double characterErrorRate;
    private String cerPercentage;
    private String domain;
    private String evaluationScope;
}
