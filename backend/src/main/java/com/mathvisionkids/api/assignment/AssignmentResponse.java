package com.mathvisionkids.api.assignment;

import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
public class AssignmentResponse {
    private UUID assignmentId;
    private UUID classId;
    private String title;
    private String operationType;
    private Integer maxScore;
    private String status;
    private Instant createdAt;
}
