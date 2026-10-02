package com.mathvisionkids.api.ocr.multiline;

import com.mathvisionkids.api.ocr.OcrConfidence;
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
    private String rawOcrConfidenceSource;
    private String correctedText;
    private Double correctionConfidence;
    private Boolean correctionApplied;
    private String correctionDecision;
    private String finalText;

    private String groqSuggestion;
    private Double groqConfidence;
    private String groqConfidenceSource;
    private String groqDecision;
    private String groqStatus;
    private String groqModel;

    private String geminiSuggestion;
    private Double geminiConfidence;
    private String geminiConfidenceSource;
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

        boolean localSubstitution = "LOCAL_ADVISOR_APPLY".equalsIgnoreCase(entity.getCorrectionDecision());
        boolean groqRejected = localSubstitution || providerEvidenceRejected(parsedSuggestions, "GROQ");
        boolean geminiRejected = localSubstitution || providerEvidenceRejected(parsedSuggestions, "GEMINI");
        String groqStatus = groqRejected ? "UNAVAILABLE" : entity.getGroqStatus();
        String geminiStatus = geminiRejected ? "UNAVAILABLE" : entity.getGeminiStatus();
        java.util.List<java.util.Map<String, Object>> safeSuggestions = localSubstitution ? java.util.List.of() : parsedSuggestions;
        if (safeSuggestions != null) {
            safeSuggestions = safeSuggestions.stream().filter(item -> item != null &&
                    !(groqRejected && "GROQ".equals(item.get("provider"))) &&
                    !(geminiRejected && "GEMINI".equals(item.get("provider")))).toList();
        }

        Double rawScore = OcrConfidence.rawScore(entity.getRawOcrConfidence(), entity.getRawOcrConfidenceSource());
        Double groqScore = OcrConfidence.advisorScore(entity.getGroqConfidence(), groqStatus, entity.getGroqConfidenceSource());
        Double geminiScore = OcrConfidence.advisorScore(entity.getGeminiConfidence(), geminiStatus, entity.getGeminiConfidenceSource());

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
                .rawOcrConfidence(rawScore)
                .rawOcrConfidenceSource(rawScore != null ? OcrConfidence.CRNN_CTC_SOFTMAX : null)
                .correctedText(entity.getCorrectedText())
                .correctionConfidence(null)
                .correctionApplied(entity.getCorrectionApplied())
                .correctionDecision(entity.getCorrectionDecision())
                .finalText(entity.getPredictedText())
                .groqSuggestion(groqRejected ? null : entity.getGroqSuggestion())
                .groqConfidence(groqScore)
                .groqConfidenceSource(groqScore != null ? OcrConfidence.AI_SELF_REPORTED : null)
                .groqDecision(groqRejected ? "KEEP_RAW" : entity.getGroqDecision())
                .groqStatus(groqStatus)
                .groqModel(entity.getGroqModel())
                .geminiSuggestion(geminiRejected ? null : entity.getGeminiSuggestion())
                .geminiConfidence(geminiScore)
                .geminiConfidenceSource(geminiScore != null ? OcrConfidence.AI_SELF_REPORTED : null)
                .geminiDecision(geminiRejected ? "KEEP_RAW" : entity.getGeminiDecision())
                .geminiStatus(geminiStatus)
                .geminiModel(entity.getGeminiModel())
                .suggestions(OcrConfidence.suggestions(safeSuggestions))
                .build();
    }

    private static boolean providerEvidenceRejected(java.util.List<java.util.Map<String, Object>> suggestions, String provider) {
        if (suggestions == null) return false;
        boolean hasExplicitFailure = false;
        for (java.util.Map<String, Object> suggestion : suggestions) {
            if (suggestion == null || !provider.equals(suggestion.get("provider"))) continue;
            String status = String.valueOf(suggestion.getOrDefault("status", "")).trim();
            if ("SUCCESS".equalsIgnoreCase(status)) return false;
            if (!status.isBlank()) hasExplicitFailure = true;
        }
        return hasExplicitFailure;
    }
}

