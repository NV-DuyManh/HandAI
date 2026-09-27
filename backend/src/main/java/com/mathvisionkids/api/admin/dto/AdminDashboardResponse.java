package com.mathvisionkids.api.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminDashboardResponse {
    private long totalStudents;
    private long activeStudents;
    private long disabledStudents;

    private long totalTeachers;
    private long activeTeachers;
    private long disabledTeachers;

    private long totalClasses;
}
