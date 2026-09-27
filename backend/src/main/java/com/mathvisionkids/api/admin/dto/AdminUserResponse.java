package com.mathvisionkids.api.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminUserResponse {
    private UUID userId;
    private String email;
    private String displayName;
    private String role;
    private Integer gradeLevel;
    private Boolean active;
    private Instant createdAt;
    private Instant updatedAt;
    private List<AdminClassSummary> classes;
}
