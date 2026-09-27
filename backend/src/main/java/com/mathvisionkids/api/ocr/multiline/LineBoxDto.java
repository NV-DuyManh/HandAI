package com.mathvisionkids.api.ocr.multiline;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class LineBoxDto {
    @JsonProperty("line_id")
    private String lineId;
    private int x;
    private int y;
    private int width;
    private int height;
    private int order;
    private String text;

    private String rawOcrText;
    private Double rawOcrConfidence;
    private String correctedText;
    private Double correctionConfidence;
    private Boolean correctionApplied;
    private String correctionDecision;
    private String finalText;
    private String predictedText;

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

    public LineBoxDto(String lineId, int x, int y, int width, int height, int order, String text) {
        this.lineId = lineId;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.order = order;
        this.text = text;
    }
}


