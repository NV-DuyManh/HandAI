package com.mathvisionkids.api.ocr.multiline;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MultilineLineResponse {
    private UUID lineId;
    private int lineOrder;
    private int x;
    private int y;
    private int width;
    private int height;
    private String lineImageObjectKey;
    private String lineImageSha256;
    private String predictedText;
    private String verifiedTextRaw;
    private String verifiedTextNormalized;
    private String verdict;
    private boolean trainingEligible;
    private Instant feedbackAt;

    private String rawOcrText;
    private Double rawOcrConfidence;
    private String correctedText;
    private Double correctionConfidence;
    private Boolean correctionApplied;
    private String correctionDecision;
    private String finalText;

    private String groqSuggestion;
    private Double groqConfidence;
    private String groqDecision;
    private String groqStatus;
    private String groqModel;

    private String geminiSuggestion;
    private Double geminiConfidence;
    private String geminiDecision;
    private String geminiStatus;
    private String geminiModel;

    private java.util.List<java.util.Map<String, Object>> suggestions;

    public static MultilineLineResponse fromEntity(OcrMultilineLine entity) {
        if (entity == null) return null;

        java.util.List<java.util.Map<String, Object>> parsedSuggestions = null;
        if (entity.getSuggestionsJson() != null && !entity.getSuggestionsJson().isBlank()) {
            try {
                parsedSuggestions = new com.fasterxml.jackson.databind.ObjectMapper().readValue(
                        entity.getSuggestionsJson(),
                        new com.fasterxml.jackson.core.type.TypeReference<java.util.List<java.util.Map<String, Object>>>() {}
                );
            } catch (Exception ignored) {}
        }

        return MultilineLineResponse.builder()
                .lineId(entity.getLineId())
                .lineOrder(entity.getLineOrder())
                .x(entity.getX())
                .y(entity.getY())
                .width(entity.getWidth())
                .height(entity.getHeight())
                .lineImageObjectKey(entity.getLineImageObjectKey())
                .lineImageSha256(entity.getLineImageSha256())
                .predictedText(entity.getPredictedText())
                .verifiedTextRaw(entity.getVerifiedTextRaw())
                .verifiedTextNormalized(entity.getVerifiedTextNormalized())
                .verdict(entity.getVerdict())
                .trainingEligible(entity.isTrainingEligible())
                .feedbackAt(entity.getFeedbackAt())
                .rawOcrText(entity.getRawOcrText())
                .rawOcrConfidence(entity.getRawOcrConfidence())
                .correctedText(entity.getCorrectedText())
                .correctionConfidence(entity.getCorrectionConfidence())
                .correctionApplied(entity.getCorrectionApplied())
                .correctionDecision(entity.getCorrectionDecision())
                .finalText(entity.getPredictedText())
                .groqSuggestion(entity.getGroqSuggestion())
                .groqConfidence(entity.getGroqConfidence())
                .groqDecision(entity.getGroqDecision())
                .groqStatus(entity.getGroqStatus())
                .groqModel(entity.getGroqModel())
                .geminiSuggestion(entity.getGeminiSuggestion())
                .geminiConfidence(entity.getGeminiConfidence())
                .geminiDecision(entity.getGeminiDecision())
                .geminiStatus(entity.getGeminiStatus())
                .geminiModel(entity.getGeminiModel())
                .suggestions(parsedSuggestions)
                .build();
    }
}

