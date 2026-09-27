package com.mathvisionkids.api.ocr.multiline;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Guest health check endpoint for HandAI Big Data demo.
 *
 * Requirements (HAND_AI_FLOW_FIX_V8_BACKEND_RUNTIME_SECURITY_DEBUG):
 * - GET or POST /api/v1/handai/health
 * - Expected: HTTP 200 without JWT
 */
@RestController
@RequestMapping("/api/v1/handai")
public class HandAiHealthController {

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthGet() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "mode", "HAND_AI_GUEST",
                "guestOcrEnabled", true
        ));
    }

    @PostMapping("/health")
    public ResponseEntity<Map<String, Object>> healthPost() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "mode", "HAND_AI_GUEST",
                "guestOcrEnabled", true
        ));
    }
}
