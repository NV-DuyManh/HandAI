package com.mathvisionkids.api.auth.sso;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SsoTicketRequest {
    @NotBlank(message = "targetApp is required (TEACHER or ADMIN)")
    private String targetApp;
}
