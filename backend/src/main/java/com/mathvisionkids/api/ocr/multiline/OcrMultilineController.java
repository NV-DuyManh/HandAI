package com.mathvisionkids.api.ocr.multiline;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ocr/multiline")
public class OcrMultilineController {

    private final OcrMultilineService multilineService;

    public OcrMultilineController(OcrMultilineService multilineService) {
        this.multilineService = multilineService;
    }

    @PostMapping("/detect")
    public ResponseEntity<MultilineDetectResponse> detectLines(
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "privacyConfirmed", required = false, defaultValue = "false") Boolean privacyConfirmed,
            @RequestParam(value = "forceRedetect", required = false, defaultValue = "false") Boolean forceRedetect,
            HttpServletRequest request) {
        String requestId = resolveRequestId(request);
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
            Principal principal,
            HttpServletRequest request) {
        String email = principal != null ? principal.getName() : null;
        String requestId = resolveRequestId(request);

        MultipartFile file = (image != null && !image.isEmpty()) ? image : filePart;
        String source = (metadataDto != null && metadataDto.getSource() != null)
                ? metadataDto.getSource()
                : (sourceParam != null ? sourceParam : "CAMERA");
        Boolean privacyConfirmed = (metadataDto != null && metadataDto.getPrivacyConfirmed() != null)
                ? metadataDto.getPrivacyConfirmed()
                : (privacyConfirmedParam != null ? privacyConfirmedParam : false);

        MultilineTrialResponse response;
        if (metadataDto != null && metadataDto.getConfirmedLines() != null) {
            response = multilineService.createTrialAndRecognize(
                    file, email, source, privacyConfirmed, metadataDto.getConfirmedLines(), requestId
            );
        } else {
            response = multilineService.createTrialAndRecognize(
                    file, email, source, privacyConfirmed, confirmedLinesParam, requestId
            );
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    private String resolveRequestId(HttpServletRequest request) {
        if (request == null) return null;
        String reqId = (String) request.getAttribute("X-Request-ID");
        if (reqId == null || reqId.isBlank()) {
            reqId = request.getHeader("X-Request-ID");
        }
        return reqId;
    }

    @GetMapping("/trials/{trialId}")
    public ResponseEntity<MultilineTrialResponse> getTrial(@PathVariable UUID trialId) {
        MultilineTrialResponse response = multilineService.getTrial(trialId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/trials/{trialId}/lines/{lineId}/feedback")
    public ResponseEntity<MultilineLineResponse> recordLineFeedback(
            @PathVariable UUID trialId,
            @PathVariable UUID lineId,
            @RequestBody MultilineFeedbackRequest request,
            Principal principal) {
        String email = principal != null ? principal.getName() : null;
        MultilineLineResponse response = multilineService.recordLineFeedback(trialId, lineId, email, request);
        return ResponseEntity.ok(response);
    }
}
