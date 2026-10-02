package com.mathvisionkids.api.ocr.multiline;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathvisionkids.api.storage.ObjectStorageService;
import com.mathvisionkids.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class OcrMultilineServiceTest {

    @Mock
    private OcrMultilineTrialRepository trialRepository;

    @Mock
    private OcrMultilineLineRepository lineRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ObjectStorageService objectStorageService;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private com.mathvisionkids.api.ocr.OcrStorageVerifier ocrStorageVerifier;

    private OcrMultilineService service;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        service = new OcrMultilineService(
                trialRepository,
                lineRepository,
                objectStorageService,
                ocrStorageVerifier,
                userRepository,
                objectMapper,
                "http://localhost:8000",
                "secret-key-default",
                "REAL_FEEDBACK"
        );
        // Inject the mocked RestTemplate into the service
        ReflectionTestUtils.setField(service, "restTemplate", restTemplate);
    }

    @Test
    @SuppressWarnings("unchecked")
    void testManualLineSerialization_exactBoxesProcessed() throws Exception {
        // Simulating the user discarding auto-boxes and creating exactly 4 manual boxes
        String manualLinesJson = "[" +
                "{\"line_id\": \"manual_1\", \"x\": 10, \"y\": 100, \"width\": 200, \"height\": 50, \"order\": 1}," +
                "{\"line_id\": \"manual_2\", \"x\": 10, \"y\": 160, \"width\": 200, \"height\": 50, \"order\": 2}," +
                "{\"line_id\": \"manual_3\", \"x\": 10, \"y\": 220, \"width\": 200, \"height\": 50, \"order\": 3}," +
                "{\"line_id\": \"manual_4\", \"x\": 10, \"y\": 280, \"width\": 200, \"height\": 50, \"order\": 4}" +
                "]";

        // Provide a real JSON mapper for this test
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(300, 400, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "jpg", baos);
        byte[] fakeImageBytes = baos.toByteArray();
        MockMultipartFile file = new MockMultipartFile("image", "manual.jpg", "image/jpeg", fakeImageBytes);

        OcrMultilineTrial mockTrial = new OcrMultilineTrial();
        mockTrial.setTrialId(java.util.UUID.randomUUID());
        when(trialRepository.save(any())).thenReturn(mockTrial);

        when(lineRepository.save(any(OcrMultilineLine.class))).thenAnswer(i -> i.getArguments()[0]);
        
        when(restTemplate.exchange(anyString(), any(), any(), any(org.springframework.core.ParameterizedTypeReference.class))).thenReturn(
                ResponseEntity.ok(Map.of("recognized_text", "detected"))
        );

        MultilineTrialResponse response = service.createTrialAndRecognize(
                file, "test@example.com", "CAMERA", true, manualLinesJson
        );

        assertEquals(4, response.getLines().size());
        assertEquals(1, response.getLines().get(0).getLineOrder());
        assertEquals(100, response.getLines().get(0).getY());
        assertEquals(4, response.getLines().get(3).getLineOrder());
        assertEquals(280, response.getLines().get(3).getY());

        // Verify exactly 4 network calls to AI service were made
        verify(restTemplate, times(4)).exchange(anyString(), any(), any(), any(org.springframework.core.ParameterizedTypeReference.class));
    }

    @Test
    void testDetectLines_preservesFourBoxesAndForwardsExactSha() {
        byte[] fakeImageBytes = new byte[]{1, 2, 3, 4, 5, 6, 7, 8};
        MockMultipartFile file = new MockMultipartFile("image", "graph_sample.jpg", "image/jpeg", fakeImageBytes);

        List<LineBoxDto> mockBoxes = List.of(
                new LineBoxDto("line_1", 10, 20, 200, 30, 1, null),
                new LineBoxDto("line_2", 10, 60, 200, 30, 2, null),
                new LineBoxDto("line_3", 10, 100, 200, 30, 3, null),
                new LineBoxDto("line_4", 10, 140, 200, 30, 4, null)
        );
        MultilineDetectResponse mockAiResponse = MultilineDetectResponse.builder()
                .width(300)
                .height(400)
                .lines(mockBoxes)
                .detectorVersion("runtime6-hue-projection-20260914")
                .build();

        when(restTemplate.exchange(
                eq("http://localhost:8000/internal/v1/ocr/detect-lines"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(MultilineDetectResponse.class)
        )).thenReturn(ResponseEntity.ok(mockAiResponse));

        MultilineDetectResponse response = service.detectLines(file, true);

        assertNotNull(response);
        assertEquals(300, response.getWidth());
        assertEquals(400, response.getHeight());
        assertEquals(4, response.getLines().size());
        assertEquals("line_1", response.getLines().get(0).getLineId());
        assertEquals("line_4", response.getLines().get(3).getLineId());
        assertEquals("runtime6-hue-projection-20260914", response.getDetectorVersion());
    }

    @Test
    @SuppressWarnings("unchecked")
    void testHiddenReOcrCallCount_zeroWhenRawOcrTextPresent() throws Exception {
        // PROD.4A.1 Section B: If a line already has rawOcrText/final candidate state from detection,
        // Spring must NOT perform an unrequested second line OCR pass. Hidden re-OCR count must be 0.
        String detectedLinesJson = "[" +
                "{\"line_id\": \"line_1\", \"x\": 10, \"y\": 100, \"width\": 200, \"height\": 50, \"order\": 1, \"rawOcrText\": \"Bó hoa si tím\", \"finalText\": \"Bó hoa sim tím\", \"rawOcrConfidence\": 0.86}," +
                "{\"line_id\": \"line_2\", \"x\": 10, \"y\": 160, \"width\": 200, \"height\": 50, \"order\": 2, \"rawOcrText\": \"Em yêu mùa hè\", \"finalText\": \"Em yêu mùa hè\", \"rawOcrConfidence\": 0.88}" +
                "]";

        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(300, 400, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "jpg", baos);
        byte[] fakeImageBytes = baos.toByteArray();
        MockMultipartFile file = new MockMultipartFile("image", "sample.jpg", "image/jpeg", fakeImageBytes);

        OcrMultilineTrial mockTrial = new OcrMultilineTrial();
        mockTrial.setTrialId(java.util.UUID.randomUUID());
        when(trialRepository.save(any())).thenReturn(mockTrial);
        when(lineRepository.save(any(OcrMultilineLine.class))).thenAnswer(i -> i.getArguments()[0]);

        MultilineTrialResponse response = service.createTrialAndRecognize(
                file, "test@example.com", "CAMERA", true, detectedLinesJson
        );

        // Verify that recognize-line was called ZERO times because rawOcrText was present
        verify(restTemplate, times(0)).exchange(
                contains("/recognize-line"),
                any(),
                any(),
                any(org.springframework.core.ParameterizedTypeReference.class)
        );

        assertEquals(2, response.getLines().size());
        assertEquals("Bó hoa si tím", response.getLines().get(0).getRawOcrText());
        assertEquals("Bó hoa sim tím", response.getLines().get(0).getPredictedText());
        assertEquals("Em yêu mùa hè", response.getLines().get(1).getRawOcrText());
        assertEquals("Em yêu mùa hè", response.getLines().get(1).getPredictedText());
    }

    @Test
    @SuppressWarnings("unchecked")
    void recognizeLinePersistsActualScoreAndProvenance() throws Exception {
        preparePersistence();
        when(restTemplate.exchange(anyString(), any(), any(), any(org.springframework.core.ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(Map.of("recognized_text", "raw OCR", "confidence", 0.824,
                        "confidence_source", "CRNN_CTC_SOFTMAX")));

        LineBoxDto box = new LineBoxDto("manual", 0, 0, 100, 30, 1, null);
        MultilineLineResponse line = service.createTrialAndRecognize(testImage(), null, "CAMERA", true,
                new java.util.ArrayList<>(List.of(box)), null).getLines().get(0);

        assertEquals(0.824, line.getRawOcrConfidence());
        assertEquals("CRNN_CTC_SOFTMAX", line.getRawOcrConfidenceSource());
        org.mockito.ArgumentCaptor<OcrMultilineLine> captor = org.mockito.ArgumentCaptor.forClass(OcrMultilineLine.class);
        verify(lineRepository).save(captor.capture());
        assertEquals(0.824, captor.getValue().getRawOcrConfidence());
        assertEquals("CRNN_CTC_SOFTMAX", captor.getValue().getRawOcrConfidenceSource());
    }

    @Test
    void confirmedBoxesPreserveMeasuredRawScoreAndExcludeUnknownScores() throws Exception {
        preparePersistence();
        LineBoxDto real = new LineBoxDto("real", 0, 0, 100, 30, 1, "AI selected text");
        real.setRawOcrText("raw OCR");
        real.setRawOcrConfidence(0.79);
        real.setRawOcrConfidenceSource("CRNN_CTC_SOFTMAX");
        real.setFinalText("AI selected text");
        real.setGroqConfidence(0.85);
        real.setGroqConfidenceSource("AI_SELF_REPORTED");
        real.setGroqStatus("SUCCESS");
        real.setGeminiConfidence(0.99);
        real.setGeminiConfidenceSource("AI_SELF_REPORTED");
        real.setGeminiStatus("UNAVAILABLE");
        LineBoxDto legacy = new LineBoxDto("legacy", 0, 35, 100, 30, 2, null);
        legacy.setRawOcrText("legacy OCR");
        legacy.setRawOcrConfidence(0.99);

        MultilineTrialResponse response = service.createTrialAndRecognize(testImage(), null, "CAMERA", true,
                new java.util.ArrayList<>(List.of(real, legacy)), null);

        assertEquals("raw OCR", response.getLines().get(0).getRawOcrText());
        assertEquals("AI selected text", response.getLines().get(0).getPredictedText());
        assertEquals(0.79, response.getLines().get(0).getRawOcrConfidence());
        assertEquals(0.85, response.getLines().get(0).getGroqConfidence());
        assertNull(response.getLines().get(0).getGeminiConfidence());
        assertNull(response.getLines().get(1).getRawOcrConfidence());
        assertNull(response.getLines().get(1).getRawOcrConfidenceSource());
        verifyNoInteractions(restTemplate);
    }

    @Test
    @SuppressWarnings("unchecked")
    void detectionDropsInvalidOrUnprovenScores() {
        LineBoxDto box = new LineBoxDto("l1", 0, 0, 100, 30, 1, null);
        box.setRawOcrConfidence(Double.NaN);
        box.setRawOcrConfidenceSource("CRNN_CTC_SOFTMAX");
        box.setGroqConfidence(0.98);
        box.setGroqStatus("SUCCESS");
        when(restTemplate.exchange(anyString(), any(), any(), eq(MultilineDetectResponse.class)))
                .thenReturn(ResponseEntity.ok(MultilineDetectResponse.builder().lines(List.of(box)).build()));

        LineBoxDto returned = service.detectLines(new MockMultipartFile("image", "page.jpg", "image/jpeg", new byte[]{1}), true)
                .getLines().get(0);
        assertNull(returned.getRawOcrConfidence());
        assertNull(returned.getRawOcrConfidenceSource());
        assertNull(returned.getGroqConfidence());
    }

    @Test
    @SuppressWarnings("unchecked")
    void backgroundAdvisorsReceiveOriginalImageAndPreserveOnlyTaggedScores() throws Exception {
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());
        MockMultipartFile image = testImage();
        byte[] bytes = image.getBytes();
        OcrMultilineTrial trial = new OcrMultilineTrial();
        java.util.UUID trialId = java.util.UUID.randomUUID();
        trial.setTrialId(trialId);
        trial.setPageImageObjectKey("original.jpg");
        trial.setPageImageSha256(java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes)));
        OcrMultilineLine line = new OcrMultilineLine();
        line.setRawOcrText("raw OCR");
        line.setGroqStatus("UNAVAILABLE");
        line.setGroqModel("old-model");
        line.setSuggestionsJson("[{\"provider\":\"GROQ\",\"status\":\"UNAVAILABLE\",\"text\":\"\"}]");
        when(trialRepository.findById(trialId)).thenReturn(java.util.Optional.of(trial));
        when(lineRepository.findByTrialOrderByLineOrderAsc(trial)).thenReturn(List.of(line));
        when(objectStorageService.loadBytes("original.jpg")).thenReturn(bytes);
        Map<String, Object> advisor = Map.of("groqConfidence", 0.83, "groqConfidenceSource", "AI_SELF_REPORTED",
                "groqStatus", "SUCCESS", "groqModel", "actual-cloud-model", "groqSuggestion", "actual suggestion",
                "geminiConfidence", 0.99, "geminiConfidenceSource", "AI_SELF_REPORTED",
                "geminiStatus", "UNAVAILABLE", "geminiModel", "gemini-model",
                "suggestions", List.of(Map.of("provider", "GROQ", "model", "actual-cloud-model",
                        "status", "SUCCESS", "text", "actual suggestion", "confidence", 0.83,
                        "confidenceSource", "AI_SELF_REPORTED")));
        when(restTemplate.exchange(contains("/advise-lines"), any(), any(), any(org.springframework.core.ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(Map.of("lines", List.of(advisor))));

        ReflectionTestUtils.invokeMethod(service, "runBackgroundAdvisors", trialId, "req-1");

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).exchange(contains("/advise-lines"), any(), captor.capture(), any(org.springframework.core.ParameterizedTypeReference.class));
        Map<String, Object> request = (Map<String, Object>) captor.getValue().getBody();
        assertEquals(java.util.Base64.getEncoder().encodeToString(bytes), request.get("imageBase64"));
        assertEquals(0.83, line.getGroqConfidence());
        assertEquals("AI_SELF_REPORTED", line.getGroqConfidenceSource());
        assertEquals("actual-cloud-model", line.getGroqModel());
        assertEquals("gemini-model", line.getGeminiModel());
        MultilineLineResponse refreshed = MultilineLineResponse.fromEntity(line);
        assertEquals("SUCCESS", refreshed.getGroqStatus());
        assertEquals("actual suggestion", refreshed.getGroqSuggestion());
        assertEquals("actual-cloud-model", refreshed.getSuggestions().get(0).get("model"));
        assertNull(line.getGeminiConfidence());
        assertNull(line.getGeminiConfidenceSource());
    }

    private void preparePersistence() {
        when(trialRepository.save(any())).thenAnswer(invocation -> {
            OcrMultilineTrial trial = invocation.getArgument(0);
            if (trial.getTrialId() == null) trial.setTrialId(java.util.UUID.randomUUID());
            return trial;
        });
        when(lineRepository.save(any(OcrMultilineLine.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private MockMultipartFile testImage() throws Exception {
        java.awt.image.BufferedImage image = new java.awt.image.BufferedImage(100, 100, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "jpg", output);
        return new MockMultipartFile("image", "page.jpg", "image/jpeg", output.toByteArray());
    }
}
