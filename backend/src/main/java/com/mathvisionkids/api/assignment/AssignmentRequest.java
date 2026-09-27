package com.mathvisionkids.api.assignment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.UUID;

@Data
public class AssignmentRequest {
    @NotNull
    private UUID classId;
    
    @NotBlank
    private String title;
    
    @NotBlank
    private String operationType;
    
    @NotNull
    private Integer maxScore;
}
