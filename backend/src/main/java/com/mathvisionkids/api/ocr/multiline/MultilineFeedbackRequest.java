package com.mathvisionkids.api.ocr.multiline;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MultilineFeedbackRequest {
    private String verdict;
    private String verifiedText;
    private Boolean isTestData;
}
