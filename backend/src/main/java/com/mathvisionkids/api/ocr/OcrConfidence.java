package com.mathvisionkids.api.ocr;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Validates model scores and their provenance without inventing missing values. */
public final class OcrConfidence {
    public static final String CRNN_CTC_SOFTMAX = "CRNN_CTC_SOFTMAX";
    public static final String AI_SELF_REPORTED = "AI_SELF_REPORTED";

    private OcrConfidence() {}

    public static Double rawScore(Object value, Object source) {
        return CRNN_CTC_SOFTMAX.equals(source) ? validScore(value) : null;
    }

    public static Double advisorScore(Object value, Object status, Object source) {
        return "SUCCESS".equals(status) && AI_SELF_REPORTED.equals(source) ? validScore(value) : null;
    }

    private static Double validScore(Object value) {
        if (!(value instanceof Number number)) return null;
        double score = number.doubleValue();
        return Double.isFinite(score) && score >= 0.0 && score <= 1.0 ? score : null;
    }

    public static List<Map<String, Object>> suggestions(List<Map<String, Object>> suggestions) {
        if (suggestions == null) return null;
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> suggestion : suggestions) {
            if (suggestion == null) continue;
            Map<String, Object> copy = new LinkedHashMap<>(suggestion);
            Double score = advisorScore(copy.get("confidence"), copy.get("status"), copy.get("confidenceSource"));
            copy.put("confidence", score);
            copy.put("confidenceSource", score != null ? AI_SELF_REPORTED : null);
            result.add(copy);
        }
        return result;
    }
}
