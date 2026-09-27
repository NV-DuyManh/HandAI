package com.mathvisionkids.api.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminAuditEventResponse {
    private UUID auditEventId;
    private String eventType;
    private UUID actorUserId;
    private String actorEmail;
    private Map<String, Object> metadata;
    private Instant createdAt;
}
