package com.mathvisionkids.api.ocr;

import com.mathvisionkids.api.storage.ObjectStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Storage integrity verifier for OCR training eligibility.
 * Verifies that the referenced image/crop exists in object storage,
 * can be retrieved into memory, and that its computed SHA-256 matches
 * the database record byte-for-byte.
 */
@Component
public class OcrStorageVerifier {

    private static final Logger logger = LoggerFactory.getLogger(OcrStorageVerifier.class);
    private final ObjectStorageService objectStorageService;

    public OcrStorageVerifier(ObjectStorageService objectStorageService) {
        this.objectStorageService = objectStorageService;
    }

    /**
     * Checks if the object exists in storage and its content SHA-256 matches expectedSha256.
     * Never throws exceptions outwards; returns false on missing object, read error, or SHA mismatch.
     *
     * @param objectKey the object key in storage
     * @param expectedSha256 the recorded 64-character SHA-256 hex string
     * @return true if object exists and matches hash byte-for-byte; false otherwise
     */
    public boolean verifyStorageIntegrity(String objectKey, String expectedSha256) {
        if (objectKey == null || objectKey.trim().isEmpty() || expectedSha256 == null || !expectedSha256.matches("^[a-fA-F0-9]{64}$")) {
            logger.warn("Storage integrity check skipped: invalid objectKey or expected SHA metadata format");
            return false;
        }

        try {
            byte[] bytes = objectStorageService.loadBytes(objectKey);
            if (bytes == null || bytes.length == 0) {
                logger.warn("Storage integrity check failed: object is empty or unreadable for key={}", objectKey);
                return false;
            }

            String actualSha256 = computeSha256(bytes);
            boolean matches = actualSha256.equalsIgnoreCase(expectedSha256);
            if (!matches) {
                logger.warn("Storage integrity check failed: SHA256 mismatch for key={}", objectKey);
            }
            return matches;
        } catch (Exception e) {
            logger.warn("Storage integrity check failed with exception for key={}: {}", objectKey, e.getMessage());
            return false;
        }
    }

    public String computeSha256(byte[] data) {
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
