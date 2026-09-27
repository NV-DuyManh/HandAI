package com.mathvisionkids.api.ocr.multiline;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class MultilineTrialMetadataDto {
    private String source;
    private Boolean privacyConfirmed;
    private List<LineBoxDto> confirmedLines;
}
