package com.mathvisionkids.api.ocr;

import com.mathvisionkids.api.common.ApiException;
import com.mathvisionkids.api.ocr.multiline.MultilineFeedbackRequest;
import com.mathvisionkids.api.ocr.multiline.MultilineLineResponse;
import com.mathvisionkids.api.ocr.multiline.OcrMultilineLine;
import com.mathvisionkids.api.ocr.multiline.OcrMultilineLineRepository;
import com.mathvisionkids.api.ocr.multiline.OcrMultilineService;
import com.mathvisionkids.api.ocr.multiline.OcrMultilineTrial;
import com.mathvisionkids.api.ocr.multiline.OcrMultilineTrialRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class FeedbackEligibilityEdgeTest {

    @Mock private OcrTrialRepository ocrTrialRepository;
    @Mock private OcrStorageVerifier ocrStorageVerifier;
    @Mock private OcrMultilineTrialRepository ocrMultilineTrialRepository;
    @Mock private OcrMultilineLineRepository ocrMultilineLineRepository;

    private OcrPilotService pilotService;
    private OcrMultilineService multilineService;

    private static final String VALID_HEX_SHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    private static final String EMAIL = "test@example.com";

    @BeforeEach
    void setup() {
        pilotService = new OcrPilotService(ocrTrialRepository, null, ocrStorageVerifier, null, "http://dummy", "dummy");
        multilineService = new OcrMultilineService(ocrMultilineTrialRepository, ocrMultilineLineRepository, null, ocrStorageVerifier, null, null, "http://dummy", "dummy", "TEST");
        
        lenient().when(ocrTrialRepository.save(any(OcrTrial.class))).thenAnswer(i -> i.getArgument(0));
        lenient().when(ocrMultilineLineRepository.save(any(OcrMultilineLine.class))).thenAnswer(i -> i.getArgument(0));
    }

    private void runTest(String name, String path, boolean expected, Callable<Boolean> action) {
        System.out.println("TEST NAME: " + name);
        System.out.println("PATH: " + path);
        System.out.println("EXPECTED: " + expected);
        boolean actual = false;
        try {
            actual = action.call();
        } catch (ApiException e) {
            actual = false;
        } catch (Exception e) {
            actual = false;
        }
        System.out.println("ACTUAL: " + actual);
        System.out.println("PASS/FAIL: " + (expected == actual ? "PASS" : "FAIL"));
        System.out.println();
        assertEquals(expected, actual, "Test failed: " + name + " (" + path + ")");
    }

    private OcrTrial buildPilotTrial() {
        OcrTrial trial = new OcrTrial();
        trial.setTrialId(UUID.randomUUID());
        trial.setPrivacyConfirmed(true);
        trial.setTestData(false);
        trial.setDomain("HANDWRITING_TEXT");
        trial.setPredictedText("abc");
        trial.setLineImageObjectKey("ocr-trials/abc.jpg");
        trial.setLineImageSha256(VALID_HEX_SHA);
        trial.setVerdict(null);
        return trial;
    }

    private OcrMultilineLine buildMultilineLine() {
        OcrMultilineTrial trial = new OcrMultilineTrial();
        trial.setTrialId(UUID.randomUUID());
        trial.setPrivacyConfirmed(true);
        trial.setTestData(false);
        trial.setDomain("HANDWRITING_TEXT");
        trial.setStatus("COMPLETED");

        OcrMultilineLine line = new OcrMultilineLine();
        line.setLineId(UUID.randomUUID());
        line.setTrial(trial);
        line.setPredictedText("abc");
        line.setLineImageObjectKey("ocr-trials/abc.jpg");
        line.setLineImageSha256(VALID_HEX_SHA);
        line.setVerdict(null);
        return line;
    }

    @Test
    void runAllEdges() {
        System.out.println("--- ELIGIBILITY EDGE TESTS ---");

        // A. CORRECT exact equality
        runTest("A. CORRECT exact equality", "Single-Line", true, () -> {
            OcrTrial trial = buildPilotTrial();
            when(ocrTrialRepository.findById(trial.getTrialId())).thenReturn(Optional.of(trial));
            when(ocrStorageVerifier.verifyStorageIntegrity(anyString(), anyString())).thenReturn(true);
            OcrTrialResponse res = pilotService.recordFeedback(trial.getTrialId(), EMAIL, new OcrFeedbackRequest("CORRECT", "abc", false));
            return res.isTrainingEligible();
        });

        runTest("A. CORRECT exact equality", "Multi-Line", true, () -> {
            OcrMultilineLine line = buildMultilineLine();
            when(ocrMultilineTrialRepository.findById(line.getTrial().getTrialId())).thenReturn(Optional.of(line.getTrial()));
            when(ocrMultilineLineRepository.findByLineIdAndTrial(line.getLineId(), line.getTrial())).thenReturn(Optional.of(line));
            when(ocrStorageVerifier.verifyStorageIntegrity(anyString(), anyString())).thenReturn(true);
            MultilineLineResponse res = multilineService.recordLineFeedback(line.getTrial().getTrialId(), line.getLineId(), EMAIL, new MultilineFeedbackRequest("CORRECT", "abc", false));
            return res.isTrainingEligible();
        });

        // B. CORRECT whitespace mismatch
        runTest("B. CORRECT whitespace mismatch", "Single-Line", false, () -> {
            OcrTrial trial = buildPilotTrial();
            when(ocrTrialRepository.findById(trial.getTrialId())).thenReturn(Optional.of(trial));
            OcrTrialResponse res = pilotService.recordFeedback(trial.getTrialId(), EMAIL, new OcrFeedbackRequest("CORRECT", "abc ", false));
            return res.isTrainingEligible();
        });

        runTest("B. CORRECT whitespace mismatch", "Multi-Line", false, () -> {
            OcrMultilineLine line = buildMultilineLine();
            when(ocrMultilineTrialRepository.findById(line.getTrial().getTrialId())).thenReturn(Optional.of(line.getTrial()));
            when(ocrMultilineLineRepository.findByLineIdAndTrial(line.getLineId(), line.getTrial())).thenReturn(Optional.of(line));
            MultilineLineResponse res = multilineService.recordLineFeedback(line.getTrial().getTrialId(), line.getLineId(), EMAIL, new MultilineFeedbackRequest("CORRECT", "abc ", false));
            return res.isTrainingEligible();
        });

        // C. invalid 64-character non-hex SHA
        runTest("C. invalid 64-character non-hex SHA", "Single-Line", false, () -> {
            OcrTrial trial = buildPilotTrial();
            trial.setLineImageSha256("z".repeat(64));
            when(ocrTrialRepository.findById(trial.getTrialId())).thenReturn(Optional.of(trial));
            OcrTrialResponse res = pilotService.recordFeedback(trial.getTrialId(), EMAIL, new OcrFeedbackRequest("CORRECTED", "def", false));
            return res.isTrainingEligible();
        });

        runTest("C. invalid 64-character non-hex SHA", "Multi-Line", false, () -> {
            OcrMultilineLine line = buildMultilineLine();
            line.setLineImageSha256("z".repeat(64));
            when(ocrMultilineTrialRepository.findById(line.getTrial().getTrialId())).thenReturn(Optional.of(line.getTrial()));
            when(ocrMultilineLineRepository.findByLineIdAndTrial(line.getLineId(), line.getTrial())).thenReturn(Optional.of(line));
            MultilineLineResponse res = multilineService.recordLineFeedback(line.getTrial().getTrialId(), line.getLineId(), EMAIL, new MultilineFeedbackRequest("CORRECTED", "def", false));
            return res.isTrainingEligible();
        });

        // D. valid-format SHA but MinIO object missing
        runTest("D. valid-format SHA but MinIO object missing", "Single-Line", false, () -> {
            OcrTrial trial = buildPilotTrial();
            when(ocrTrialRepository.findById(trial.getTrialId())).thenReturn(Optional.of(trial));
            when(ocrStorageVerifier.verifyStorageIntegrity(anyString(), anyString())).thenReturn(false);
            OcrTrialResponse res = pilotService.recordFeedback(trial.getTrialId(), EMAIL, new OcrFeedbackRequest("CORRECTED", "def", false));
            return res.isTrainingEligible();
        });

        runTest("D. valid-format SHA but MinIO object missing", "Multi-Line", false, () -> {
            OcrMultilineLine line = buildMultilineLine();
            when(ocrMultilineTrialRepository.findById(line.getTrial().getTrialId())).thenReturn(Optional.of(line.getTrial()));
            when(ocrMultilineLineRepository.findByLineIdAndTrial(line.getLineId(), line.getTrial())).thenReturn(Optional.of(line));
            when(ocrStorageVerifier.verifyStorageIntegrity(anyString(), anyString())).thenReturn(false);
            MultilineLineResponse res = multilineService.recordLineFeedback(line.getTrial().getTrialId(), line.getLineId(), EMAIL, new MultilineFeedbackRequest("CORRECTED", "def", false));
            return res.isTrainingEligible();
        });

        // E. MinIO object exists but recomputed SHA mismatches DB SHA
        runTest("E. MinIO object exists but recomputed SHA mismatches", "Single-Line", false, () -> {
            OcrTrial trial = buildPilotTrial();
            when(ocrTrialRepository.findById(trial.getTrialId())).thenReturn(Optional.of(trial));
            when(ocrStorageVerifier.verifyStorageIntegrity(anyString(), anyString())).thenReturn(false);
            OcrTrialResponse res = pilotService.recordFeedback(trial.getTrialId(), EMAIL, new OcrFeedbackRequest("CORRECTED", "def", false));
            return res.isTrainingEligible();
        });

        runTest("E. MinIO object exists but recomputed SHA mismatches", "Multi-Line", false, () -> {
            OcrMultilineLine line = buildMultilineLine();
            when(ocrMultilineTrialRepository.findById(line.getTrial().getTrialId())).thenReturn(Optional.of(line.getTrial()));
            when(ocrMultilineLineRepository.findByLineIdAndTrial(line.getLineId(), line.getTrial())).thenReturn(Optional.of(line));
            when(ocrStorageVerifier.verifyStorageIntegrity(anyString(), anyString())).thenReturn(false);
            MultilineLineResponse res = multilineService.recordLineFeedback(line.getTrial().getTrialId(), line.getLineId(), EMAIL, new MultilineFeedbackRequest("CORRECTED", "def", false));
            return res.isTrainingEligible();
        });

        // F. verdict = SKIPPED
        runTest("F. verdict = SKIPPED", "Single-Line", false, () -> {
            OcrTrial trial = buildPilotTrial();
            when(ocrTrialRepository.findById(trial.getTrialId())).thenReturn(Optional.of(trial));
            OcrTrialResponse res = pilotService.recordFeedback(trial.getTrialId(), EMAIL, new OcrFeedbackRequest("SKIPPED", "", false));
            return res.isTrainingEligible();
        });

        runTest("F. verdict = SKIPPED", "Multi-Line", false, () -> {
            OcrMultilineLine line = buildMultilineLine();
            when(ocrMultilineTrialRepository.findById(line.getTrial().getTrialId())).thenReturn(Optional.of(line.getTrial()));
            when(ocrMultilineLineRepository.findByLineIdAndTrial(line.getLineId(), line.getTrial())).thenReturn(Optional.of(line));
            MultilineLineResponse res = multilineService.recordLineFeedback(line.getTrial().getTrialId(), line.getLineId(), EMAIL, new MultilineFeedbackRequest("SKIPPED", "", false));
            return res.isTrainingEligible();
        });

        // G. verdict = UNVERIFIED
        runTest("G. verdict = UNVERIFIED", "Single-Line", false, () -> {
            OcrTrial trial = buildPilotTrial();
            when(ocrTrialRepository.findById(trial.getTrialId())).thenReturn(Optional.of(trial));
            OcrTrialResponse res = pilotService.recordFeedback(trial.getTrialId(), EMAIL, new OcrFeedbackRequest("UNVERIFIED", "def", false));
            return res.isTrainingEligible();
        });

        runTest("G. verdict = UNVERIFIED", "Multi-Line", false, () -> {
            OcrMultilineLine line = buildMultilineLine();
            when(ocrMultilineTrialRepository.findById(line.getTrial().getTrialId())).thenReturn(Optional.of(line.getTrial()));
            when(ocrMultilineLineRepository.findByLineIdAndTrial(line.getLineId(), line.getTrial())).thenReturn(Optional.of(line));
            MultilineLineResponse res = multilineService.recordLineFeedback(line.getTrial().getTrialId(), line.getLineId(), EMAIL, new MultilineFeedbackRequest("UNVERIFIED", "def", false));
            return res.isTrainingEligible();
        });

        // H. is_test_data = true
        runTest("H. is_test_data = true", "Single-Line", false, () -> {
            OcrTrial trial = buildPilotTrial();
            trial.setTestData(true);
            when(ocrTrialRepository.findById(trial.getTrialId())).thenReturn(Optional.of(trial));
            OcrTrialResponse res = pilotService.recordFeedback(trial.getTrialId(), EMAIL, new OcrFeedbackRequest("CORRECTED", "def", false));
            return res.isTrainingEligible();
        });

        runTest("H. is_test_data = true", "Multi-Line", false, () -> {
            OcrMultilineLine line = buildMultilineLine();
            line.getTrial().setTestData(true);
            when(ocrMultilineTrialRepository.findById(line.getTrial().getTrialId())).thenReturn(Optional.of(line.getTrial()));
            when(ocrMultilineLineRepository.findByLineIdAndTrial(line.getLineId(), line.getTrial())).thenReturn(Optional.of(line));
            MultilineLineResponse res = multilineService.recordLineFeedback(line.getTrial().getTrialId(), line.getLineId(), EMAIL, new MultilineFeedbackRequest("CORRECTED", "def", false));
            return res.isTrainingEligible();
        });

        // I. privacy_confirmed = false
        runTest("I. privacy_confirmed = false", "Single-Line", false, () -> {
            OcrTrial trial = buildPilotTrial();
            trial.setPrivacyConfirmed(false);
            when(ocrTrialRepository.findById(trial.getTrialId())).thenReturn(Optional.of(trial));
            OcrTrialResponse res = pilotService.recordFeedback(trial.getTrialId(), EMAIL, new OcrFeedbackRequest("CORRECTED", "def", false));
            return res.isTrainingEligible();
        });

        runTest("I. privacy_confirmed = false", "Multi-Line", false, () -> {
            OcrMultilineLine line = buildMultilineLine();
            line.getTrial().setPrivacyConfirmed(false);
            when(ocrMultilineTrialRepository.findById(line.getTrial().getTrialId())).thenReturn(Optional.of(line.getTrial()));
            when(ocrMultilineLineRepository.findByLineIdAndTrial(line.getLineId(), line.getTrial())).thenReturn(Optional.of(line));
            MultilineLineResponse res = multilineService.recordLineFeedback(line.getTrial().getTrialId(), line.getLineId(), EMAIL, new MultilineFeedbackRequest("CORRECTED", "def", false));
            return res.isTrainingEligible();
        });

        // J. domain != HANDWRITING_TEXT
        runTest("J. domain != HANDWRITING_TEXT", "Single-Line", false, () -> {
            OcrTrial trial = buildPilotTrial();
            trial.setDomain("ARITHMETIC_EXPLICIT");
            when(ocrTrialRepository.findById(trial.getTrialId())).thenReturn(Optional.of(trial));
            OcrTrialResponse res = pilotService.recordFeedback(trial.getTrialId(), EMAIL, new OcrFeedbackRequest("CORRECTED", "def", false));
            return res.isTrainingEligible();
        });

        runTest("J. domain != HANDWRITING_TEXT", "Multi-Line", false, () -> {
            OcrMultilineLine line = buildMultilineLine();
            line.getTrial().setDomain("ARITHMETIC_EXPLICIT");
            when(ocrMultilineTrialRepository.findById(line.getTrial().getTrialId())).thenReturn(Optional.of(line.getTrial()));
            when(ocrMultilineLineRepository.findByLineIdAndTrial(line.getLineId(), line.getTrial())).thenReturn(Optional.of(line));
            MultilineLineResponse res = multilineService.recordLineFeedback(line.getTrial().getTrialId(), line.getLineId(), EMAIL, new MultilineFeedbackRequest("CORRECTED", "def", false));
            return res.isTrainingEligible();
        });

        // K. status != COMPLETED where status is applicable
        // Status only applies to Multi-Line (Single-Line doesn't have a status property)
        runTest("K. status != COMPLETED", "Multi-Line", false, () -> {
            OcrMultilineLine line = buildMultilineLine();
            line.getTrial().setStatus("PROCESSING");
            when(ocrMultilineTrialRepository.findById(line.getTrial().getTrialId())).thenReturn(Optional.of(line.getTrial()));
            when(ocrMultilineLineRepository.findByLineIdAndTrial(line.getLineId(), line.getTrial())).thenReturn(Optional.of(line));
            MultilineLineResponse res = multilineService.recordLineFeedback(line.getTrial().getTrialId(), line.getLineId(), EMAIL, new MultilineFeedbackRequest("CORRECTED", "def", false));
            return res.isTrainingEligible();
        });

        // L. verified_text_raw empty / whitespace-only
        runTest("L. verified_text_raw empty", "Single-Line", false, () -> {
            OcrTrial trial = buildPilotTrial();
            when(ocrTrialRepository.findById(trial.getTrialId())).thenReturn(Optional.of(trial));
            OcrTrialResponse res = pilotService.recordFeedback(trial.getTrialId(), EMAIL, new OcrFeedbackRequest("CORRECTED", "   ", false));
            return res.isTrainingEligible();
        });

        runTest("L. verified_text_raw empty", "Multi-Line", false, () -> {
            OcrMultilineLine line = buildMultilineLine();
            when(ocrMultilineTrialRepository.findById(line.getTrial().getTrialId())).thenReturn(Optional.of(line.getTrial()));
            when(ocrMultilineLineRepository.findByLineIdAndTrial(line.getLineId(), line.getTrial())).thenReturn(Optional.of(line));
            MultilineLineResponse res = multilineService.recordLineFeedback(line.getTrial().getTrialId(), line.getLineId(), EMAIL, new MultilineFeedbackRequest("CORRECTED", "   ", false));
            return res.isTrainingEligible();
        });
    }
}
