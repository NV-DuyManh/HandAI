package com.mathvisionkids.api.classroom;

import com.mathvisionkids.api.user.UserResponse;
import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
public class ClassroomResponse {
    private UUID classId;
    private String name;
    private Integer gradeLevel;
    private String academicYear;
    private List<UserResponse> students;
}
