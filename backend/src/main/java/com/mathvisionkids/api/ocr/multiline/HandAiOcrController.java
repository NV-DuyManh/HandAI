package com.mathvisionkids.api.ocr.multiline;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

/**
 * Isolated guest endpoint for HandAI Big Data Demonstration Mode.
 *
 * Requirements (HAND_AI_FLOW_FIX_V8_BACKEND_RUNTIME_SECURITY_DEBUG):
 * - Standalone research demonstration mode.
 * - No student login, no JWT requirement, no role guard.
 * - Permits unauthenticated guest access exclusively for handwriting recognition.
 * - MathVision Kids (/api/v1/ocr/**) remains 100% protected under ROLE_STUDENT.
 */
@RestController
@RequestMapping("/api/v1/handai/ocr/multiline")
public class HandAiOcrController {

    private static final Logger log = LoggerFactory.getLogger(HandAiOcrController.class);
    private final OcrMultilineService multilineService;

    public HandAiOcrController(OcrMultilineService multilineService) {
        this.multilineService = multilineService;
    }

    @PostConstruct
    public void init() {
        log.info("\n[HAND_AI_SECURITY]\nGuest endpoint enabled:\ntrue");
        log.info("\n[HAND_AI_MAPPING]\nregistered endpoints:\n- POST /api/v1/handai/ocr/multiline/detect\n- POST /api/v1/handai/ocr/multiline/trials\n- GET  /api/v1/handai/ocr/multiline/trials/{trialId}\n- POST /api/v1/handai/ocr/multiline/trials/{trialId}/lines/{lineId}/feedback\n- GET  /api/v1/handai/ocr/multiline/health\n- GET  /api/v1/handai/health\n- POST /api/v1/handai/health");
        log.info("HandAiOcrController initialized.");
    }

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

    @PostMapping("/detect")
    public ResponseEntity<MultilineDetectResponse> detectLines(
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "privacyConfirmed", required = false, defaultValue = "true") Boolean privacyConfirmed,
            @RequestParam(value = "forceRedetect", required = false, defaultValue = "false") Boolean forceRedetect,
            HttpServletRequest request) {
        String requestId = resolveRequestId(request);
        log.info("[HAND_AI_GUEST] Processing guest detectLines request. requestId={}", requestId);
        MultilineDetectResponse response = multilineService.detectLines(image, privacyConfirmed, forceRedetect, requestId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/trials")
    public ResponseEntity<MultilineTrialResponse> createTrial(
            @RequestParam(value = "image", required = false) MultipartFile image,
            @RequestPart(value = "file", required = false) MultipartFile filePart,
            @RequestParam(value = "source", required = false) String sourceParam,
            @RequestParam(value = "privacyConfirmed", required = false) Boolean privacyConfirmedParam,
            @RequestParam(value = "confirmedLines", required = false) String confirmedLinesParam,
            @RequestPart(value = "metadata", required = false) MultilineTrialMetadataDto metadataDto,
            HttpServletRequest request) {
        String requestId = resolveRequestId(request);
        log.info("[HAND_AI_GUEST] Processing guest createTrial request. requestId={}", requestId);

        MultipartFile file = (image != null && !image.isEmpty()) ? image : filePart;
        String source = (metadataDto != null && metadataDto.getSource() != null)
                ? metadataDto.getSource()
                : (sourceParam != null ? sourceParam : "CAMERA");
        Boolean privacyConfirmed = (metadataDto != null && metadataDto.getPrivacyConfirmed() != null)
                ? metadataDto.getPrivacyConfirmed()
                : (privacyConfirmedParam != null ? privacyConfirmedParam : true);

        // Guest mode: unauthenticated demo user (no student account / JWT required)
        String guestEmail = null;

        MultilineTrialResponse response;
        if (metadataDto != null && metadataDto.getConfirmedLines() != null) {
            response = multilineService.createTrialAndRecognize(
                    file, guestEmail, source, privacyConfirmed, metadataDto.getConfirmedLines(), requestId
            );
        } else {
            response = multilineService.createTrialAndRecognize(
                    file, guestEmail, source, privacyConfirmed, confirmedLinesParam, requestId
            );
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/trials/{trialId}")
    public ResponseEntity<MultilineTrialResponse> getTrial(@PathVariable UUID trialId) {
        log.info("[HAND_AI_GUEST] Processing guest getTrial request for trialId={}", trialId);
        MultilineTrialResponse response = multilineService.getTrial(trialId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/trials/{trialId}/lines/{lineId}/feedback")
    public ResponseEntity<MultilineLineResponse> recordLineFeedback(
            @PathVariable UUID trialId,
            @PathVariable UUID lineId,
            @RequestBody MultilineFeedbackRequest request) {
        log.info("[HAND_AI_GUEST] Processing guest line feedback for trialId={}, lineId={}", trialId, lineId);
        MultilineLineResponse response = multilineService.recordLineFeedback(trialId, lineId, null, request);
        return ResponseEntity.ok(response);
    }

    private String resolveRequestId(HttpServletRequest request) {
        if (request == null) return null;
        String reqId = (String) request.getAttribute("X-Request-ID");
        if (reqId == null || reqId.isBlank()) {
            reqId = request.getHeader("X-Request-ID");
        }
        return reqId;
    }
}
