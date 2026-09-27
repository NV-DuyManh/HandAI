package com.mathvisionkids.api.ocr.multiline;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class MultilineDetectResponse {
    private int width;
    private int height;
    private List<LineBoxDto> lines;
    private String detectorVersion;
    private Map<String, Object> diagnostics;
}
