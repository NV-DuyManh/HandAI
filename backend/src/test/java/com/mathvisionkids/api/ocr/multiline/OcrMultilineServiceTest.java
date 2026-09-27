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
}
