package com.mathvisionkids.api.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminUserSummary {
    private UUID userId;
    private String email;
    private String displayName;
    private String role;
    private Integer gradeLevel;
    private Boolean active;
}
