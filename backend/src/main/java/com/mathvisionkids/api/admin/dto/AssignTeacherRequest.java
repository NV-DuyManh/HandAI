package com.mathvisionkids.api.admin.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
public class AssignTeacherRequest {
    @NotNull(message = "Teacher ID is required")
    private UUID teacherId;
}
