package com.mathvisionkids.api.ocr;

import com.mathvisionkids.api.ocr.multiline.MultilineLineResponse;
import com.mathvisionkids.api.ocr.multiline.OcrMultilineLine;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class OcrConfidenceTest {
    @Test
    void acceptsOnlyFiniteUnitScoresWithKnownProvenance() {
        assertEquals(0.0, OcrConfidence.rawScore(0.0, "CRNN_CTC_SOFTMAX"));
        assertEquals(1.0, OcrConfidence.rawScore(1.0, "CRNN_CTC_SOFTMAX"));
        assertEquals(0.842, OcrConfidence.rawScore(0.842, "CRNN_CTC_SOFTMAX"));
        for (Object value : List.of(-0.01, 1.01, Double.NaN, Double.POSITIVE_INFINITY, "0.97")) {
            assertNull(OcrConfidence.rawScore(value, "CRNN_CTC_SOFTMAX"));
        }
        assertNull(OcrConfidence.rawScore(null, "CRNN_CTC_SOFTMAX"));
        assertNull(OcrConfidence.rawScore(0.97, null));
        assertNull(OcrConfidence.rawScore(0.97, "CRNN"));
        assertEquals(0.86, OcrConfidence.advisorScore(0.86, "SUCCESS", "AI_SELF_REPORTED"));
        assertNull(OcrConfidence.advisorScore(0.86, "UNAVAILABLE", "AI_SELF_REPORTED"));
        assertNull(OcrConfidence.advisorScore(0.86, "SUCCESS", null));
    }

    @Test
    void legacyScoresAreNotRelabeledAsMeasuredInResponses() {
        OcrMultilineLine line = new OcrMultilineLine();
        line.setRawOcrConfidence(0.97);
        line.setGroqConfidence(0.99);
        line.setGroqStatus("SUCCESS");
        line.setCorrectionConfidence(0.99);
        line.setSuggestionsJson("[{\"confidence\":0.99,\"status\":\"SUCCESS\"}]");
        MultilineLineResponse response = MultilineLineResponse.fromEntity(line);
        assertNull(response.getRawOcrConfidence());
        assertNull(response.getRawOcrConfidenceSource());
        assertNull(response.getGroqConfidence());
        assertNull(response.getGroqConfidenceSource());
        assertNull(response.getCorrectionConfidence());
        assertNull(response.getSuggestions().get(0).get("confidence"));
        assertEquals(0.97, line.getRawOcrConfidence());

        OcrTrial trial = new OcrTrial();
        trial.setConfidence(new BigDecimal("0.97"));
        assertNull(OcrTrialResponse.fromEntity(trial).getConfidence());
        trial.setConfidenceSource("CRNN_CTC_SOFTMAX");
        assertEquals(new BigDecimal("0.97"), OcrTrialResponse.fromEntity(trial).getConfidence());
    }

    @Test
    void suggestionScoresRemainAbsentWhenStatusOrNumericValueIsInvalid() {
        List<Map<String, Object>> suggestions = OcrConfidence.suggestions(List.of(
                Map.of("confidence", 0.87, "status", "SUCCESS", "confidenceSource", "AI_SELF_REPORTED"),
                Map.of("confidence", Double.NaN, "status", "SUCCESS", "confidenceSource", "AI_SELF_REPORTED"),
                Map.of("confidence", 0.87, "status", 1, "confidenceSource", "AI_SELF_REPORTED")
        ));
        assertEquals(0.87, suggestions.get(0).get("confidence"));
        assertNull(suggestions.get(1).get("confidence"));
        assertNull(suggestions.get(2).get("confidence"));
    }
}
