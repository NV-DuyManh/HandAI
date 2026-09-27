package com.mathvisionkids.api.auth.sso;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SsoExchangeRequest {
    @NotBlank(message = "code is required")
    private String code;

    private String targetApp;
}
