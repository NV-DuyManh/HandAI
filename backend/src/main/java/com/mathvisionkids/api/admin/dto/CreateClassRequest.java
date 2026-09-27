package com.mathvisionkids.api.admin.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
public class CreateClassRequest {
    @NotBlank(message = "Class name is required")
    private String name;

    @NotNull(message = "Grade level is required")
    @Min(value = 1, message = "Grade level must be between 1 and 5")
    @Max(value = 5, message = "Grade level must be between 1 and 5")
    private Integer gradeLevel;

    private String academicYear;

    @NotNull(message = "Teacher ID is required")
    private UUID teacherId;
}
