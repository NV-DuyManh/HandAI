package com.mathvisionkids.api.admin.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CreateUserRequest {
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Display name is required")
    private String displayName;

    @NotBlank(message = "Role is required")
    private String role; // STUDENT or TEACHER

    @NotBlank(message = "Initial password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String initialPassword;

    private Integer gradeLevel; // 1..5 (for STUDENT only)
}
