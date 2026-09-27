package com.mathvisionkids.api.admin.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UpdateUserRequest {
    private String displayName;
    private Integer gradeLevel; // applicable only if role is STUDENT
}
