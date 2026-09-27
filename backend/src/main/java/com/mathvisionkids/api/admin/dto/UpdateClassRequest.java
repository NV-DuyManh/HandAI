package com.mathvisionkids.api.admin.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UpdateClassRequest {
    private String name;

    @Min(value = 1, message = "Grade level must be between 1 and 5")
    @Max(value = 5, message = "Grade level must be between 1 and 5")
    private Integer gradeLevel;

    private String academicYear;
}
