package com.mathvisionkids.api.auth.sso;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SsoTicketResponse {
    private String code;
    private int expiresIn;
    private String targetApp;
}
