package com.mathvisionkids.api.submission;

import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
public class SubmissionResponse {
    private UUID submissionId;
    private String status;
    private String reasonCode;
    private java.util.Map<String, Object> diagnostics;
    private String flowDomain = "ARITHMETIC";
    private Instant createdAt;
}
