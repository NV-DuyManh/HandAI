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
public class AdminClassSummary {
    private UUID classId;
    private String name;
    private Integer gradeLevel;
    private String academicYear;
}
