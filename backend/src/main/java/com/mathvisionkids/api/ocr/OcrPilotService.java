package com.mathvisionkids.api.ocr;

import com.mathvisionkids.api.common.ApiException;
import com.mathvisionkids.api.storage.ObjectStorageService;
import com.mathvisionkids.api.user.User;
import com.mathvisionkids.api.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;

@Service
public class OcrPilotService {

    private final OcrTrialRepository ocrTrialRepository;
    private final ObjectStorageService objectStorageService;
    private final OcrStorageVerifier ocrStorageVerifier;
    private final UserRepository userRepository;
    private final RestTemplate restTemplate;
    private final String aiServiceBaseUrl;
    private final String internalApiKey;

    public OcrPilotService(
            OcrTrialRepository ocrTrialRepository,
            ObjectStorageService objectStorageService,
            OcrStorageVerifier ocrStorageVerifier,
            UserRepository userRepository,
            @Value("${ai.service.base-url:${AI_SERVICE_URL:http://localhost:8000}}") String aiServiceBaseUrl,
            @Value("${ai.callback.api-key:${INTERNAL_API_KEY:secret-key-default}}") String internalApiKey) {
        this.ocrTrialRepository = ocrTrialRepository;
        this.objectStorageService = objectStorageService;
        this.ocrStorageVerifier = ocrStorageVerifier;
        this.userRepository = userRepository;
        this.aiServiceBaseUrl = aiServiceBaseUrl.replaceAll("/+$", "");
        this.internalApiKey = internalApiKey;
        this.restTemplate = new RestTemplate();
    }

    @Transactional
    public OcrTrialResponse createTrial(
            MultipartFile file, 
            String userEmail, 
            String source, 
            Boolean isTestData, 
            Boolean privacyConfirmed) {
        if (file == null || file.isEmpty()) {
            throw new ApiException("VALIDATION_ERROR", "Image file is required", HttpStatus.BAD_REQUEST);
        }

        User user = null;
        if (userEmail != null && !userEmail.isBlank()) {
            user = userRepository.findByEmail(userEmail).orElse(null);
        }

        try {
            byte[] imageBytes = file.getBytes();
            String sha256Hex = computeSha256(imageBytes);
            String contentType = file.getContentType() != null ? file.getContentType() : "image/jpeg";

            // 1. Store in MinIO
            String objectKey = objectStorageService.store(file, "ocr-trials");

            // 2. Synchronous internal call to CRNN OCR
            String targetUrl = aiServiceBaseUrl + "/internal/v1/ocr/recognize-line";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType.startsWith("image/") ? contentType : "image/jpeg"));
            headers.set("X-Internal-API-Key", internalApiKey);
            HttpEntity<byte[]> requestEntity = new HttpEntity<>(imageBytes, headers);

            ResponseEntity<Map<String, Object>> responseEntity = restTemplate.exchange(
                    targetUrl,
                    HttpMethod.POST,
                    requestEntity,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            if (!responseEntity.getStatusCode().is2xxSuccessful() || responseEntity.getBody() == null) {
                throw new ApiException("AI_SERVICE_ERROR", "Failed to recognize handwriting line", HttpStatus.BAD_GATEWAY);
            }

            Map<String, Object> aiData = responseEntity.getBody();
            String recognizedText = String.valueOf(aiData.getOrDefault("recognized_text", ""));
            String modelName = String.valueOf(aiData.getOrDefault("model_name", "Vietnamese-Handwriting-OCR-Full"));
            String modelVersion = String.valueOf(aiData.getOrDefault("model_version", "1.0.0"));
            String checkpointSha256 = String.valueOf(aiData.getOrDefault("checkpoint_sha256", ""));
            String vocabSha256 = String.valueOf(aiData.getOrDefault("vocab_sha256", ""));
            String prepVersion = String.valueOf(aiData.getOrDefault("preprocessing_version", "v1_resize_64x1024_imagenet"));

            // 3. Persist OcrTrial entity
            OcrTrial trial = new OcrTrial();
            trial.setUser(user);
            trial.setSource(source != null && !source.isBlank() ? source : "CAMERA");
            trial.setLineImageObjectKey(objectKey);
            trial.setLineImageSha256(sha256Hex);
            trial.setPredictedText(recognizedText);
            trial.setVerdict("UNVERIFIED");
            trial.setModelName(modelName);
            trial.setModelVersion(modelVersion);
            trial.setCheckpointSha256(checkpointSha256);
            trial.setVocabSha256(vocabSha256);
            trial.setPreprocessingVersion(prepVersion);
            trial.setDomain("HANDWRITING_TEXT");
            trial.setTestData(isTestData != null ? isTestData : false);
            trial.setDataOrigin(Boolean.TRUE.equals(isTestData) ? "AUTOMATED_TEST" : "PHYSICAL_USER");
            trial.setPrivacyConfirmed(privacyConfirmed != null ? privacyConfirmed : false);
            trial.setTrainingEligible(false);
            trial.setConfidence(null); // No fabricated confidence

            OcrTrial saved = ocrTrialRepository.save(trial);
            return OcrTrialResponse.fromEntity(saved);

        } catch (IOException e) {
            throw new ApiException("STORAGE_ERROR", "Failed to store image: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        } catch (Exception e) {
            if (e instanceof ApiException) throw (ApiException) e;
            throw new ApiException("AI_SERVICE_ERROR", "CRNN service unreachable: " + e.getMessage(), HttpStatus.BAD_GATEWAY);
        }
    }

    @Transactional(readOnly = true)
    public OcrTrialResponse getTrial(UUID trialId) {
        OcrTrial trial = ocrTrialRepository.findById(trialId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "OCR trial not found: " + trialId, HttpStatus.NOT_FOUND));
        return OcrTrialResponse.fromEntity(trial);
    }

    @Transactional
    public OcrTrialResponse recordFeedback(UUID trialId, String userEmail, OcrFeedbackRequest request) {
        OcrTrial trial = ocrTrialRepository.findById(trialId)
                .orElseThrow(() -> new ApiException("NOT_FOUND", "OCR trial not found: " + trialId, HttpStatus.NOT_FOUND));

        if (request.getVerdict() == null || request.getVerdict().isBlank()) {
            throw new ApiException("VALIDATION_ERROR", "Verdict is required (CORRECT, CORRECTED, SKIPPED)", HttpStatus.BAD_REQUEST);
        }

        String verdictUpper = request.getVerdict().trim().toUpperCase();
        if (!Set.of("CORRECT", "CORRECTED", "SKIPPED").contains(verdictUpper)) {
            throw new ApiException("VALIDATION_ERROR", "Verdict must be CORRECT, CORRECTED, or SKIPPED", HttpStatus.BAD_REQUEST);
        }

        // Apply explicit test flag if sent
        if (request.getIsTestData() != null) {
            trial.setTestData(request.getIsTestData());
            if (request.getIsTestData()) {
                trial.setDataOrigin("AUTOMATED_TEST");
            }
        }

        if ("CORRECTED".equals(verdictUpper)) {
            if (request.getVerifiedText() == null || request.getVerifiedText().trim().isEmpty()) {
                throw new ApiException("VALIDATION_ERROR", "Verified text cannot be empty for CORRECTED verdict", HttpStatus.BAD_REQUEST);
            }
            // PRESERVE EXACT RAW HUMAN INPUT (no trimming, no collapsing)
            trial.setVerifiedTextRaw(request.getVerifiedText());
            // Store separate trimmed / normalized form
            trial.setVerifiedTextNormalized(request.getVerifiedText().trim());
            trial.setVerdict("CORRECTED");

        } else if ("CORRECT".equals(verdictUpper)) {
            // Guard: if user passed explicit text for CORRECT, verify exact equality with predictedText
            if (request.getVerifiedText() != null && !request.getVerifiedText().isEmpty()) {
                if (!request.getVerifiedText().equals(trial.getPredictedText())) {
                    throw new ApiException(
                            "DATA_INTEGRITY_ERROR", 
                            "CORRECT verdict cannot contradict predicted text. If text differs, use CORRECTED verdict.", 
                            HttpStatus.BAD_REQUEST
                    );
                }
            }
            trial.setVerifiedTextRaw(trial.getPredictedText());
            trial.setVerifiedTextNormalized(trial.getPredictedText() != null ? trial.getPredictedText().trim() : null);
            trial.setVerdict("CORRECT");

        } else { // SKIPPED
            trial.setVerifiedTextRaw(null);
            trial.setVerifiedTextNormalized(null);
            trial.setVerdict("SKIPPED");
            trial.setTrainingEligible(false);
        }

        boolean eligible = trial.isPrivacyConfirmed()
                && !trial.isTestData()
                && "HANDWRITING_TEXT".equals(trial.getDomain())
                && ("CORRECT".equals(verdictUpper) || "CORRECTED".equals(verdictUpper))
                && trial.getVerifiedTextRaw() != null
                && !trial.getVerifiedTextRaw().trim().isEmpty()
                && trial.getLineImageObjectKey() != null
                && !trial.getLineImageObjectKey().trim().isEmpty()
                && trial.getLineImageSha256() != null
                && trial.getLineImageSha256().matches("^[a-fA-F0-9]{64}$");

        if ("CORRECT".equals(verdictUpper)) {
            eligible = eligible && trial.getVerifiedTextRaw().equals(trial.getPredictedText());
        }

        if (eligible) {
            eligible = ocrStorageVerifier.verifyStorageIntegrity(
                    trial.getLineImageObjectKey(),
                    trial.getLineImageSha256()
            );
        }

        trial.setTrainingEligible(eligible);

        trial.setFeedbackAt(Instant.now());
        OcrTrial updated = ocrTrialRepository.save(trial);
        return OcrTrialResponse.fromEntity(updated);
    }

    @Transactional(readOnly = true)
    public OcrMetricsResponse getMetrics() {
        // Exclude all test/synthetic data from official metrics
        long total = ocrTrialRepository.countByIsTestDataFalse();
        long correct = ocrTrialRepository.countByVerdictAndIsTestDataFalse("CORRECT");
        long corrected = ocrTrialRepository.countByVerdictAndIsTestDataFalse("CORRECTED");
        long skipped = ocrTrialRepository.countByVerdictAndIsTestDataFalse("SKIPPED");
        long unverified = ocrTrialRepository.countByVerdictAndIsTestDataFalse("UNVERIFIED");
        long verifiedTotal = correct + corrected;

        List<OcrTrial> verifiedTrialsList = ocrTrialRepository.findByVerdictInAndIsTestDataFalse(List.of("CORRECT", "CORRECTED"));

        // Recompute dynamic Exact Match equality: predictedText == verifiedTextRaw
        long exactMatches = 0;
        int totalEditDistance = 0;
        int totalGroundTruthChars = 0;

        for (OcrTrial t : verifiedTrialsList) {
            String pred = t.getPredictedText() != null ? t.getPredictedText() : "";
            String raw = t.getVerifiedTextRaw() != null ? t.getVerifiedTextRaw() : "";

            if (pred.equals(raw)) {
                exactMatches++;
            }

            int dist = computeLevenshteinDistance(pred, raw);
            totalEditDistance += dist;
            totalGroundTruthChars += raw.length();
        }

        Double exactMatchRate = null;
        String percentageStr = "N/A";
        if (verifiedTotal > 0) {
            exactMatchRate = (double) exactMatches / verifiedTotal;
            percentageStr = String.format(Locale.US, "%.1f%%", exactMatchRate * 100.0);
        }

        Double cer = null;
        String cerPercentage = "N/A";
        if (totalGroundTruthChars > 0) {
            cer = (double) totalEditDistance / totalGroundTruthChars;
            cerPercentage = String.format(Locale.US, "%.1f%%", cer * 100.0);
        } else if (verifiedTotal > 0) {
            cer = 0.0;
            cerPercentage = "0.0%";
        }

        return OcrMetricsResponse.builder()
                .totalTrials(total)
                .verifiedTrials(verifiedTotal)
                .correctCount(correct)
                .correctedCount(corrected)
                .skippedCount(skipped)
                .unverifiedCount(unverified)
                .exactMatchRate(exactMatchRate)
                .exactMatchPercentage(percentageStr)
                .characterErrorRate(cer)
                .cerPercentage(cerPercentage)
                .domain("HANDWRITING_TEXT")
                .evaluationScope("User-verified pilot handwriting samples (excluding test/synthetic/skipped)")
                .build();
    }

    private static int computeLevenshteinDistance(String s1, String s2) {
        int[][] dp = new int[s1.length() + 1][s2.length() + 1];

        for (int i = 0; i <= s1.length(); i++) {
            dp[i][0] = i;
        }
        for (int j = 0; j <= s2.length(); j++) {
            dp[0][j] = j;
        }

        for (int i = 1; i <= s1.length(); i++) {
            for (int j = 1; j <= s2.length(); j++) {
                int cost = (s1.charAt(i - 1) == s2.charAt(j - 1)) ? 0 : 1;
                dp[i][j] = Math.min(
                        Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1),
                        dp[i - 1][j - 1] + cost
                );
            }
        }
        return dp[s1.length()][s2.length()];
    }

    private String computeSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm missing", e);
        }
    }
}
