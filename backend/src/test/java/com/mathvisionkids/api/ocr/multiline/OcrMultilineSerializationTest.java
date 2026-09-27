package com.mathvisionkids.api.ocr.multiline;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class OcrMultilineSerializationTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void testDualAdvisorSerialization_AllFieldsPreserved() throws Exception {
        LineBoxDto line = new LineBoxDto();
        line.setLineId("line-01");
        line.setX(10);
        line.setY(20);
        line.setWidth(200);
        line.setHeight(40);
        line.setOrder(1);

        line.setRawOcrText("em yeu mua he");
        line.setRawOcrConfidence(0.72);
        line.setCorrectedText("Em yêu mùa hè");
        line.setCorrectionConfidence(0.92);
        line.setCorrectionApplied(true);
        line.setCorrectionDecision("AUTO_APPLY_SAFE");
        line.setFinalText("Em yêu mùa hè");
        line.setPredictedText("Em yêu mùa hè");

        line.setGroqSuggestion("Em yêu mùa hè");
        line.setGroqConfidence(0.90);
        line.setGroqDecision("SUGGEST_ONLY");
        line.setGroqStatus("SUCCESS");

        line.setGeminiSuggestion("Em yêu mùa hè");
        line.setGeminiConfidence(0.95);
        line.setGeminiDecision("SUGGEST_ONLY");
        line.setGeminiStatus("SUCCESS");

        line.setSuggestions(List.of(
                Map.of("provider", "GROQ", "text", "Em yêu mùa hè", "confidence", 0.90, "status", "SUCCESS"),
                Map.of("provider", "GEMINI", "text", "Em yêu mùa hè", "confidence", 0.95, "status", "SUCCESS")
        ));

        // Serialize to JSON
        String json = objectMapper.writeValueAsString(line);

        // Verify JSON representation
        assertTrue(json.contains("\"rawOcrText\":\"em yeu mua he\""));
        assertTrue(json.contains("\"rawOcrConfidence\":0.72"));
        assertTrue(json.contains("\"groqSuggestion\":\"Em yêu mùa hè\""));
        assertTrue(json.contains("\"geminiSuggestion\":\"Em yêu mùa hè\""));
        assertTrue(json.contains("\"finalText\":\"Em yêu mùa hè\""));
        assertTrue(json.contains("\"predictedText\":\"Em yêu mùa hè\""));
        assertTrue(json.contains("\"suggestions\":["));

        // Deserialize back
        LineBoxDto deserialized = objectMapper.readValue(json, LineBoxDto.class);
        assertEquals("em yeu mua he", deserialized.getRawOcrText());
        assertEquals(0.72, deserialized.getRawOcrConfidence());
        assertEquals("Em yêu mùa hè", deserialized.getGroqSuggestion());
        assertEquals("Em yêu mùa hè", deserialized.getGeminiSuggestion());
        assertEquals("Em yêu mùa hè", deserialized.getFinalText());
        assertEquals("Em yêu mùa hè", deserialized.getPredictedText());
        assertEquals(2, deserialized.getSuggestions().size());
    }

    @Test
    void testMultilineDetectResponse_RequestIdAndLinesPreserved() throws Exception {
        LineBoxDto line = new LineBoxDto("l1", 0, 0, 100, 30, 1, "text");
        line.setRawOcrText("raw");
        line.setFinalText("final");

        MultilineDetectResponse response = MultilineDetectResponse.builder()
                .width(400)
                .height(200)
                .lines(List.of(line))
                .detectorVersion("runtime6")
                .diagnostics(Map.of("requestId", "req-test-12345"))
                .build();

        String json = objectMapper.writeValueAsString(response);
        assertTrue(json.contains("\"requestId\":\"req-test-12345\""));
        assertTrue(json.contains("\"lines\":["));

        MultilineDetectResponse roundtrip = objectMapper.readValue(json, MultilineDetectResponse.class);
        assertEquals("req-test-12345", roundtrip.getDiagnostics().get("requestId"));
        assertEquals(1, roundtrip.getLines().size());
        assertEquals("raw", roundtrip.getLines().get(0).getRawOcrText());
    }

    @Test
    void testRawOcrTextImmutability_contract() {
        LineBoxDto line = new LineBoxDto();
        line.setRawOcrText("raw CRNN line");
        line.setFinalText("raw CRNN line");
        line.setPredictedText("raw CRNN line");

        // Changing finalText or predictedText never alters rawOcrText
        line.setFinalText("user edited text");
        line.setPredictedText("user edited text");

        assertEquals("raw CRNN line", line.getRawOcrText());
        assertEquals("user edited text", line.getFinalText());
        assertEquals("user edited text", line.getPredictedText());
    }
}
