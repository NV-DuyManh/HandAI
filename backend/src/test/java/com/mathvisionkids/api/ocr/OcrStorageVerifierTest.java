package com.mathvisionkids.api.ocr;

import com.mathvisionkids.api.storage.ObjectStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class OcrStorageVerifierTest {

    @Mock
    private ObjectStorageService objectStorageService;

    private OcrStorageVerifier verifier;

    @BeforeEach
    void setUp() {
        verifier = new OcrStorageVerifier(objectStorageService);
    }

    @Test
    void testValidObjectAndMatchingShaReturnsTrue() throws Exception {
        byte[] sampleBytes = "test-image-content".getBytes(StandardCharsets.UTF_8);
        String expectedSha = verifier.computeSha256(sampleBytes);
        assertEquals(64, expectedSha.length());

        when(objectStorageService.loadBytes("ocr-trials/sample.jpg")).thenReturn(sampleBytes);

        boolean result = verifier.verifyStorageIntegrity("ocr-trials/sample.jpg", expectedSha);
        assertTrue(result, "Storage integrity must pass when bytes and SHA match");
    }

    @Test
    void testMissingObjectReturnsFalse() throws Exception {
        when(objectStorageService.loadBytes("ocr-trials/missing.jpg"))
                .thenThrow(new IOException("Object not found in storage"));

        boolean result = verifier.verifyStorageIntegrity("ocr-trials/missing.jpg", "a".repeat(64));
        assertFalse(result, "Missing object must fail gracefully without throwing");
    }

    @Test
    void testStorageExceptionReturnsFalse() throws Exception {
        when(objectStorageService.loadBytes("ocr-trials/error.jpg"))
                .thenThrow(new RuntimeException("MinIO connection reset"));

        boolean result = verifier.verifyStorageIntegrity("ocr-trials/error.jpg", "a".repeat(64));
        assertFalse(result, "Storage exception must fail gracefully without throwing");
    }

    @Test
    void testShaMismatchReturnsFalse() throws Exception {
        byte[] sampleBytes = "actual-bytes".getBytes(StandardCharsets.UTF_8);
        when(objectStorageService.loadBytes("ocr-trials/corrupt.jpg")).thenReturn(sampleBytes);

        String wrongSha = "b".repeat(64);
        boolean result = verifier.verifyStorageIntegrity("ocr-trials/corrupt.jpg", wrongSha);
        assertFalse(result, "SHA mismatch must fail integrity verification");
    }

    @Test
    void testNullOrEmptyObjectKeyReturnsFalse() {
        assertFalse(verifier.verifyStorageIntegrity(null, "a".repeat(64)));
        assertFalse(verifier.verifyStorageIntegrity("   ", "a".repeat(64)));
    }

    @Test
    void testInvalidShaLengthReturnsFalse() {
        assertFalse(verifier.verifyStorageIntegrity("ocr-trials/sample.jpg", null));
        assertFalse(verifier.verifyStorageIntegrity("ocr-trials/sample.jpg", "short-sha"));
        assertFalse(verifier.verifyStorageIntegrity("ocr-trials/sample.jpg", "c".repeat(65)));
        assertFalse(verifier.verifyStorageIntegrity("ocr-trials/sample.jpg", "z".repeat(64)));
    }

    @Test
    void testEmptyRetrievedBytesReturnsFalse() throws Exception {
        when(objectStorageService.loadBytes("ocr-trials/empty.jpg")).thenReturn(new byte[0]);

        boolean result = verifier.verifyStorageIntegrity("ocr-trials/empty.jpg", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        assertFalse(result, "Empty byte array must fail integrity check");
    }
}
