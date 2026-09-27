package com.mathvisionkids.api.user;

import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
public class UserResponse {
    private UUID userId;
    private String email;
    private String role;
    private String displayName;
    private Boolean active;
    private Instant createdAt;
    private Instant updatedAt;
    
    // Additional fields for student/teacher
    private Integer gradeLevel;
}
