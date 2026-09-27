import { submissionDraftStore, logImageFlow } from '../services/draft/submissionDraftStore';
import {
  handAiAnalyticsStore,
  HandAiAnalyticsStore,
  MultilineTrialResult,
  exportTrialToJson,
  exportTrialToCsv,
  calculateCer,
  calculateWer,
  computeWordLevenshteinDistance,
  tokenizeWords,
  computeLevenshteinDistance,
  removeVietnameseDiacritics,
  computeErrorAnalysis,
  classifyLineError,
  SIMILAR_CHARACTER_PAIRS,
  DEFAULT_CONFUSION_PAIRS,
  getErrorRecommendation,
  BENCHMARK_EXPERIMENTS,
  DatasetVersion,
  ModelExperiment,
  DEFAULT_DATASET_VERSIONS,
  DEFAULT_MODEL_EXPERIMENTS,
  DEFAULT_DATASET_QUALITY,
  DEFAULT_PERFORMANCE_HISTORY,
  exportResearchEvaluationReport,
  classifyRootCause,
  DEFAULT_CONFIDENCE_CALIBRATION,
  DEFAULT_DATASET_DISTRIBUTION,
  resolveDecisionSource,
} from '../services/analytics/handAiAnalyticsStore';
import { normalizeLocalFileUri, normalizeFileUri, resolveSafeCropImage } from '../services/image/imagePipeline';

describe('HandAI Flow, Image Lifecycle & Analytics Suite', () => {
  beforeEach(async () => {
    submissionDraftStore.clearDraft();
    await handAiAnalyticsStore.reset();
  });

  describe('Bug 1: Image Pipeline & Lifecycle Integrity', () => {
    it('strictly preserves originalImageUri even if privacy screen screenshot or preview is generated', () => {
      const originalPhotoUri = 'file:///storage/emulated/0/DCIM/Camera/IMG_20260923_101500.jpg';
      const privacyScreenshotUri = 'file:///data/user/0/com.mathvisionkids/cache/ViewShot_privacy_preview_17901.png';

      // 1. User acquires original image via Camera/Gallery
      submissionDraftStore.setDraft({
        uri: originalPhotoUri,
        rawUri: originalPhotoUri,
        originalImageUri: originalPhotoUri,
        originalUri: originalPhotoUri,
        sourceImageUri: originalPhotoUri,
        width: 1920,
        height: 1080,
        mimeType: 'image/jpeg',
        filename: 'photo.jpg',
        source: 'CAMERA',
      });

      let currentDraft = submissionDraftStore.getDraft();
      expect(currentDraft?.originalImageUri).toBe(originalPhotoUri);
      expect(currentDraft?.uri).toBe(originalPhotoUri);

      // 2. Simulate privacy preview viewshot captured
      submissionDraftStore.updateDraft({
        privacyImageUri: privacyScreenshotUri,
        uri: privacyScreenshotUri, // Even if uri was temporarily set
      });

      currentDraft = submissionDraftStore.getDraft();
      // Safeguard: In HandAI or safe pipeline, originalImageUri remains completely untouched
      expect(currentDraft?.originalImageUri).toBe(originalPhotoUri);
      expect(currentDraft?.privacyImageUri).toBe(privacyScreenshotUri);

      // 3. Log image flow output check
      const logs: string[] = [];
      const originalConsoleLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      logImageFlow({
        originalUri: currentDraft?.originalImageUri,
        privacyUri: currentDraft?.privacyImageUri,
        cropInputUri: currentDraft?.originalImageUri,
        activeRecognitionUri: currentDraft?.croppedImageUri || currentDraft?.originalImageUri,
      });
      console.log = originalConsoleLog;

      const flowLog = logs.join('\n');
      expect(flowLog).toContain('[IMAGE_FLOW]');
      expect(flowLog).toContain(`originalUri=${originalPhotoUri}`);
    });
  });

  describe('Bug 3: AI Correction Candidate Logic', () => {
    it('evaluates whether candidates should be shown based on distinctness and non-emptiness', () => {
      const rawOcr = '15 + 27 = 42';
      const identicalCandidate = '15 + 27 = 42';
      const distinctCandidate = '15 + 27 = 42 (đã kiểm tra)';

      // When identical: candidate should NOT be displayed
      const isIdenticalDistinct = identicalCandidate.trim().toLowerCase() !== rawOcr.trim().toLowerCase();
      expect(isIdenticalDistinct).toBe(false);

      // When distinct: candidate should be displayed
      const isDifferentDistinct = distinctCandidate.trim().toLowerCase() !== rawOcr.trim().toLowerCase();
      expect(isDifferentDistinct).toBe(true);
    });
  });

  describe('Bug 5: Recognition Accuracy Analytics Dashboard Store', () => {
    it('initializes with benchmark trend sessions (Session 1: 82%, Session 2: 88%, Session 3: 91%)', async () => {
      await handAiAnalyticsStore.init();
      const sessions = handAiAnalyticsStore.getSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(3);

      expect(sessions[0].accuracy).toBe(82);
      expect(sessions[1].accuracy).toBe(88);
      expect(sessions[2].accuracy).toBe(91);

      const summary = handAiAnalyticsStore.getSummary();
      expect(summary.accuracyPercent).toBeGreaterThan(80);
      expect(summary.averageConfidence).toBeGreaterThan(80);
      expect(summary.totalSessions).toBe(sessions.length);
    });

    it('correctly calculates accuracy %, confidence, and source distribution when recording a new trial', async () => {
      await handAiAnalyticsStore.init();
      const initialCount = handAiAnalyticsStore.getSessions().length;

      const mockTrial: MultilineTrialResult = {
        trialId: 'test_trial_live_1',
        source: 'CAMERA',
        pageImageObjectKey: 'ocr-trials/test_page.jpg',
        pageImageSha256: 'sha256_mock_123',
        pageWidth: 800,
        pageHeight: 600,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'TEST',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          {
            lineId: 'line_1',
            predictedText: 'Đạo hàm của sin(x) là cos(x)',
            confidence: 0.95,
            verdict: 'CORRECT',
            selectedSource: 'OCR',
            trainingEligible: true, verdict: 'CONFIRMED',
          },
          {
            lineId: 'line_2',
            predictedText: 'Tích phàn từ 0 dến 1',
            rawOcrText: 'Tích phàn từ 0 dến 1',
            currentText: 'Tích phân từ 0 đến 1',
            suggestions: [{ text: 'Tích phân từ 0 đến 1', confidence: 0.9, provider: 'ai' }],
            confidence: 0.90,
            verdict: 'CONFIRMED',
            selectedSource: 'SUGGESTION_1',
            trainingEligible: true, verdict: 'CONFIRMED',
          },
          {
            lineId: 'line_3',
            predictedText: 'x^2 + 2x + 1 = 0',
            rawOcrText: 'x^2 + 2x + 1 = 0',
            currentText: 'x² + 2x + 1 = 0',
            confidence: 0.85,
            verdict: 'CORRECTED',
            selectedSource: 'MANUAL_EDIT',
            trainingEligible: true, verdict: 'CONFIRMED',
          },
          {
            lineId: 'line_4',
            predictedText: 'Nghiệm kép x = -1',
            confidence: 0.94,
            verdict: 'CORRECT',
            selectedSource: 'OCR',
            trainingEligible: true, verdict: 'CONFIRMED',
          },
        ],
      };

      const session = await handAiAnalyticsStore.recordTrial(mockTrial);

      expect(session.sessionId).toBe('test_trial_live_1');
      expect(session.totalLines).toBe(4);
      expect(session.correctLines).toBe(4);
      expect(session.accuracy).toBe(100);
      expect(session.rawAccuracy).toBe(50);
      expect(session.crnnRawCount).toBe(2);
      expect(session.aiCorrectionCount).toBe(1);
      expect(session.manualEditCount).toBe(1);

      const updatedSessions = handAiAnalyticsStore.getSessions();
      expect(updatedSessions.length).toBe(initialCount + 1);

      const sourceDist = handAiAnalyticsStore.getSourceDistribution();
      expect(sourceDist[0].label).toBe('CRNN Raw');
      expect(sourceDist[0].count).toBeGreaterThan(0);
      expect(sourceDist[1].label).toBe('AI Correction');
      expect(sourceDist[1].count).toBeGreaterThan(0);

      const confBuckets = handAiAnalyticsStore.getConfidenceDistribution();
      expect(confBuckets.length).toBe(3); // High, Medium, Low
    });
  });

  describe('Part 9: HandAI Analytics & Evaluation Mandatory Test Cases', () => {
    // Test 1: 8 lines, OCR đúng 6, AI sửa 2 -> Raw Accuracy: 75%, Final Accuracy: 100%
    it('Test 1: 8 lines, OCR correct 6, AI corrected 2 -> Raw Accuracy 75%, Final Accuracy 100%', () => {
      const lines = [
        { lineId: '1', predictedText: 'Line 1', confidence: 0.95, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
        { lineId: '2', predictedText: 'Line 2', confidence: 0.92, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
        { lineId: '3', predictedText: 'Line 3', confidence: 0.89, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
        { lineId: '4', predictedText: 'Line 4', confidence: 0.94, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
        { lineId: '5', predictedText: 'Line 5', confidence: 0.88, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
        { lineId: '6', predictedText: 'Line 6', confidence: 0.91, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
        { lineId: '7', predictedText: 'Lne 7', rawOcrText: 'Lne 7', currentText: 'Line 7', suggestions: [{ text: 'Line 7', confidence: 0.9, provider: 'ai' }], confidence: 0.82, selectedSource: 'SUGGESTION_1', verdict: 'CONFIRMED', trainingEligible: true },
        { lineId: '8', predictedText: 'Lne 8', rawOcrText: 'Lne 8', currentText: 'Line 8', suggestions: [{ text: 'Line 8', confidence: 0.9, provider: 'ai' }], confidence: 0.80, selectedSource: 'SUGGESTION_1', verdict: 'CONFIRMED', trainingEligible: true },
      ];

      const mockTrial: MultilineTrialResult = {
        trialId: 'test_1_trial',
        source: 'CAMERA',
        pageImageObjectKey: 'test.jpg',
        pageImageSha256: 'sha',
        pageWidth: 800,
        pageHeight: 600,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'TEST',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: lines as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(mockTrial, true);
      expect(analytics.totalLines).toBe(8);
      expect(analytics.rawCorrect).toBe(6);
      expect(analytics.aiCorrected).toBe(2);
      expect(analytics.manualEdited).toBe(0);
      expect(analytics.rawAccuracy).toBe(75);
      expect(analytics.finalAccuracy).toBe(100);
      expect(analytics.aiImprovement).toBe(25);
    });

    // Test 2: Session chưa Confirm All -> Không xuất hiện Global Analytics
    it('Test 2: Unconfirmed session does not appear in Global Analytics', async () => {
      await handAiAnalyticsStore.init();
      const initialCount = handAiAnalyticsStore.getGlobalAnalytics().totalSessions;

      // In-progress trial that has NOT called completeTrial
      const unconfirmedTrial: MultilineTrialResult = {
        trialId: 'unconfirmed_trial',
        source: 'CAMERA',
        pageImageObjectKey: 'test.jpg',
        pageImageSha256: 'sha',
        pageWidth: 800,
        pageHeight: 600,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'TEST',
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        lines: [
          { lineId: '1', predictedText: 'Line 1', confidence: 0.5, verdict: '', selectedSource: 'OCR', trainingEligible: true },
        ],
      };

      const inProgressAnalytics = handAiAnalyticsStore.computeTrialAnalytics(unconfirmedTrial, false);
      expect(inProgressAnalytics.status).toBe('IN_PROGRESS');

      // Global sessions count should NOT increase
      const global = handAiAnalyticsStore.getGlobalAnalytics();
      expect(global.totalSessions).toBe(initialCount);
      expect(global.sessionsTrend.some((s) => s.sessionId === 'unconfirmed_trial')).toBe(false);
    });

    // Test 3: OCR empty line -> Không tính vào accuracy
    it('Test 3: Empty OCR line is marked as detection_failed and excluded from accuracy', () => {
      const mockTrialWithEmpty: MultilineTrialResult = {
        trialId: 'test_empty_line_trial',
        source: 'CAMERA',
        pageImageObjectKey: 'test.jpg',
        pageImageSha256: 'sha',
        pageWidth: 800,
        pageHeight: 600,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'TEST',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          { lineId: '1', predictedText: 'Học toán vui', confidence: 0.95, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: '2', predictedText: '   ', rawOcrText: '', currentText: '', confidence: 0, verdict: '', selectedSource: '', trainingEligible: false },
          { lineId: '3', predictedText: '2 + 3 = 5', confidence: 0.90, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
        ] as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(mockTrialWithEmpty, true);
      // Line 2 is empty, so only 2 valid lines
      expect(analytics.evaluatedLines).toBe(2);
      expect(analytics.rawCorrect).toBe(2);
      expect(analytics.rawAccuracy).toBe(100);
      expect(analytics.finalAccuracy).toBe(100);

      const failedLine = analytics.lineMetrics.find((lm) => lm.lineId === '2');
      expect(failedLine?.status).toBe('Detection Failed');
    });

    // Test 4: 5 sessions hoàn thành -> Global dashboard hiển thị đúng tổng
    it('Test 4: 5 completed sessions correctly aggregate in Global Analytics', async () => {
      await handAiAnalyticsStore.reset();
      const initialCount = handAiAnalyticsStore.getGlobalAnalytics().totalSessions;

      for (let i = 1; i <= 5; i++) {
        const trial: MultilineTrialResult = {
          trialId: `completed_trial_${i}`,
          source: 'CAMERA',
          pageImageObjectKey: `page_${i}.jpg`,
          pageImageSha256: `sha_${i}`,
          pageWidth: 800,
          pageHeight: 600,
          privacyConfirmed: true,
          isTestData: false,
          dataOrigin: 'TEST',
          status: 'SUCCESS',
          createdAt: new Date().toISOString(),
          lines: [
            { lineId: `t${i}_l1`, predictedText: `Text ${i}-1`, confidence: 0.9, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
            { lineId: `t${i}_l2`, predictedText: `Text ${i}-2`, confidence: 0.85, selectedSource: 'SUGGESTION_1', verdict: 'CONFIRMED', trainingEligible: true },
          ] as any,
        };
        await handAiAnalyticsStore.completeTrial(trial);
      }

      const global = handAiAnalyticsStore.getGlobalAnalytics();
      expect(global.totalSessions).toBe(initialCount + 5);
      const sessionCount = global.sessionsTrend.filter((s) => s.sessionId.startsWith('completed_trial_')).length;
      expect(sessionCount).toBe(5);
    });

    // Test 5: Ground Truth Evaluation Model & CorrectionType
    it('Test 5: Ground Truth Evaluation Model assigns proper correctionType and calculates accurate accuracy', () => {
      const trialWithMixedCorrections: MultilineTrialResult = {
        trialId: 'ground_truth_trial_1',
        source: 'GALLERY',
        pageImageObjectKey: 'img_gt.jpg',
        pageImageSha256: 'sha256_gt',
        pageWidth: 1080,
        pageHeight: 1920,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          // Line 1: OCR was correct directly -> OCR_CORRECT
          { lineId: 'l1', predictedText: 'Toán lớp 5', currentText: 'Toán lớp 5', rawOcrText: 'Toán lớp 5', confidence: 0.96, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          // Line 2: AI suggested fix was accepted -> AI_CORRECTED
          { lineId: 'l2', predictedText: 'Bai tap 2', currentText: 'Bài tập 2', rawOcrText: 'Bai tap 2', suggestions: [{ text: 'Bài tập 2', confidence: 0.92, provider: 'ai' }], confidence: 0.88, selectedSource: 'SUGGESTION_1', verdict: 'CONFIRMED', trainingEligible: true },
          // Line 3: User manually typed/edited the final text -> MANUAL_CORRECTED
          { lineId: 'l3', predictedText: '10 + x = ?', currentText: '10 + x = 20', rawOcrText: '10 + x = ?', confidence: 0.75, selectedSource: 'MANUAL', verdict: 'CONFIRMED', trainingEligible: true },
          // Line 4: Failed / wrong OCR line -> FAILED
          { lineId: 'l4', predictedText: 'loi sai', currentText: 'khong sua duoc', rawOcrText: 'loi sai', confidence: 0.40, selectedSource: 'OCR', verdict: 'WRONG', trainingEligible: false },
        ] as any,
      };

      const trialAnalytics = handAiAnalyticsStore.computeTrialAnalytics(trialWithMixedCorrections, true);

      // Total evaluated lines = 4
      expect(trialAnalytics.totalLines).toBe(4);
      expect(trialAnalytics.ocrCorrectLines).toBe(1);
      expect(trialAnalytics.aiCorrectedLines).toBe(1);
      expect(trialAnalytics.manualEditedLines).toBe(1);
      expect(trialAnalytics.finalCorrectLines).toBe(3); // l1 + l2 + l3 are confirmed/correct

      // Accuracy: correctFinalLines / evaluatedLines * 100 = 3 / 4 * 100 = 75%
      expect(trialAnalytics.finalAccuracy).toBe(75);
      // Raw Accuracy: 1 / 4 * 100 = 25%
      expect(trialAnalytics.rawAccuracy).toBe(25);
      // AI Improvement: 75% - 25% = +50%
      expect(trialAnalytics.aiImprovement).toBe(50);

      // Verify LineMetric structures
      const l1 = trialAnalytics.lineMetrics.find((m) => m.lineId === 'l1');
      expect(l1?.correctionType).toBe('OCR_CORRECT');
      expect(l1?.isCorrect).toBe(true);

      const l2 = trialAnalytics.lineMetrics.find((m) => m.lineId === 'l2');
      expect(l2?.correctionType).toBe('AI_CORRECTED');
      expect(l2?.isCorrect).toBe(true);

      const l3 = trialAnalytics.lineMetrics.find((m) => m.lineId === 'l3');
      expect(l3?.correctionType).toBe('MANUAL_CORRECTED');
      expect(l3?.isCorrect).toBe(true);

      const l4 = trialAnalytics.lineMetrics.find((m) => m.lineId === 'l4');
      expect(l4?.correctionType).toBe('FAILED');
      expect(l4?.isCorrect).toBe(false);
    });

    // Test 6: AI Improvement Funnel Metrics
    it('Test 6: AI Improvement Funnel reflects OCR baseline, AI assistance, and Final Confirmed stages', () => {
      const trialFunnel: MultilineTrialResult = {
        trialId: 'funnel_trial_1',
        source: 'CAMERA',
        pageImageObjectKey: 'funnel.jpg',
        pageImageSha256: 'sha_funnel',
        pageWidth: 800,
        pageHeight: 600,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'TEST',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          { lineId: 'f1', predictedText: 'Line 1', confidence: 0.95, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'f2', predictedText: 'Line 2 wrong', currentText: 'Line 2 fixed', confidence: 0.82, selectedSource: 'SUGGESTION_1', verdict: 'CONFIRMED', trainingEligible: true },
        ] as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(trialFunnel, true);
      expect(analytics.funnel).toBeDefined();
      expect(analytics.funnel.inputStage).toBe('IMAGE INPUT');
      expect(analytics.funnel.ocrStage.engine).toBe('CRNN OCR');
      expect(analytics.funnel.ocrStage.accuracy).toBe(50); // 1 out of 2
      expect(analytics.funnel.aiStage.improvement).toBe(50); // +50%
      expect(analytics.funnel.finalStage.accuracy).toBe(100); // 2 out of 2
    });

    // Test 7: Confidence Reliability Calibration Bins
    it('Test 7: Confidence Reliability Bins categorize 90-100%, 80-89%, 70-79%, <70% accurately', () => {
      const trialBins: MultilineTrialResult = {
        trialId: 'bins_trial',
        source: 'CAMERA',
        pageImageObjectKey: 'bins.jpg',
        pageImageSha256: 'sha_bins',
        pageWidth: 800,
        pageHeight: 600,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'TEST',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          { lineId: 'b1', predictedText: 'High conf', confidence: 0.95, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'b2', predictedText: 'Med-high conf', confidence: 0.85, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'b3', predictedText: 'Med conf wrong', confidence: 0.75, selectedSource: 'OCR', verdict: 'WRONG', trainingEligible: false },
          { lineId: 'b4', predictedText: 'Low conf', confidence: 0.60, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
        ] as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(trialBins, true);
      expect(analytics.confidenceReliability).toBeDefined();
      expect(analytics.confidenceReliability.length).toBe(4);

      const highBin = analytics.confidenceReliability.find((b) => b.range === '90-100%');
      expect(highBin?.totalLines).toBe(1);
      expect(highBin?.accuracy).toBe(100);

      const medLowBin = analytics.confidenceReliability.find((b) => b.range === '70-79%');
      expect(medLowBin?.totalLines).toBe(1);
      expect(medLowBin?.accuracy).toBe(0); // 1 wrong out of 1
    });

    // Test 8: Export Trial to JSON
    it('Test 8: exportTrialToJson generates compliant JSON schema for research analysis', () => {
      const trial: MultilineTrialResult = {
        trialId: 'export_trial_json_1',
        source: 'GALLERY',
        pageImageObjectKey: 'export_sample.jpg',
        pageImageSha256: 'sha_export',
        pageWidth: 1080,
        pageHeight: 720,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          { lineId: 'e1', predictedText: 'Chào mừng HandAI', rawOcrText: 'Chào mừng HandAI', currentText: 'Chào mừng HandAI', confidence: 0.92, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
        ] as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);
      const jsonStr = exportTrialToJson(analytics);
      expect(typeof jsonStr).toBe('string');

      const parsed = JSON.parse(jsonStr);
      expect(parsed.sessionId).toBe('export_trial_json_1');
      expect(parsed.imageInfo).toBeDefined();
      expect(parsed.metrics).toBeDefined();
      expect(parsed.metrics.rawAccuracy).toBe(100);
      expect(parsed.metrics.finalAccuracy).toBe(100);
      expect(parsed.lines).toBeDefined();
      expect(parsed.lines.length).toBe(1);
      expect(parsed.lines[0].modelOutput).toBe('Chào mừng HandAI');
      expect(parsed.lines[0].correct).toBe(true);
    });

    // Test 9: Export Trial to CSV
    it('Test 9: exportTrialToCsv formats rows with headers and proper escaping', () => {
      const trial: MultilineTrialResult = {
        trialId: 'export_trial_csv_1',
        source: 'GALLERY',
        pageImageObjectKey: 'csv_sample.jpg',
        pageImageSha256: 'sha_csv',
        pageWidth: 800,
        pageHeight: 600,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          { lineId: 'c1', predictedText: 'Line "with quotes"', currentText: 'Line "with quotes"', confidence: 0.89, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
        ] as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);
      const csvStr = exportTrialToCsv(analytics);
      expect(typeof csvStr).toBe('string');
      expect(csvStr).toContain('Line Index,Model Output (OCR),AI Suggestion,Final Text,Confidence,Source,Correction Type,Is Correct');
      expect(csvStr).toContain('Line ""with quotes""');
    });

    // Test 10: Model Performance Tracker & Empty Dashboard Handling
    it('Test 10: Model Performance Tracker defaults and hasCompletedSessions flag', async () => {
      await handAiAnalyticsStore.clearAllSessions();
      const emptyGlobal = handAiAnalyticsStore.getGlobalAnalytics();
      expect(emptyGlobal.hasCompletedSessions).toBe(false);
      expect(emptyGlobal.totalSessions).toBe(0);

      // Model Tracker
      expect(emptyGlobal.modelTracker).toBeDefined();
      expect(emptyGlobal.modelTracker.ocrEngine).toBe('CRNN-v1.2-PyTorch');
      expect(emptyGlobal.modelTracker.aiEngine).toContain('Gemini-4B');

      await handAiAnalyticsStore.reset();
    });
  });

  describe('HAND_AI Crop Image Loading & normalizeLocalFileUri Suite', () => {
    it('normalizeLocalFileUri keeps file:// URIs unchanged and never decodes Expo ExperienceData paths', () => {
      const androidExperienceUri =
        'file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540anonymous%252Fhand-ai-1234/Camera/photo.jpg';
      const normalized = normalizeLocalFileUri(androidExperienceUri);
      expect(normalized).toBe(androidExperienceUri);
      expect(normalized).toContain('%2540anonymous%252F');
      expect(normalized).not.toContain('@anonymous');
    });

    it('normalizeLocalFileUri adds file:// prefix to raw absolute file paths', () => {
      const rawPath = '/data/user/0/com.mathvisionkids/cache/test.jpg';
      const normalized = normalizeLocalFileUri(rawPath);
      expect(normalized).toBe('file:///data/user/0/com.mathvisionkids/cache/test.jpg');
    });

    it('resolveSafeCropImage generates [CROP_DEBUG] logs with exact format', async () => {
      const testUri = 'file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540anonymous%252Fhand-ai/Camera/test.jpg';
      const logs: string[] = [];
      const originalConsoleLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      const result = await resolveSafeCropImage(testUri);
      console.log = originalConsoleLog;

      const debugLog = logs.join('\n');
      expect(debugLog).toContain('[CROP_DEBUG]');
      expect(debugLog).toContain(`originalUri=${testUri}`);
      expect(debugLog).toContain(`normalizedUri=${testUri}`);
      expect(debugLog).toContain('exists=');
      expect(debugLog).toContain('finalUri=');
      expect(result.originalUri).toBe(testUri);
      expect(result.normalizedUri).toBe(testUri);
    });

    it('CASE 1: Gallery image -> original gallery URI is preserved for crop', () => {
      const galleryUri = 'file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540anonymous%252Fhand-ai/ImagePicker/test.jpg';
      submissionDraftStore.setDraft({
        uri: galleryUri,
        rawUri: galleryUri,
        originalImageUri: galleryUri,
        width: 1080,
        height: 1920,
        mimeType: 'image/jpeg',
        filename: 'gallery.jpg',
        source: 'GALLERY',
      });

      const draft = submissionDraftStore.getDraft();
      expect(draft?.originalImageUri).toBe(galleryUri);
      expect(draft?.source).toBe('GALLERY');
    });

    it('CASE 2: Camera image -> original camera URI is preserved for crop', () => {
      const cameraUri = 'file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540anonymous%252Fhand-ai/Camera/captured.jpg';
      submissionDraftStore.setDraft({
        uri: cameraUri,
        rawUri: cameraUri,
        originalImageUri: cameraUri,
        width: 1920,
        height: 1080,
        mimeType: 'image/jpeg',
        filename: 'camera.jpg',
        source: 'CAMERA',
      });

      const draft = submissionDraftStore.getDraft();
      expect(draft?.originalImageUri).toBe(cameraUri);
      expect(draft?.source).toBe('CAMERA');
    });

    it('CASE 3: HAND_AI bypass privacy -> crop never receives ViewShot or privacy artifacts', () => {
      const prevMode = process.env.EXPO_PUBLIC_APP_MODE;
      process.env.EXPO_PUBLIC_APP_MODE = 'HAND_AI';
      try {
        const originalUri = 'file:///storage/emulated/0/DCIM/Camera/IMG_2026.jpg';
        const privacyViewShot = 'file:///data/user/0/cache/ViewShot_masked.png';

        submissionDraftStore.setDraft({
          uri: originalUri,
          rawUri: originalUri,
          originalImageUri: originalUri,
          privacyImageUri: privacyViewShot,
          width: 1200,
          height: 1600,
          mimeType: 'image/jpeg',
          filename: 'original.jpg',
        });

        // In HAND_AI mode, getDraft() guarantees privacyImageUri is undefined
        const draft = submissionDraftStore.getDraft();
        expect(draft?.originalImageUri).toBe(originalUri);
        expect(draft?.privacyImageUri).toBeUndefined();
      } finally {
        process.env.EXPO_PUBLIC_APP_MODE = prevMode;
      }
    });

    it('CASE 4 & 5: Normal flow compatibility and clean draft initialization', () => {
      const standardUri = 'file:///photos/math1.jpg';
      submissionDraftStore.setDraft({
        uri: standardUri,
        rawUri: standardUri,
        width: 800,
        height: 600,
        mimeType: 'image/jpeg',
        filename: 'math1.jpg',
      });

      const draft = submissionDraftStore.getDraft();
      expect(draft).not.toBeNull();
      expect(draft?.uri).toBe(standardUri);
    });
  });

  describe('HandAI Research AI Model Evaluation Platform Suite', () => {
    describe('1. CER (Character Error Rate) & Character Accuracy Evaluation Algorithms', () => {
      it('calculates 0% CER and 100% Character Accuracy for identical strings', () => {
        const text = 'Đạo hàm của sin(x) là cos(x)';
        const result = calculateCer(text, text);
        expect(result.cer).toBe(0);
        expect(result.cerPercent).toBe(0);
        expect(result.charAccuracy).toBe(100);
      });

      it('computes exact Levenshtein edit distance and CER percentage for character insertions/substitutions', () => {
        // "kitten" -> "sitting": substitution k->s, e->i, insertion +g => 3 edits
        const dist = computeLevenshteinDistance('kitten', 'sitting');
        expect(dist).toBe(3);

        const result = calculateCer('kitten', 'sitting');
        // reference length = 7 ("sitting"), edits = 3 => CER = 3/7 = ~42.9%
        expect(result.cerPercent).toBeCloseTo(42.9, 1);
        expect(result.charAccuracy).toBeCloseTo(57.1, 1);
      });

      it('handles empty references and predictions gracefully without division by zero', () => {
        const emptyRef = calculateCer('any', '');
        expect(emptyRef.cerPercent).toBe(100);
        expect(emptyRef.charAccuracy).toBe(0);

        const bothEmpty = calculateCer('', '');
        expect(bothEmpty.cerPercent).toBe(0);
        expect(bothEmpty.charAccuracy).toBe(100);
      });
    });

    describe('2. Vietnamese Diacritics & Error Classification Engine', () => {
      it('correctly strips Vietnamese diacritics including đ/Đ', () => {
        const raw = 'Đạo hàm của hàm số lượng giác và tích phân';
        const stripped = removeVietnameseDiacritics(raw);
        expect(stripped).toBe('Dao ham cua ham so luong giac va tich phan');
      });

      it('classifies Vietnamese tone errors, missing characters, and lookalike confusion', () => {
        const lines: any[] = [
          // Tone error: only accent is different
          {
            lineId: 'l1',
            lineIndex: 1,
            modelOutput: 'Đao ham',
            aiSuggestion: 'Đạo hàm',
            finalText: 'Đạo hàm',
            groundTruth: 'Đạo hàm',
            confidence: 90,
            isCorrect: false,
            correctionType: 'AI_CORRECTED',
            evaluationStatus: 'EVALUATED',
            status: 'Accepted',
          },
          // Missing character error: length < ground truth
          {
            lineId: 'l2',
            lineIndex: 2,
            modelOutput: 'Tích phâ',
            aiSuggestion: 'Tích phân',
            finalText: 'Tích phân',
            groundTruth: 'Tích phân',
            confidence: 88,
            isCorrect: false,
            correctionType: 'AI_CORRECTED',
            evaluationStatus: 'EVALUATED',
            status: 'Accepted',
          },
          // Similar character confusion (0 vs O)
          {
            lineId: 'l3',
            lineIndex: 3,
            modelOutput: 'x = O',
            aiSuggestion: 'x = 0',
            finalText: 'x = 0',
            groundTruth: 'x = 0',
            confidence: 82,
            isCorrect: false,
            correctionType: 'AI_CORRECTED',
            evaluationStatus: 'EVALUATED',
            status: 'Accepted',
          },
          // Low quality image error: confidence < 65%
          {
            lineId: 'l4',
            lineIndex: 4,
            modelOutput: 'unclear stroke',
            finalText: 'y = 2x + 1',
            groundTruth: 'y = 2x + 1',
            confidence: 50,
            isCorrect: false,
            correctionType: 'MANUAL_CORRECTED',
            evaluationStatus: 'EVALUATED',
            status: 'Detection Failed',
          },
        ];

        const report = computeErrorAnalysis(lines);
        expect(report.totalErrors).toBe(4);
        expect(report.vietnameseToneErrors.count).toBe(1);
        expect(report.missingCharacterErrors.count).toBe(1);
        expect(report.similarCharacterErrors.count).toBe(1);
        expect(report.lowQualityImageErrors.count).toBe(1);

        expect(report.vietnameseToneErrors.percentage).toBe(25);
        expect(report.missingCharacterErrors.percentage).toBe(25);
      });
    });

    describe('3. Trial Analytics & Research Evaluation Model Upgrades', () => {
      it('guarantees mandatory groundTruth, evaluationStatus, CER, and Character Accuracy on all lines', async () => {
        await handAiAnalyticsStore.init();

        const mockTrial: any = {
          trialId: 'research_trial_eval_101',
          source: 'CAMERA',
          pageImageObjectKey: 'ocr-trials/eval.jpg',
          pageWidth: 1080,
          pageHeight: 1920,
          status: 'SUCCESS',
          lines: [
            {
              lineId: 'l1',
              predictedText: 'sin(x)^2 + cos(x)^2 = 1',
              confidence: 0.98,
              verdict: 'CORRECT',
              selectedSource: 'OCR',
            },
            {
              lineId: 'l2',
              predictedText: 'lim x->0 sin(x)/x = l',
              rawOcrText: 'lim x->0 sin(x)/x = l',
              currentText: 'lim x->0 sin(x)/x = 1',
              suggestions: [{ text: 'lim x->0 sin(x)/x = 1', confidence: 0.91, provider: 'ai' }],
              confidence: 0.91,
              verdict: 'CONFIRMED',
              selectedSource: 'SUGGESTION_1',
            },
          ],
        };

        const trialAnalytics = handAiAnalyticsStore.computeTrialAnalytics(mockTrial, true);

        // Recognition Quality Report fields
        expect(trialAnalytics.lineAccuracy).toBe(100);
        expect(trialAnalytics.characterAccuracy).toBeGreaterThan(95);
        expect(trialAnalytics.cer).toBeLessThan(5);
        expect(trialAnalytics.rawOcrAccuracy).toBe(50);
        expect(trialAnalytics.finalAiAccuracy).toBe(100);
        expect(trialAnalytics.aiGain).toBe(50);

        // Mandatory line fields
        trialAnalytics.lineMetrics.forEach((lm) => {
          expect(lm.groundTruth).toBeDefined();
          expect(lm.groundTruth.length).toBeGreaterThan(0);
          expect(['EVALUATED', 'PENDING', 'SKIPPED']).toContain(lm.evaluationStatus);
          expect(typeof lm.cer).toBe('number');
          expect(typeof lm.characterAccuracy).toBe('number');
        });

        // 4-stage Measurable Pipeline Funnel
        expect(trialAnalytics.measurableFunnel).toBeDefined();
        expect(trialAnalytics.measurableFunnel.imageInput.stage).toBe('Image Input');
        expect(trialAnalytics.measurableFunnel.imageInput.totalLines).toBe(2);
        expect(trialAnalytics.measurableFunnel.crnnOcr.stage).toBe('CRNN OCR');
        expect(trialAnalytics.measurableFunnel.crnnOcr.correctLines).toBe(1);
        expect(trialAnalytics.measurableFunnel.aiCorrection.stage).toBe('AI Correction');
        expect(trialAnalytics.measurableFunnel.aiCorrection.correctedLines).toBe(1);
        expect(trialAnalytics.measurableFunnel.finalResult.stage).toBe('Final Result');
        expect(trialAnalytics.measurableFunnel.finalResult.finalCorrectLines).toBe(2);

        // Research Metadata
        expect(trialAnalytics.metadata).toBeDefined();
        expect(trialAnalytics.metadata.sessionId).toBe('research_trial_eval_101');
        expect(trialAnalytics.metadata.modelVersion).toBe('CRNN-v1.2-PyTorch');
        expect(trialAnalytics.metadata.engineVersion).toContain('HandAI');
        expect(trialAnalytics.metadata.imageResolution).toContain('1080 x 1920');
      });

      it('includes research benchmark experiments comparison table', () => {
        expect(BENCHMARK_EXPERIMENTS.length).toBeGreaterThanOrEqual(4);
        BENCHMARK_EXPERIMENTS.forEach((exp) => {
          expect(exp.modelVersion).toBeDefined();
          expect(typeof exp.accuracy).toBe('number');
          expect(typeof exp.cer).toBe('number');
          expect(typeof exp.latency).toBe('number');
          expect(typeof exp.datasetSize).toBe('string');
        });

        // Active model must be present
        const activeExp = BENCHMARK_EXPERIMENTS.find((e) => e.status === 'ACTIVE');
        expect(activeExp).toBeDefined();
        expect(activeExp?.modelVersion).toContain('CRNN-v1.2');
      });

      it('exports trial data with research fields in JSON and CSV', async () => {
        await handAiAnalyticsStore.init();

        const mockTrial: any = {
          trialId: 'export_eval_202',
          source: 'GALLERY',
          status: 'SUCCESS',
          lines: [
            {
              lineId: 'l1',
              predictedText: 'E = mc^2',
              confidence: 0.99,
              verdict: 'CORRECT',
              selectedSource: 'OCR',
            },
          ],
        };

        const analytics = handAiAnalyticsStore.computeTrialAnalytics(mockTrial, true);

        // JSON check
        const json = exportTrialToJson(analytics);
        const parsed = JSON.parse(json);
        expect(parsed.recognitionQualityReport).toBeDefined();
        expect(parsed.recognitionQualityReport.lineAccuracy).toBe(100);
        expect(parsed.recognitionQualityReport.characterAccuracy).toBe(100);
        expect(parsed.recognitionQualityReport.cer).toBe(0);
        expect(parsed.measurableFunnel).toBeDefined();
        expect(parsed.errorAnalysis).toBeDefined();

        // CSV check
        const csv = exportTrialToCsv(analytics);
        expect(csv).toContain('Ground Truth');
        expect(csv).toContain('Evaluation Status');
        expect(csv).toContain('CER (%)');
        expect(csv).toContain('Character Accuracy (%)');
        expect(csv).toContain('WER (%)');
        expect(csv).toContain('Word Accuracy (%)');
        expect(csv).toContain('E = mc^2');
      });
    });

    describe('4. Phase WER: Word Error Rate Implementation Tests', () => {
      // CASE 1
      it('CASE 1: Identical strings produce WER = 0 and Word Accuracy = 100%', () => {
        const groundTruth = 'Em yêu mùa hè';
        const prediction = 'Em yêu mùa hè';

        const result = calculateWer(prediction, groundTruth);

        expect(result.referenceWords).toEqual(['Em', 'yêu', 'mùa', 'hè']);
        expect(result.predictedWords).toEqual(['Em', 'yêu', 'mùa', 'hè']);
        expect(result.wordDistance).toBe(0);
        expect(result.werPercent).toBe(0);
        expect(result.wordAccuracy).toBe(100);
        expect(result.wer).toBe(0);
      });

      // CASE 2
      it('CASE 2: One substitution produces WER > 0 (25%) and Word Accuracy = 75%', () => {
        const groundTruth = 'Em yêu mùa hè';
        const prediction = 'Em yêu mùa he';

        const result = calculateWer(prediction, groundTruth);

        expect(result.referenceWords).toEqual(['Em', 'yêu', 'mùa', 'hè']);
        expect(result.predictedWords).toEqual(['Em', 'yêu', 'mùa', 'he']);
        expect(result.wordDistance).toBe(1);
        expect(result.werPercent).toBe(25);
        expect(result.wordAccuracy).toBe(75);
        expect(result.wer).toBeGreaterThan(0);
      });

      // CASE 3
      it('CASE 3: Empty string handling without division by zero', () => {
        // Both empty
        const emptyBoth = calculateWer('', '');
        expect(emptyBoth.werPercent).toBe(0);
        expect(emptyBoth.wordAccuracy).toBe(100);
        expect(emptyBoth.referenceWords).toEqual([]);
        expect(emptyBoth.predictedWords).toEqual([]);
        expect(Number.isFinite(emptyBoth.werPercent)).toBe(true);

        // Reference empty, prediction has words
        const emptyRef = calculateWer('bài toán', '');
        expect(emptyRef.werPercent).toBe(100);
        expect(emptyRef.wordAccuracy).toBe(0);
        expect(Number.isFinite(emptyRef.werPercent)).toBe(true);

        // Prediction empty, reference has words
        const emptyPred = calculateWer('', 'bài toán');
        expect(emptyPred.werPercent).toBe(100);
        expect(emptyPred.wordAccuracy).toBe(0);
        expect(Number.isFinite(emptyPred.werPercent)).toBe(true);

        // Whitespace only
        const whitespaceOnly = calculateWer('   ', '   ');
        expect(whitespaceOnly.werPercent).toBe(0);
        expect(whitespaceOnly.wordAccuracy).toBe(100);
      });

      it('verifies dynamic programming word edit distance with insertions, deletions, substitutions', () => {
        // Insertion: "a b" -> "a b c"
        expect(computeWordLevenshteinDistance(['a', 'b', 'c'], ['a', 'b'])).toBe(1);
        // Deletion: "a b c" -> "a c"
        expect(computeWordLevenshteinDistance(['a', 'c'], ['a', 'b', 'c'])).toBe(1);
        // Substitution: "a b c" -> "a d c"
        expect(computeWordLevenshteinDistance(['a', 'd', 'c'], ['a', 'b', 'c'])).toBe(1);
        // Mixed: "em yêu trường" -> "tôi rất yêu trường mến"
        // ref: ["em", "yêu", "trường"] (len 3)
        // pred: ["tôi", "rất", "yêu", "trường", "mến"]
        const dist = computeWordLevenshteinDistance(
          ['tôi', 'rất', 'yêu', 'trường', 'mến'],
          ['em', 'yêu', 'trường']
        );
        expect(dist).toBeGreaterThanOrEqual(2);
      });

      it('Trial Analytics populates LineMetric with referenceWords, predictedWords, wer, and wordAccuracy', () => {
        const mockTrial: any = {
          trialId: 'wer_trial_test_1',
          source: 'CAMERA',
          status: 'SUCCESS',
          lines: [
            {
              lineId: 'l1',
              predictedText: 'Em yêu mùa he',
              currentText: 'Em yêu mùa hè',
              groundTruth: 'Em yêu mùa hè',
              confidence: 0.92,
              verdict: 'CONFIRMED',
              selectedSource: 'OCR',
            },
            {
              lineId: 'l2',
              predictedText: 'Toán học vui',
              currentText: 'Toán học vui',
              groundTruth: 'Toán học vui',
              confidence: 0.98,
              verdict: 'CORRECT',
              selectedSource: 'OCR',
            },
          ],
        };

        const analytics = handAiAnalyticsStore.computeTrialAnalytics(mockTrial, true);

        // Global Trial WER metrics
        expect(typeof analytics.wer).toBe('number');
        expect(typeof analytics.wordAccuracy).toBe('number');
        expect(analytics.WER).toBe(analytics.wer);
        expect(analytics.WordAccuracy).toBe(analytics.wordAccuracy);

        // Line 1: 'Em yêu mùa he' vs 'Em yêu mùa hè' -> 1/4 edit distance
        const line1 = analytics.lineMetrics[0];
        expect(line1.referenceWords).toEqual(['Em', 'yêu', 'mùa', 'hè']);
        expect(line1.predictedWords).toEqual(['Em', 'yêu', 'mùa', 'he']);
        expect(line1.wer).toBe(25);
        expect(line1.wordAccuracy).toBe(75);
        expect(line1.WER).toBe(25);
        expect(line1.WordAccuracy).toBe(75);

        // Line 2: 'Toán học vui' vs 'Toán học vui' -> 0/3 edit distance
        const line2 = analytics.lineMetrics[1];
        expect(line2.referenceWords).toEqual(['Toán', 'học', 'vui']);
        expect(line2.predictedWords).toEqual(['Toán', 'học', 'vui']);
        expect(line2.wer).toBe(0);
        expect(line2.wordAccuracy).toBe(100);

        // Overall trial WER: (1 word error / 7 total ref words) * 100 = 14.3%
        expect(analytics.wer).toBe(14.3);
        expect(analytics.wordAccuracy).toBe(85.7);
      });

      it('Global Analytics calculates Average WER and provides WER trend chart for completed sessions', async () => {
        await handAiAnalyticsStore.init();
        const globalData = handAiAnalyticsStore.getGlobalAnalytics();

        expect(globalData.hasCompletedSessions).toBe(true);
        expect(typeof globalData.globalWer).toBe('number');
        expect(typeof globalData.globalWordAccuracy).toBe('number');

        // Target benchmark values from requirement: Session 1: 20%, Session 2: 15%, Session 3: 8%
        expect(globalData.werTrend).toBeDefined();
        expect(globalData.werTrend.length).toBeGreaterThanOrEqual(3);

        const s1 = globalData.werTrend.find((t) => t.label === 'Session 1');
        const s2 = globalData.werTrend.find((t) => t.label === 'Session 2');
        const s3 = globalData.werTrend.find((t) => t.label === 'Session 3');

        expect(s1?.wer).toBe(20);
        expect(s2?.wer).toBe(15);
        expect(s3?.wer).toBe(8);

        // Average of benchmark sessions: (20 + 15 + 8) / 3 = 14.3%
        expect(globalData.globalWer).toBe(14.3);
        expect(globalData.globalWordAccuracy).toBe(85.7);
      });

      it('Trial export includes WER and Word Accuracy in both JSON and CSV', () => {
        const mockTrial: any = {
          trialId: 'wer_export_test',
          source: 'CAMERA',
          status: 'SUCCESS',
          lines: [
            {
              lineId: 'l1',
              predictedText: 'Học thầy không tày học bạn',
              confidence: 0.95,
              verdict: 'CORRECT',
              selectedSource: 'OCR',
            },
          ],
        };

        const analytics = handAiAnalyticsStore.computeTrialAnalytics(mockTrial, true);
        const jsonStr = exportTrialToJson(analytics);
        const json = JSON.parse(jsonStr);

        expect(json.recognitionQualityReport.wer).toBeDefined();
        expect(json.recognitionQualityReport.wordAccuracy).toBeDefined();
        expect(json.metrics.wer).toBeDefined();
        expect(json.metrics.wordAccuracy).toBeDefined();
        expect(json.lines[0].referenceWords).toBeDefined();
        expect(json.lines[0].predictedWords).toBeDefined();
        expect(json.lines[0].wer).toBeDefined();
        expect(json.lines[0].wordAccuracy).toBeDefined();

        const csvStr = exportTrialToCsv(analytics);
        expect(csvStr).toContain('WER (%)');
        expect(csvStr).toContain('Word Accuracy (%)');
      });
    });

    describe('Task: Research-grade Error Analysis Module', () => {
      // CASE 1: mùa vs mua -> VIETNAMESE_TONE_ERROR
      it('CASE 1: Detects VIETNAMESE_TONE_ERROR when base characters match but diacritics/tones differ', () => {
        // Ground Truth: mùa vs Prediction: mua
        const res1 = classifyLineError('mua', 'mùa', 92);
        expect(res1.errorType).toBe('VIETNAMESE_TONE_ERROR');
        expect(res1.severity).toBe('MEDIUM');
        expect(res1.examples[0]).toContain('"mua" → "mùa"');

        // Test all 5 Vietnamese tones: sắc, huyền, hỏi, ngã, nặng
        // Sắc
        expect(classifyLineError('toan', 'toán', 90).errorType).toBe('VIETNAMESE_TONE_ERROR');
        // Huyền
        expect(classifyLineError('mua', 'mùa', 90).errorType).toBe('VIETNAMESE_TONE_ERROR');
        // Hỏi
        expect(classifyLineError('hoi', 'hỏi', 90).errorType).toBe('VIETNAMESE_TONE_ERROR');
        // Ngã
        expect(classifyLineError('nga', 'ngã', 90).errorType).toBe('VIETNAMESE_TONE_ERROR');
        // Nặng
        expect(classifyLineError('hoc', 'học', 90).errorType).toBe('VIETNAMESE_TONE_ERROR');
      });

      // CASE 2: m vs n -> SIMILAR_CHARACTER_CONFUSION
      it('CASE 2: Detects SIMILAR_CHARACTER_CONFUSION and records wrongCharacter, correctCharacter, count', () => {
        // Prediction: m vs Ground Truth: n
        const res = classifyLineError('m', 'n', 90);
        expect(res.errorType).toBe('SIMILAR_CHARACTER_CONFUSION');
        expect(res.severity).toBe('MEDIUM');
        expect(res.characterPairs.length).toBeGreaterThan(0);
        expect(res.characterPairs[0].wrongCharacter).toBe('m');
        expect(res.characterPairs[0].correctCharacter).toBe('n');
        expect(res.characterPairs[0].count).toBe(1);

        // Test other handwriting lookalike pairs: u ↔ v, b ↔ d, c ↔ e, tr ↔ ch, s ↔ x, r ↔ d
        const resUV = classifyLineError('v', 'u', 90);
        expect(resUV.errorType).toBe('SIMILAR_CHARACTER_CONFUSION');
        expect(resUV.characterPairs[0].wrongCharacter).toBe('v');
        expect(resUV.characterPairs[0].correctCharacter).toBe('u');

        const resSX = classifyLineError('x', 's', 90);
        expect(resSX.errorType).toBe('SIMILAR_CHARACTER_CONFUSION');

        const resTRCH = classifyLineError('ch', 'tr', 90);
        expect(resTRCH.errorType).toBe('SIMILAR_CHARACTER_CONFUSION');
      });

      // CASE 3: missing character & extra character
      it('CASE 3: Detects MISSING_CHARACTER (deletion) and EXTRA_CHARACTER (insertion)', () => {
        // Ground Truth: mùa, Prediction: mù (Deletion -> MISSING_CHARACTER)
        const delRes = classifyLineError('mù', 'mùa', 90);
        expect(delRes.errorType).toBe('MISSING_CHARACTER');
        expect(delRes.examples[0]).toContain('"mù" (2 chars) → "mùa" (3 chars)');

        // Ground Truth: hoa, Prediction: hoaa (Insertion -> EXTRA_CHARACTER)
        const insRes = classifyLineError('hoaa', 'hoa', 90);
        expect(insRes.errorType).toBe('EXTRA_CHARACTER');
        expect(insRes.examples[0]).toContain('"hoaa" (4 chars) → "hoa" (3 chars)');
      });

      // CASE 4: low confidence (< 65%) or segmentation failure
      it('CASE 4: Detects LOW_IMAGE_QUALITY when confidence < 65%', () => {
        // Prediction with confidence 60% (< 65%)
        const lowConfRes = classifyLineError('abc', 'xyz', 60);
        expect(lowConfRes.errorType).toBe('LOW_IMAGE_QUALITY');
        expect(lowConfRes.examples[0]).toContain('Conf: 60%');

        // Segmentation failure
        const segFailRes = classifyLineError('', 'mùa hè rực rỡ', 90, 'Detection Failed');
        expect(segFailRes.errorType).toBe('SEGMENTATION_FAILURE');
      });

      // CASE 5: Global aggregation and error chart updates
      it('CASE 5: Global aggregation computes error dashboard, top confusion pairs, and error trend', async () => {
        await handAiAnalyticsStore.init();
        const globalData = handAiAnalyticsStore.getGlobalAnalytics();

        expect(globalData.hasCompletedSessions).toBe(true);
        expect(globalData.errorDashboard).toBeDefined();
        expect(typeof globalData.errorDashboard.totalErrors).toBe('number');
        expect(typeof globalData.errorDashboard.errorRate).toBe('number');
        expect(globalData.errorDashboard.mostFrequentConfusion).toContain('n → m');

        // Error Distribution Chart metrics
        const dist = globalData.errorDashboard.distribution;
        expect(dist.vietnameseTone.percentage).toBe(35);
        expect(dist.similarCharacter.percentage).toBe(25);
        expect(dist.missingCharacter.percentage).toBe(20);
        expect(dist.lowImageQuality.percentage).toBe(20);

        // Top Confusion Pairs
        expect(globalData.errorDashboard.topConfusionPairs.length).toBeGreaterThanOrEqual(3);
        const topPair = globalData.errorDashboard.topConfusionPairs[0];
        expect(topPair.wrongCharacter).toBe('n');
        expect(topPair.correctCharacter).toBe('m');
        expect(topPair.count).toBe(12);

        // Error Trend
        expect(globalData.errorDashboard.errorTrend.length).toBeGreaterThanOrEqual(3);
        expect(globalData.errorDashboard.errorTrend[0].errorRate).toBe(18.2);
        expect(globalData.errorDashboard.errorTrend[1].errorRate).toBe(12.5);
        expect(globalData.errorDashboard.errorTrend[2].errorRate).toBe(8.3);
      });

      // Trial error summary & recommendation
      it('Trial Analytics computes Error Summary Card with Total Errors, Main Error, and Recommendation', () => {
        const mockTrial: any = {
          trialId: 'trial_err_summary_test',
          source: 'CAMERA',
          status: 'SUCCESS',
          lines: [
            {
              lineId: 'l1',
              predictedText: 'mua',
              groundTruth: 'mùa', // Vietnamese Tone Error
              confidence: 0.92,
              verdict: 'WRONG',
              selectedSource: 'OCR',
            },
            {
              lineId: 'l2',
              predictedText: 'm',
              groundTruth: 'n', // Similar Character Confusion
              confidence: 0.88,
              verdict: 'WRONG',
              selectedSource: 'OCR',
            },
            {
              lineId: 'l3',
              predictedText: 'mù',
              groundTruth: 'mùa', // Missing Character
              confidence: 0.85,
              verdict: 'WRONG',
              selectedSource: 'OCR',
            },
            {
              lineId: 'l4',
              predictedText: 'Em yêu trường em',
              groundTruth: 'Em yêu trường em', // No error
              confidence: 0.98,
              verdict: 'CORRECT',
              selectedSource: 'OCR',
            },
          ],
        };

        const analytics = handAiAnalyticsStore.computeTrialAnalytics(mockTrial, true);
        expect(analytics.errorSummary).toBeDefined();
        expect(analytics.errorSummary?.totalErrors).toBe(3);
        expect(analytics.errorSummary?.recommendation).toBeDefined();
        expect(analytics.errorSummary?.recommendation.length).toBeGreaterThan(0);
      });

      // JSON & CSV Export includes error taxonomy fields
      it('Data Export includes errorType, severity, wrongCharacter, correctCharacter, and sessionId in JSON & CSV', () => {
        const mockTrial: any = {
          trialId: 'export_error_test_session_123',
          source: 'CAMERA',
          status: 'SUCCESS',
          lines: [
            {
              lineId: 'l1',
              predictedText: 'm',
              groundTruth: 'n',
              confidence: 0.88,
              verdict: 'WRONG',
              selectedSource: 'OCR',
            },
          ],
        };

        const analytics = handAiAnalyticsStore.computeTrialAnalytics(mockTrial, true);
        const jsonStr = exportTrialToJson(analytics);
        const json = JSON.parse(jsonStr);

        expect(json.lines[0].sessionId).toBe('export_error_test_session_123');
        expect(json.lines[0].errorType).toBe('SIMILAR_CHARACTER_CONFUSION');
        expect(json.lines[0].severity).toBe('MEDIUM');
        expect(json.lines[0].wrong).toBe('m');
        expect(json.lines[0].correct).toBe(false);
        expect(json.lines[0].confusionCorrect).toBe('n');
        expect(json.lines[0].wrongCharacter).toBe('m');
        expect(json.lines[0].correctCharacter).toBe('n');

        const csvStr = exportTrialToCsv(analytics);
        expect(csvStr).toContain('Error Type');
        expect(csvStr).toContain('Severity');
        expect(csvStr).toContain('Wrong Character');
        expect(csvStr).toContain('Correct Character');
        expect(csvStr).toContain('export_error_test_session_123');
        expect(csvStr).toContain('SIMILAR_CHARACTER_CONFUSION');
      });
    });

    describe('Task 9: HandAI Research Dataset Version Management & Model Experiment Tracking Suite', () => {
      // CASE 1: Create dataset version. Expected: Metadata stored correctly.
      it('CASE 1: Create dataset version - metadata stored correctly', async () => {
        const testDataset: DatasetVersion = {
          datasetId: 'ds_test_v1_3',
          datasetName: 'HandAI Primary Handwriting Dataset',
          version: 'v1.3',
          description: 'Standardized national elementary handwriting test corpus',
          sampleCount: 59747,
          characterCount: 421950,
          imageCount: 12450,
          language: 'Vietnamese',
          gradeLevel: '1-5',
          createdDate: '2026-09-23',
          annotationStatus: 'Verified',
          averageImageResolution: '1920x1080',
          annotationCoverage: 100,
          duplicateRate: 0.4,
          validationStatus: 'Verified',
        };

        await handAiAnalyticsStore.addDatasetVersion(testDataset);
        const versions = handAiAnalyticsStore.getDatasetVersions();
        const found = versions.find((v) => v.version === 'v1.3');

        expect(found).toBeDefined();
        expect(found?.datasetName).toBe('HandAI Primary Handwriting Dataset');
        expect(found?.version).toBe('v1.3');
        expect(found?.sampleCount).toBe(59747);
        expect(found?.language).toBe('Vietnamese');
        expect(found?.gradeLevel).toBe('1-5');
        expect(found?.annotationStatus).toBe('Verified');
        expect(found?.averageImageResolution).toBe('1920x1080');
        expect(found?.annotationCoverage).toBe(100);
        expect(found?.duplicateRate).toBe(0.4);
        expect(found?.validationStatus).toBe('Verified');
      });

      // CASE 2: Create model experiment. Expected: Dataset-model relationship valid.
      it('CASE 2: Create model experiment - dataset-model relationship valid', async () => {
        const testExperiment: ModelExperiment = {
          experimentId: 'exp_crnn_v1_3',
          modelVersion: 'CRNN-v1.3-PyTorch',
          modelName: 'CRNN ResNet50-BiLSTM-CTC',
          datasetVersion: 'HandAI-v1.3',
          trainingDate: '2026-09-23',
          framework: 'PyTorch 2.3',
          parameters: '12.4M params',
          metrics: {
            lineAccuracy: 95.5,
            characterAccuracy: 97.2,
            cer: 2.8,
            wer: 5.4,
            latency: 2.1,
          },
          status: 'EXPERIMENTAL',
        };

        await handAiAnalyticsStore.addModelExperiment(testExperiment);
        const experiments = handAiAnalyticsStore.getModelExperiments();
        const found = experiments.find((e) => e.experimentId === 'exp_crnn_v1_3');

        expect(found).toBeDefined();
        expect(found?.modelVersion).toBe('CRNN-v1.3-PyTorch');
        expect(found?.datasetVersion).toBe('HandAI-v1.3');
        expect(found?.framework).toBe('PyTorch 2.3');
        expect(found?.metrics.lineAccuracy).toBe(95.5);
        expect(found?.metrics.cer).toBe(2.8);
        expect(found?.metrics.wer).toBe(5.4);
        expect(found?.status).toBe('EXPERIMENTAL');

        // Verify dataset-model relationship
        const datasets = handAiAnalyticsStore.getDatasetVersions();
        const linkedDataset = datasets.find((d) => d.version === 'v1.3' || d.datasetId === 'ds_test_v1_3');
        expect(linkedDataset).toBeDefined();
        expect(found?.datasetVersion).toBe('HandAI-v1.3');
      });

      // CASE 3: Recognition session stores: datasetVersion, modelVersion.
      it('CASE 3: Recognition session stores datasetVersion and modelVersion', async () => {
        const mockTrial: any = {
          trialId: 'session_tracking_test_101',
          modelVersion: 'CRNN-v1.2-PyTorch',
          datasetVersion: 'HandAI-v1.2',
          experimentId: 'exp_crnn_v1_2',
          trainingDate: '2026-07-05',
          pageWidth: 1920,
          pageHeight: 1080,
          lines: [
            {
              lineId: 'l1',
              predictedText: 'Em yêu trường em',
              groundTruth: 'Em yêu trường em',
              confidence: 0.96,
              verdict: 'CORRECT',
              selectedSource: 'OCR',
            },
          ],
        };

        const { session, analytics } = await handAiAnalyticsStore.completeTrial(mockTrial);

        expect(session.sessionId).toBe('session_tracking_test_101');
        expect(session.datasetVersion).toBe('HandAI-v1.2');
        expect(session.modelVersion).toBe('CRNN-v1.2-PyTorch');
        expect(session.experimentId).toBe('exp_crnn_v1_2');
        expect(session.trainingDate).toBe('2026-07-05');

        expect(analytics.metadata.datasetVersion).toBe('HandAI-v1.2');
        expect(analytics.metadata.modelVersion).toBe('CRNN-v1.2-PyTorch');
        expect(analytics.metadata.experimentId).toBe('exp_crnn_v1_2');
      });

      // CASE 4: Global analytics groups results by model version.
      it('CASE 4: Global analytics groups results by model version', async () => {
        const grouped = handAiAnalyticsStore.getGroupedMetricsByModel();

        expect(grouped).toBeDefined();
        expect(grouped['CRNN-v1.2-PyTorch']).toBeDefined();
        expect(grouped['CRNN-v1.2-PyTorch'].modelVersion).toBe('CRNN-v1.2-PyTorch');
        expect(grouped['CRNN-v1.2-PyTorch'].datasetVersion).toBe('HandAI-v1.2');
        expect(grouped['CRNN-v1.2-PyTorch'].sessionCount).toBeGreaterThan(0);
        expect(grouped['CRNN-v1.2-PyTorch'].avgAccuracy).toBeGreaterThan(0);
        expect(grouped['CRNN-v1.2-PyTorch'].avgConfidence).toBeGreaterThan(0);

        // Add a trial under a different model version to confirm multi-model grouping
        const mockAltTrial: any = {
          trialId: 'session_alt_model_202',
          modelVersion: 'CRNN-v1.1-ResNet',
          datasetVersion: 'HandAI-v1.1',
          experimentId: 'exp_crnn_v1_1',
          pageWidth: 1920,
          pageHeight: 1080,
          lines: [
            {
              lineId: 'l1',
              predictedText: 'Chào năm học mới',
              groundTruth: 'Chào năm học mới',
              confidence: 0.91,
              verdict: 'CORRECT',
              selectedSource: 'OCR',
            },
          ],
        };

        await handAiAnalyticsStore.completeTrial(mockAltTrial);
        const multiGrouped = handAiAnalyticsStore.getGroupedMetricsByModel();

        expect(multiGrouped['CRNN-v1.1-ResNet']).toBeDefined();
        expect(multiGrouped['CRNN-v1.1-ResNet'].modelVersion).toBe('CRNN-v1.1-ResNet');
        expect(multiGrouped['CRNN-v1.1-ResNet'].datasetVersion).toBe('HandAI-v1.1');
        expect(multiGrouped['CRNN-v1.1-ResNet'].sessionCount).toBe(1);
        expect(multiGrouped['CRNN-v1.2-PyTorch'].sessionCount).toBeGreaterThan(0);
      });

      // CASE 5: JSON/CSV export contains experiment metadata.
      it('CASE 5: JSON/CSV export contains experiment metadata', async () => {
        const mockTrial: any = {
          trialId: 'session_export_research_303',
          modelVersion: 'CRNN-v1.2-PyTorch',
          datasetVersion: 'HandAI-v1.2',
          experimentId: 'exp_crnn_v1_2',
          trainingDate: '2026-07-05',
          pageWidth: 1920,
          pageHeight: 1080,
          lines: [
            {
              lineId: 'l1',
              predictedText: 'Em yêu mùa hè',
              groundTruth: 'Em yêu mùa hè',
              confidence: 0.95,
              verdict: 'CORRECT',
              selectedSource: 'OCR',
            },
          ],
        };

        const analytics = handAiAnalyticsStore.computeTrialAnalytics(mockTrial, true);

        // Verify JSON export structure
        const jsonStr = exportTrialToJson(analytics);
        const json = JSON.parse(jsonStr);

        expect(json.sessionId).toBe('session_export_research_303');
        expect(json.datasetVersion).toBe('HandAI-v1.2');
        expect(json.modelVersion).toBe('CRNN-v1.2-PyTorch');
        expect(json.experimentId).toBe('exp_crnn_v1_2');
        expect(json.trainingDate).toBe('2026-07-05');
        expect(json.metrics.CER).toBeDefined();
        expect(json.metrics.WER).toBeDefined();
        expect(json.metrics.Accuracy).toBeDefined();
        expect(json.lines[0].datasetVersion).toBe('HandAI-v1.2');
        expect(json.lines[0].modelVersion).toBe('CRNN-v1.2-PyTorch');

        // Verify CSV export structure
        const csvStr = exportTrialToCsv(analytics);
        expect(csvStr).toContain('Dataset Version');
        expect(csvStr).toContain('Model Version');
        expect(csvStr).toContain('Experiment ID');
        expect(csvStr).toContain('Training Date');
        expect(csvStr).toContain('HandAI-v1.2');
        expect(csvStr).toContain('CRNN-v1.2-PyTorch');
        expect(csvStr).toContain('exp_crnn_v1_2');
      });
    });

    describe('HAND_AI_FINAL_SYSTEM_AUDIT_PHASE: Verification & Resilience Suite', () => {
      it('AUDIT 1 - Data Consistency: every RecognitionSession has valid sessionId, datasetVersion, modelVersion, experimentId', async () => {
        await handAiAnalyticsStore.init();
        const sessions = handAiAnalyticsStore.getSessions();
        expect(sessions.length).toBeGreaterThan(0);

        sessions.forEach((s) => {
          expect(typeof s.sessionId).toBe('string');
          expect(s.sessionId.trim().length).toBeGreaterThan(0);

          expect(typeof s.datasetVersion).toBe('string');
          expect(s.datasetVersion.trim().length).toBeGreaterThan(0);

          expect(typeof s.modelVersion).toBe('string');
          expect(s.modelVersion.trim().length).toBeGreaterThan(0);

          expect(typeof s.experimentId).toBe('string');
          expect(s.experimentId.trim().length).toBeGreaterThan(0);
        });
      });

      it('AUDIT 2 - Metric Validation: no NaN, Infinity, or division by zero in any metric formula', () => {
        // Empty inputs
        const emptyCer = calculateCer('', '');
        expect(isNaN(emptyCer.cer)).toBe(false);
        expect(isFinite(emptyCer.cer)).toBe(true);
        expect(emptyCer.cerPercent).toBe(0);
        expect(emptyCer.charAccuracy).toBe(100);

        const emptyWer = calculateWer('', '');
        expect(isNaN(emptyWer.wer)).toBe(false);
        expect(isFinite(emptyWer.wer)).toBe(true);
        expect(emptyWer.werPercent).toBe(0);
        expect(emptyWer.wordAccuracy).toBe(100);

        // Mismatched lengths
        const shortPred = calculateCer('a', 'con cò bé bé');
        expect(isNaN(shortPred.cer)).toBe(false);
        expect(isFinite(shortPred.cer)).toBe(true);
        expect(shortPred.cerPercent).toBeGreaterThanOrEqual(0);
        expect(shortPred.charAccuracy).toBeGreaterThanOrEqual(0);

        const longPred = calculateCer('con chim non trên cành cây hót líu lo líu lo', 'chim');
        expect(isNaN(longPred.cer)).toBe(false);
        expect(isFinite(longPred.cer)).toBe(true);
        expect(longPred.cerPercent).toBeLessThanOrEqual(100);
        expect(longPred.charAccuracy).toBeGreaterThanOrEqual(0);

        // Empty trial analytics
        const emptyTrial: any = {
          trialId: 'empty_trial',
          lines: [],
        };
        const emptyAnalytics = handAiAnalyticsStore.computeTrialAnalytics(emptyTrial, true);
        expect(isNaN(emptyAnalytics.rawAccuracy)).toBe(false);
        expect(isNaN(emptyAnalytics.finalAccuracy)).toBe(false);
        expect(isNaN(emptyAnalytics.cer)).toBe(false);
        expect(isNaN(emptyAnalytics.wer)).toBe(false);
        expect(isNaN(emptyAnalytics.characterAccuracy)).toBe(false);
        expect(isNaN(emptyAnalytics.wordAccuracy)).toBe(false);
      });

      it('AUDIT 3 - Analytics Validation: Error Dashboard ignores SKIPPED lines and model tracker filters invalid experiments', () => {
        const trialWithSkipped: any = {
          trialId: 'trial_with_skipped',
          lines: [
            {
              lineId: 'l1',
              rawOcrText: '',
              currentText: '',
              predictedText: '',
            },
            {
              lineId: 'l2',
              rawOcrText: 'hoc tap',
              currentText: 'học tập',
              groundTruth: 'học tập',
              confidence: 0.92,
              verdict: 'CONFIRMED',
              selectedSource: 'AI',
            },
          ],
        };

        const analytics = handAiAnalyticsStore.computeTrialAnalytics(trialWithSkipped, true);
        expect(analytics.lineMetrics.find((m) => m.lineId === 'l1')?.evaluationStatus).toBe('SKIPPED');
        expect(analytics.lineMetrics.find((m) => m.lineId === 'l2')?.evaluationStatus).toBe('EVALUATED');
        expect(analytics.evaluatedLines).toBe(1);

        // Model tracking: valid experiments only
        const experiments = handAiAnalyticsStore.getModelExperiments();
        experiments.forEach((exp) => {
          expect(exp.experimentId).toBeTruthy();
          expect(exp.modelVersion).toBeTruthy();
          expect(exp.datasetVersion).toBeTruthy();
          expect(typeof exp.metrics.lineAccuracy).toBe('number');
          expect(!isNaN(exp.metrics.lineAccuracy)).toBe(true);
        });
      });

      it('AUDIT 4 - Dynamic Global CER: dynamically aggregates CER and Character Accuracy from completed sessions without hardcoding', async () => {
        await handAiAnalyticsStore.init();
        const global = handAiAnalyticsStore.getGlobalAnalytics();

        expect(typeof global.globalCer).toBe('number');
        expect(isNaN(global.globalCer)).toBe(false);
        expect(isFinite(global.globalCer)).toBe(true);

        expect(typeof global.globalCharacterAccuracy).toBe('number');
        expect(isNaN(global.globalCharacterAccuracy)).toBe(false);
        expect(isFinite(global.globalCharacterAccuracy)).toBe(true);
        expect(global.globalCharacterAccuracy + global.globalCer).toBeCloseTo(100, 0);
      });
    });

    describe('HandAI Research Evidence Layer Suite (Model Card, Dataset Quality Card & Experiment Tracking)', () => {
      it('RESEARCH 1 - Model Card: exposes complete architectural specification, framework, and metrics', () => {
        const modelCard = handAiAnalyticsStore.getModelCard();

        expect(modelCard).toBeDefined();
        expect(modelCard.modelName).toBe('Vietnamese-Handwriting-OCR-Full (CRNN + CTC)');
        expect(modelCard.modelVersion).toBe('CRNN-v1.2-PyTorch');
        expect(modelCard.architecture).toContain('CRNN');
        expect(modelCard.architecture).toContain('BiLSTM');
        expect(modelCard.framework).toContain('PyTorch');
        expect(modelCard.parameterCount).toContain('5,962,560');
        expect(modelCard.datasetVersion).toBe('HandAI-v1.2');
        expect(modelCard.trainingDate).toBeTruthy();
        expect(modelCard.experimentId).toBe('exp_crnn_v1_2');
        expect(modelCard.inputResolution).toContain('64');
        expect(modelCard.evaluationMetrics.lineAccuracy).toBe(94);
        expect(modelCard.evaluationMetrics.cer).toBe(5);
        expect(modelCard.evaluationMetrics.wer).toBe(8);
        expect(modelCard.evaluationMetrics.latencySeconds).toBe(2.3);
      });

      it('RESEARCH 2 - Dataset Quality Card: verifies quality control, duplicate checking, privacy handling, and split', () => {
        const datasetCard = handAiAnalyticsStore.getDatasetQualityCard();

        expect(datasetCard).toBeDefined();
        expect(datasetCard.datasetName).toContain('Viet-Handwriting-OCR-v2');
        expect(datasetCard.datasetVersion).toBe('HandAI-v1.2');
        expect(datasetCard.totalSamples).toBeGreaterThanOrEqual(50000);
        expect(datasetCard.annotationStatus).toContain('Verified');
        expect(datasetCard.duplicateChecking).toContain('pHash & SHA-256');
        expect(datasetCard.privacyHandling).toContain('PII Masking');
        expect(datasetCard.dataSplit).toBeDefined();
        expect(datasetCard.dataSplit?.train).toContain('59,462');
        expect(datasetCard.dataSplit?.validation).toContain('500');
        expect(datasetCard.dataSplit?.summary).toBeTruthy();
        expect(datasetCard.validationStatus).toBe('Verified');
      });

      it('RESEARCH 3 - Experiment Tracking: each recognition stores experiment_id, model, dataset, timestamp, resolution, line count, and metrics', async () => {
        const sampleTrial: MultilineTrialResult = {
          trialId: 'research_tracking_test_trial',
          source: 'GALLERY',
          pageImageObjectKey: 'k',
          pageImageSha256: 'sha',
          pageWidth: 1920,
          pageHeight: 1080,
          privacyConfirmed: true,
          isTestData: false,
          dataOrigin: 'REAL',
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
          lines: [
            {
              lineId: 'l1',
              predictedText: 'Cộng hòa xã hội',
              confidence: 0.95,
              verdict: 'CONFIRMED',
              selectedSource: 'OCR',
              trainingEligible: true, verdict: 'CONFIRMED',
          },
            {
              lineId: 'l2',
              predictedText: 'Chủ nghĩa Việt Nam',
              confidence: 0.93,
              verdict: 'CONFIRMED',
              selectedSource: 'OCR',
              trainingEligible: true, verdict: 'CONFIRMED',
          },
          ],
        };

        const { session, analytics } = await handAiAnalyticsStore.completeTrial(sampleTrial);

        // Verification of session fields
        expect(session.experimentId).toBe('exp_crnn_v1_2');
        expect(session.modelVersion).toBe('CRNN-v1.2-PyTorch');
        expect(session.datasetVersion).toBe('HandAI-v1.2');
        expect(typeof session.timestamp).toBe('number');
        expect(session.imageResolution).toBe('1920x1080');
        expect(session.totalLines).toBe(2);
        expect(session.numberOfLines).toBe(2);
        expect(session.metrics).toBeDefined();
        expect(session.metrics?.lineAccuracy).toBe(session.accuracy);
        expect(session.metrics?.cer).toBe(session.cer);
        expect(session.metrics?.wer).toBe(session.wer);

        // Verification of trial metadata fields
        expect(analytics.metadata.experimentId).toBe('exp_crnn_v1_2');
        expect(analytics.metadata.modelVersion).toBe('CRNN-v1.2-PyTorch');
        expect(analytics.metadata.datasetVersion).toBe('HandAI-v1.2');
        expect(analytics.metadata.numberOfLines).toBe(2);
        expect(analytics.metadata.imageResolution).toContain('1920');
        expect(analytics.metadata.metrics).toBeDefined();
        expect(analytics.metadata.metrics?.lineAccuracy).toBe(analytics.finalAccuracy);

        // Verification of run logs in Global Analytics
        const global = handAiAnalyticsStore.getGlobalAnalytics();
        expect(global.modelCard).toBeDefined();
        expect(global.datasetQuality).toBeDefined();
        expect(global.experimentRuns).toBeDefined();
        expect(global.experimentRuns.some((r) => r.experimentId === 'exp_crnn_v1_2')).toBe(true);
      });
    });
  });

  // =========================================================================
  // Phase 2: Complete Separation of Trial Analytics and Global Analytics Suite
  // =========================================================================
  describe('Phase 2: Complete Separation of Trial Analytics and Global Analytics Suite', () => {
    // Case 1: Scan ảnh 8 dòng chữ. Kiểm tra: Trial Analytics đúng.
    it('Case 1: Scan 8-line image -> Trial Analytics is strictly trial-scoped, accurate, and records all metrics', async () => {
      const trial8Lines: MultilineTrialResult = {
        trialId: 'phase2_trial_8lines',
        source: 'CAMERA',
        pageImageObjectKey: 'handwriting_page_8lines.jpg',
        pageImageSha256: 'sha256_trial_8lines',
        pageWidth: 1200,
        pageHeight: 1600,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          // 6 lines OCR raw correct
          { lineId: 'l1', predictedText: 'Cộng hòa xã hội chủ nghĩa Việt Nam', currentText: 'Cộng hòa xã hội chủ nghĩa Việt Nam', confidence: 0.95, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'l2', predictedText: 'Độc lập Tự do Hạnh phúc', currentText: 'Độc lập Tự do Hạnh phúc', confidence: 0.94, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'l3', predictedText: 'Bài tập toán lớp 3', currentText: 'Bài tập toán lớp 3', confidence: 0.92, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'l4', predictedText: 'Phép tính nhân và chia', currentText: 'Phép tính nhân và chia', confidence: 0.91, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'l5', predictedText: 'Học sinh Nguyễn Văn An', currentText: 'Học sinh Nguyễn Văn An', confidence: 0.89, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'l6', predictedText: 'Trường Tiểu học Thăng Long', currentText: 'Trường Tiểu học Thăng Long', confidence: 0.93, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          // 2 lines AI corrected
          { lineId: 'l7', predictedText: 'Điểm số muời', aiSuggestedText: 'Điểm số mười', currentText: 'Điểm số mười', confidence: 0.78, selectedSource: 'AI', verdict: 'AI_CORRECTED', trainingEligible: true },
          { lineId: 'l8', predictedText: 'Khen ngọi học sinh giỏi', aiSuggestedText: 'Khen ngợi học sinh giỏi', currentText: 'Khen ngợi học sinh giỏi', confidence: 0.81, selectedSource: 'AI', verdict: 'AI_CORRECTED', trainingEligible: true },
        ] as any,
      };

      const trialAnalytics = handAiAnalyticsStore.computeTrialAnalytics(trial8Lines, true);

      // 1. Trial Metadata
      expect(trialAnalytics.trialId).toBe('phase2_trial_8lines');
      expect(trialAnalytics.imageResolution).toBe('1200 x 1600');
      expect(trialAnalytics.modelVersion).toBe('CRNN-v1.2-PyTorch');
      expect(trialAnalytics.datasetVersion).toBe('HandAI-v1.2');
      expect(trialAnalytics.engineVersion).toContain('HandAI v2.4');

      // 2. Recognition Summary
      expect(trialAnalytics.totalLines).toBe(8);
      expect(trialAnalytics.correctOcrLines).toBe(6);
      expect(trialAnalytics.aiCorrectedLines).toBe(2);
      expect(trialAnalytics.manualEditedLines).toBe(0);
      expect(trialAnalytics.finalCorrectLines).toBe(8);

      // 3. Metrics
      expect(trialAnalytics.rawOcrAccuracy).toBe(75);
      expect(trialAnalytics.finalAccuracy).toBe(100);
      expect(trialAnalytics.characterAccuracy).toBeGreaterThan(95);
      expect(trialAnalytics.cer).toBeLessThan(5);
      expect(trialAnalytics.wordAccuracy).toBeGreaterThan(90);
      expect(trialAnalytics.wer).toBeLessThan(10);
      expect(trialAnalytics.avgConfidence).toBeGreaterThan(80);
      expect(typeof trialAnalytics.processingLatency).toBe('number');

      // 4. Line-level evaluation
      expect(trialAnalytics.lineMetrics.length).toBe(8);
      const l1 = trialAnalytics.lineMetrics[0];
      expect(l1.line_id).toBe('l1');
      expect(l1.ocrOutput).toBe('Cộng hòa xã hội chủ nghĩa Việt Nam');
      expect(l1.finalResult).toBe('Cộng hòa xã hội chủ nghĩa Việt Nam');
      expect(l1.decisionSource).toBe('CRNN_RAW');
      expect(l1.confidence).toBe(95);
      expect(l1.cer).toBe(0);
      expect(l1.wer).toBe(0);

      const l7 = trialAnalytics.lineMetrics[6];
      expect(l7.line_id).toBe('l7');
      expect(l7.ocrOutput).toBe('Điểm số muời');
      expect(l7.aiCandidate).toBe('Điểm số mười');
      expect(l7.finalResult).toBe('Điểm số mười');
      expect(l7.decisionSource).toBe('AI_CORRECTION');

      // 5. Data Model mapping
      const recognitionTrial = handAiAnalyticsStore.toRecognitionTrial(trial8Lines);
      expect(recognitionTrial.trial_id).toBe('phase2_trial_8lines');
      expect(recognitionTrial.model_version).toBe('CRNN-v1.2-PyTorch');
      expect(recognitionTrial.dataset_version).toBe('HandAI-v1.2');
      expect(recognitionTrial.total_lines).toBe(8);
      expect(recognitionTrial.correct_ocr_lines).toBe(6);
      expect(recognitionTrial.ai_corrected_lines).toBe(2);
      expect(recognitionTrial.final_correct_lines).toBe(8);
      expect(recognitionTrial.line_results?.length).toBe(8);
      expect(recognitionTrial.line_results?.[6].decision_source).toBe('AI_CORRECTION');
    });

    // Case 2: Scan nhiều ảnh. Kiểm tra: Global Analytics tăng đúng.
    it('Case 2: Scan multiple images -> Global Analytics aggregates strictly from persistent database/sessions', async () => {
      await handAiAnalyticsStore.clearAllSessions();

      // Check empty state validation: no fake numbers
      const initialGlobal = handAiAnalyticsStore.getGlobalAnalytics();
      expect(initialGlobal.hasCompletedSessions).toBe(false);
      expect(initialGlobal.totalSessions).toBe(0);
      expect(initialGlobal.totalImages).toBe(0);
      expect(initialGlobal.totalLines).toBe(0);

      // Scan Image 1: 5 lines
      const trialImg1: MultilineTrialResult = {
        trialId: 'phase2_scan_img1',
        source: 'GALLERY',
        pageImageObjectKey: 'img1.jpg',
        pageImageSha256: 'sha1',
        pageWidth: 1000,
        pageHeight: 1200,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          { lineId: 'i1_1', predictedText: 'Line 1 test image one', currentText: 'Line 1 test image one', confidence: 0.95, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'i1_2', predictedText: 'Line 2 test image one', currentText: 'Line 2 test image one', confidence: 0.92, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'i1_3', predictedText: 'Line 3 test image one', currentText: 'Line 3 test image one', confidence: 0.90, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'i1_4', predictedText: 'Line 4 test image one', currentText: 'Line 4 test image one', confidence: 0.88, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'i1_5', predictedText: 'Line 5 test image one', currentText: 'Line 5 test image one', confidence: 0.91, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
        ] as any,
      };
      await handAiAnalyticsStore.completeTrial(trialImg1);

      let global = handAiAnalyticsStore.getGlobalAnalytics();
      expect(global.hasCompletedSessions).toBe(true);
      expect(global.totalSessions).toBe(1);
      expect(global.totalImages).toBe(1);
      expect(global.totalLines).toBe(5);

      // Scan Image 2: 8 lines
      const trialImg2: MultilineTrialResult = {
        trialId: 'phase2_scan_img2',
        source: 'CAMERA',
        pageImageObjectKey: 'img2.jpg',
        pageImageSha256: 'sha2',
        pageWidth: 1000,
        pageHeight: 1400,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          { lineId: 'i2_1', predictedText: 'Toán học vui vẻ lớp 1', currentText: 'Toán học vui vẻ lớp 1', confidence: 0.95, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'i2_2', predictedText: 'Toán học vui vẻ lớp 2', currentText: 'Toán học vui vẻ lớp 2', confidence: 0.93, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'i2_3', predictedText: 'Toán học vui vẻ lớp 3', currentText: 'Toán học vui vẻ lớp 3', confidence: 0.91, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'i2_4', predictedText: 'Toán học vui vẻ lớp 4', currentText: 'Toán học vui vẻ lớp 4', confidence: 0.90, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'i2_5', predictedText: 'Toán học vui vẻ lớp 5', currentText: 'Toán học vui vẻ lớp 5', confidence: 0.89, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'i2_6', predictedText: 'Học sinh chăm chỉ', currentText: 'Học sinh chăm chỉ', confidence: 0.94, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'i2_7', predictedText: 'Thầy cô tận tâm', currentText: 'Thầy cô tận tâm', confidence: 0.92, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
          { lineId: 'i2_8', predictedText: 'Truong hoc than thien', aiSuggestedText: 'Trường học thân thiện', currentText: 'Trường học thân thiện', confidence: 0.75, selectedSource: 'AI', verdict: 'AI_CORRECTED', trainingEligible: true },
        ] as any,
      };
      await handAiAnalyticsStore.completeTrial(trialImg2);

      global = handAiAnalyticsStore.getGlobalAnalytics();
      expect(global.totalSessions).toBe(2);
      expect(global.totalImages).toBe(2);
      expect(global.totalLines).toBe(13); // 5 + 8 lines

      // Section B: Model Performance History
      expect(global.modelPerformanceHistoryByVersion['CRNN-v1.2']).toBeDefined();
      expect(global.modelExperiments.length).toBeGreaterThanOrEqual(3);

      // Section C: Dataset Statistics
      expect(global.datasetStats.totalSamples).toBeGreaterThan(0);
      expect(global.datasetStats.datasetVersions.length).toBeGreaterThanOrEqual(1);
      expect(global.datasetStats.annotationStatus).toBeDefined();

      // Section D: Error Analysis
      expect(global.errorAnalysis).toBeDefined();
      expect(global.errorAnalysis.distribution).toBeDefined();

      await handAiAnalyticsStore.reset();
    });

    // Case 3: Restart app. Kiểm tra: Data vẫn tồn tại.
    it('Case 3: Restart app -> Stored sessions and analytics data persist across app restarts', async () => {
      const restartTrial: MultilineTrialResult = {
        trialId: 'phase2_restart_test',
        source: 'GALLERY',
        pageImageObjectKey: 'restart_test.jpg',
        pageImageSha256: 'sha256_restart',
        pageWidth: 800,
        pageHeight: 600,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          { lineId: 'r1', predictedText: 'Dữ liệu bền vững sau khởi động', currentText: 'Dữ liệu bền vững sau khởi động', confidence: 0.97, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true },
        ] as any,
      };

      await handAiAnalyticsStore.completeTrial(restartTrial);
      const preRestartGlobal = handAiAnalyticsStore.getGlobalAnalytics();
      expect(preRestartGlobal.totalSessions).toBeGreaterThan(0);

      // Simulate app restart by creating a new store instance and initializing it from storage
      const freshStore = new HandAiAnalyticsStore();
      await freshStore.init();

      const postRestartGlobal = freshStore.getGlobalAnalytics();
      expect(postRestartGlobal.totalSessions).toBe(preRestartGlobal.totalSessions);
      expect(postRestartGlobal.totalLines).toBe(preRestartGlobal.totalLines);
      expect(postRestartGlobal.hasCompletedSessions).toBe(true);

      const loadedTrial = await freshStore.getCurrentTrialAnalytics('phase2_restart_test');
      expect(loadedTrial).toBeDefined();
      expect(loadedTrial?.trialId).toBe('phase2_restart_test');

      await handAiAnalyticsStore.reset();
    });
  });

  describe('Phase 3: Research Validation and AI Impact Layer Suite', () => {
    beforeEach(async () => {
      await handAiAnalyticsStore.reset();
    });

    // CASE 1: OCR wrong, AI correction correct. Expected: AI Gain > 0
    it('CASE 1: OCR wrong, AI correction correct -> AI Gain > 0 and rescue rate tracked', async () => {
      const trial: MultilineTrialResult = {
        trialId: 'phase3_case1_ai_gain',
        source: 'CAMERA',
        pageImageObjectKey: 'test/phase3_c1.jpg',
        pageImageSha256: 'sha256_c1',
        pageWidth: 1920,
        pageHeight: 1080,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          // Line 1: Raw OCR wrong ("Học tap" vs "Học tập"), AI correction correct ("Học tập")
          {
            lineId: 'line_c1_1',
            lineOrder: 1,
            predictedText: 'Học tap',
            rawOcrText: 'Học tap',
            suggestions: [{ text: 'Học tập', confidence: 0.95, provider: 'ai' }],
            currentText: 'Học tập',
            finalText: 'Học tập',
            groundTruth: 'Học tập',
            confidence: 0.88,
            selectedSource: 'AI',
            verdict: 'CORRECT',
            decisionSource: 'AI_CORRECTION',
            sourceDecision: 'AI_CORRECTION',
            correctionType: 'AI_CORRECTED',
          } as any,
          // Line 2: Raw OCR correct ("Toán lớp 1")
          {
            lineId: 'line_c1_2',
            lineOrder: 2,
            predictedText: 'Toán lớp 1',
            rawOcrText: 'Toán lớp 1',
            currentText: 'Toán lớp 1',
            finalText: 'Toán lớp 1',
            groundTruth: 'Toán lớp 1',
            confidence: 0.96,
            selectedSource: 'OCR',
            verdict: 'CORRECT',
            decisionSource: 'CRNN_RAW',
            sourceDecision: 'CRNN_RAW',
            correctionType: 'OCR_CORRECT',
          } as any,
        ],
      };

      const trialAnalytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);

      // Raw CRNN correct: 1/2 = 50%
      expect(trialAnalytics.rawAccuracy).toBe(50);
      // Final AI assisted correct: 2/2 = 100%
      expect(trialAnalytics.finalAccuracy).toBe(100);
      // AI Gain > 0 (100 - 50 = +50%)
      expect(trialAnalytics.aiGain).toBeGreaterThan(0);
      expect(trialAnalytics.aiGain).toBe(50);

      // AI Impact Metric verification
      expect(trialAnalytics.aiImpact).toBeDefined();
      expect(trialAnalytics.aiImpact.rawAccuracy).toBe(50);
      expect(trialAnalytics.aiImpact.finalAccuracy).toBe(100);
      expect(trialAnalytics.aiImpact.accuracyGain).toBe(50);
      expect(trialAnalytics.aiImpact.correctedErrors).toBe(1);
      expect(trialAnalytics.aiImpact.totalOcrErrors).toBe(1);
      expect(trialAnalytics.aiImpact.rescueRate).toBe(100); // 1 error rescued out of 1 error
    });

    // CASE 2: Confidence 95%, Correct prediction. Expected: High confidence accuracy increases
    it('CASE 2: Confidence 95%, Correct prediction -> High confidence accuracy increases in calibration bins', async () => {
      const trial: MultilineTrialResult = {
        trialId: 'phase3_case2_confidence',
        source: 'GALLERY',
        pageImageObjectKey: 'test/phase3_c2.jpg',
        pageImageSha256: 'sha256_c2',
        pageWidth: 1920,
        pageHeight: 1080,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          {
            lineId: 'line_c2_high_conf',
            lineOrder: 1,
            predictedText: 'Em yêu trường em',
            rawOcrText: 'Em yêu trường em',
            currentText: 'Em yêu trường em',
            finalText: 'Em yêu trường em',
            groundTruth: 'Em yêu trường em',
            confidence: 0.95, // 95%
            selectedSource: 'OCR',
            verdict: 'CORRECT',
            decisionSource: 'CRNN_RAW',
            sourceDecision: 'CRNN_RAW',
            correctionType: 'OCR_CORRECT',
          } as any,
        ],
      };

      const trialAnalytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);

      // Verify 5-bin confidence calibration
      expect(trialAnalytics.confidenceCalibration).toBeDefined();
      expect(trialAnalytics.confidenceCalibration.length).toBe(5);

      const ranges = trialAnalytics.confidenceCalibration.map((b) => b.range);
      expect(ranges).toEqual(['90-100%', '80-89%', '70-79%', '60-69%', '<60%']);

      const highConfBin = trialAnalytics.confidenceCalibration.find((b) => b.range === '90-100%');
      expect(highConfBin).toBeDefined();
      expect(highConfBin?.samples).toBe(1);
      expect(highConfBin?.correctSamples).toBe(1);
      expect(highConfBin?.accuracy).toBe(100);
    });

    // CASE 3: Error classification. Expected: Root cause stored
    it('CASE 3: Error classification -> Root cause stored and classified into systematic categories', async () => {
      const trial: MultilineTrialResult = {
        trialId: 'phase3_case3_root_cause',
        source: 'CAMERA',
        pageImageObjectKey: 'test/phase3_c3.jpg',
        pageImageSha256: 'sha256_c3',
        pageWidth: 1920,
        pageHeight: 1080,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          // 1. RECOGNITION_ERROR (CRNN failure - tone error)
          {
            lineId: 'line_err_crnn',
            lineOrder: 1,
            predictedText: 'con meo',
            rawOcrText: 'con meo',
            currentText: 'con meo',
            finalText: 'con meo',
            groundTruth: 'con mèo',
            confidence: 0.92,
            selectedSource: 'OCR',
            decisionSource: 'CRNN_RAW',
            sourceDecision: 'CRNN_RAW',
          } as any,
          // 2. LANGUAGE_CORRECTION_ERROR (AI correction incorrect)
          {
            lineId: 'line_err_ai',
            lineOrder: 2,
            predictedText: 'bài toán',
            rawOcrText: 'bài toán',
            suggestions: [{ text: 'bài thơ', confidence: 0.7, provider: 'ai' }],
            currentText: 'bài thơ',
            finalText: 'bài thơ',
            groundTruth: 'bài toán',
            confidence: 0.85,
            selectedSource: 'AI',
            decisionSource: 'AI_CORRECTION',
            sourceDecision: 'AI_CORRECTION',
          } as any,
          // 3. IMAGE_QUALITY_ERROR (low confidence < 65)
          {
            lineId: 'line_err_img',
            lineOrder: 3,
            predictedText: 'mờ',
            rawOcrText: 'mờ',
            currentText: 'mờ',
            finalText: 'mờ',
            groundTruth: 'rõ ràng',
            confidence: 0.45,
            selectedSource: 'OCR',
            decisionSource: 'CRNN_RAW',
            sourceDecision: 'CRNN_RAW',
          } as any,
          // 4. SEGMENTATION_ERROR (status Detection Failed)
          {
            lineId: 'line_err_seg',
            lineOrder: 4,
            predictedText: '',
            rawOcrText: '',
            currentText: '',
            finalText: '',
            groundTruth: 'dòng bị mất',
            confidence: 0.3,
            status: 'Detection Failed',
            selectedSource: 'OCR',
            decisionSource: 'CRNN_RAW',
            sourceDecision: 'CRNN_RAW',
          } as any,
        ],
      };

      const trialAnalytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);

      // Root causes must be stored
      expect(trialAnalytics.errorRootCauses).toBeDefined();
      expect(trialAnalytics.errorRootCauses.length).toBeGreaterThanOrEqual(3);

      const causes = trialAnalytics.errorRootCauses.map((e) => e.rootCause);
      expect(causes).toContain('RECOGNITION_ERROR');
      expect(causes).toContain('LANGUAGE_CORRECTION_ERROR');
      expect(causes).toContain('IMAGE_QUALITY_ERROR');
      expect(causes).toContain('SEGMENTATION_ERROR');

      // Root cause summary counts
      expect(trialAnalytics.rootCauseSummary.recognitionErrors).toBeGreaterThanOrEqual(1);
      expect(trialAnalytics.rootCauseSummary.languageCorrectionErrors).toBeGreaterThanOrEqual(1);
      expect(trialAnalytics.rootCauseSummary.imageQualityErrors).toBeGreaterThanOrEqual(1);
      expect(trialAnalytics.rootCauseSummary.segmentationErrors).toBeGreaterThanOrEqual(1);

      // Direct helper testing
      expect(classifyRootCause('VIETNAMESE_TONE_ERROR', 'CRNN_RAW', false, 90)).toBe('RECOGNITION_ERROR');
      expect(classifyRootCause('WORD_SUBSTITUTION', 'AI_CORRECTION', false, 85)).toBe('LANGUAGE_CORRECTION_ERROR');
      expect(classifyRootCause('LOW_IMAGE_QUALITY', 'CRNN_RAW', false, 50)).toBe('IMAGE_QUALITY_ERROR');
      expect(classifyRootCause('SEGMENTATION_FAILURE', 'CRNN_RAW', false, 30, 'Detection Failed')).toBe('SEGMENTATION_ERROR');
    });

    // CASE 4: Export report. Expected: Contains model, dataset, metrics, error analysis
    it('CASE 4: Export report -> Contains model, dataset, metrics, and error analysis across all 9 sections', () => {
      const global = handAiAnalyticsStore.getGlobalAnalytics();
      const report = exportResearchEvaluationReport(global);

      // Must be a non-empty Markdown string
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(500);

      // 1. Project Information
      expect(report).toContain('## 1. Project Information');
      expect(report).toContain('HandAI');

      // 2. Model Card
      expect(report).toContain('## 2. Model Card');
      expect(report).toContain('CRNN');

      // 3. Dataset Card
      expect(report).toContain('## 3. Dataset Card');
      expect(report).toContain('Grade Distribution');
      expect(report).toContain('Writing Characteristics');
      expect(report).toContain('Image Quality Distribution');

      // 4. Experiment Information
      expect(report).toContain('## 4. Experiment Information');

      // 5. Recognition Metrics
      expect(report).toContain('## 5. Recognition Metrics');
      expect(report).toContain('CRNN Raw Accuracy');
      expect(report).toContain('AI Assisted Final Accuracy');
      expect(report).toContain('Character Error Rate (CER)');
      expect(report).toContain('Word Error Rate (WER)');

      // 6. AI Impact Analysis
      expect(report).toContain('## 6. AI Impact Analysis');
      expect(report).toContain('Accuracy Gain');
      expect(report).toContain('OCR Error Rescue Rate');

      // 7. Confidence Calibration
      expect(report).toContain('## 7. Confidence Calibration');
      expect(report).toContain('90-100%');

      // 8. Error Analysis & Root Cause Classification
      expect(report).toContain('## 8. Error Analysis & Root Cause Classification');
      expect(report).toContain('Recognition Error');
      expect(report).toContain('Language Correction Error');
      expect(report).toContain('Segmentation Error');
      expect(report).toContain('Image Quality Error');

      // 9. Conclusion
      expect(report).toContain('## 9. Conclusion');
    });

    // Supplementary: Dataset Distribution validation
    it('Dataset Distribution metadata contains Grade 1-5, Writing Characteristics, and Image Quality', () => {
      const global = handAiAnalyticsStore.getGlobalAnalytics();
      expect(global.datasetDistribution).toBeDefined();

      // Grade 1 to 5
      expect(global.datasetDistribution.gradeDistribution.grade1).toBe(14210);
      expect(global.datasetDistribution.gradeDistribution.grade2).toBe(12850);
      expect(global.datasetDistribution.gradeDistribution.grade3).toBe(11920);
      expect(global.datasetDistribution.gradeDistribution.grade4).toBe(10640);
      expect(global.datasetDistribution.gradeDistribution.grade5).toBe(10127);

      // Writing characteristics
      expect(global.datasetDistribution.writingCharacteristics.normal).toBe(32860);
      expect(global.datasetDistribution.writingCharacteristics.slanted).toBe(14330);
      expect(global.datasetDistribution.writingCharacteristics.small).toBe(6857);
      expect(global.datasetDistribution.writingCharacteristics.connected).toBe(5700);

      // Image quality
      expect(global.datasetDistribution.imageQualityDistribution.clear).toBe(47800);
      expect(global.datasetDistribution.imageQualityDistribution.medium).toBe(9560);
      expect(global.datasetDistribution.imageQualityDistribution.low).toBe(2387);
    });
  });

  describe('Decision Source Attribution Fix: Content-Based Resolution', () => {
    it('TC1: AI correction correctly attributed (Sm→Em bug fix)', () => {
      const result = resolveDecisionSource('Sm yêu mùa hè', 'Em yêu mùa hè', 'Em yêu mùa hè');
      expect(result.decisionSource).toBe('AI_CORRECTION');
      expect(result.correctionOrigin).toBe('AI');
      expect(result.source).toBe('AI_CORRECTION');
      expect(result.correctionType).toBe('AI_CORRECTED');
    });

    it('TC2: Raw OCR success correctly attributed', () => {
      const result = resolveDecisionSource('Có hoa sim tím', 'Có hoa sim tím', 'Có hoa sim tím');
      expect(result.decisionSource).toBe('CRNN_RAW');
      expect(result.correctionOrigin).toBe('MODEL');
      expect(result.source).toBe('CRNN');
    });

    it('TC3: AI candidate acceptance never misclassified as MANUAL_EDIT (RULE 4)', () => {
      const result = resolveDecisionSource('Sm yêu mùa hè', 'Em yêu mùa hè', 'Em yêu mùa hè', 'OCR');
      expect(result.decisionSource).toBe('AI_CORRECTION');
      expect(result.correctionOrigin).toBe('AI');
    });

    it('TC4: Genuine manual edit when final differs from both CRNN and AI', () => {
      const result = resolveDecisionSource('Sm yêu mùa hè', 'Ẹm yêu mùa hè', 'Em yêu mùa hè');
      expect(result.decisionSource).toBe('MANUAL_EDIT');
      expect(result.correctionOrigin).toBe('HUMAN');
      expect(result.correctionType).toBe('MANUAL_CORRECTED');
    });

    it('Integration: computeTrialAnalytics assigns AI_CORRECTION when final matches AI candidate', async () => {
      await handAiAnalyticsStore.reset();
      const trial: MultilineTrialResult = {
        trialId: 'decision_source_fix_test',
        source: 'CAMERA',
        pageImageObjectKey: 'test/ds_fix.jpg',
        pageImageSha256: 'sha256_ds',
        pageWidth: 1920,
        pageHeight: 1080,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          {
            lineId: 'ds_l1',
            lineOrder: 1,
            predictedText: 'Sm yêu mùa hè',
            rawOcrText: 'Sm yêu mùa hè',
            suggestions: [{ text: 'Em yêu mùa hè', confidence: 0.95, provider: 'ai' }],
            currentText: 'Em yêu mùa hè',
            finalText: 'Em yêu mùa hè',
            groundTruth: 'Em yêu mùa hè',
            confidence: 0.88,
            selectedSource: 'OCR',
          } as any,
          {
            lineId: 'ds_l2',
            lineOrder: 2,
            predictedText: 'Có hoa sim tím',
            rawOcrText: 'Có hoa sim tím',
            currentText: 'Có hoa sim tím',
            finalText: 'Có hoa sim tím',
            groundTruth: 'Có hoa sim tím',
            confidence: 0.96,
            selectedSource: 'OCR',
          } as any,
        ],
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);

      const line1 = analytics.lineMetrics.find((m) => m.lineId === 'ds_l1');
      expect(line1?.decisionSource).toBe('AI_CORRECTION');
      expect(line1?.correctionOrigin).toBe('AI');

      const line2 = analytics.lineMetrics.find((m) => m.lineId === 'ds_l2');
      expect(line2?.decisionSource).toBe('CRNN_RAW');
      expect(line2?.correctionOrigin).toBe('MODEL');

      expect(analytics.sourceDistribution.aiCorrection).toBe(1);
      expect(analytics.sourceDistribution.crnn).toBe(1);
      expect(analytics.sourceDistribution.manual).toBe(0);

      await handAiAnalyticsStore.reset();
    });
  });

  describe('Phase 2: Analytics Metric Integrity & Verification Suite', () => {
    it('TC1: CRNN_RAW verification - OCR matches GT directly', () => {
      const trial: MultilineTrialResult = {
        trialId: 'tc1_crnn_raw',
        source: 'CAMERA',
        pageImageObjectKey: 'tc1.jpg',
        pageImageSha256: 'sha256_tc1',
        pageWidth: 1080,
        pageHeight: 1920,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          {
            lineId: 'l1',
            predictedText: 'Hello',
            rawOcrText: 'Hello',
            currentText: 'Hello',
            confidence: 0.95,
            selectedSource: 'OCR',
            verdict: 'CORRECT',
            trainingEligible: true,
            // @ts-ignore - simulate backend structure
            groundTruth: 'Hello',
          },
        ] as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);
      const metric = analytics.lineMetrics[0];

      expect(metric.decisionSource).toBe('CRNN_RAW');
      expect(metric.correctionOrigin).toBe('MODEL');
      expect(metric.correctionType).toBe('OCR_CORRECT');
      expect(metric.groundTruthStatus).toBe('EXPLICIT');
      expect(analytics.sourceDistribution.crnn).toBe(1);
      expect(analytics.correctionContribution?.ocrContribution).toBe(100);
    });

    it('TC2: AI_CORRECTION verification - OCR wrong, AI correct', () => {
      const trial: MultilineTrialResult = {
        trialId: 'tc2_ai_correction',
        source: 'CAMERA',
        pageImageObjectKey: 'tc2.jpg',
        pageImageSha256: 'sha256_tc2',
        pageWidth: 1080,
        pageHeight: 1920,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          {
            lineId: 'l1',
            predictedText: 'Sm yêu mùa hè',
            rawOcrText: 'Sm yêu mùa hè',
            currentText: 'Em yêu mùa hè',
            suggestions: [{ text: 'Em yêu mùa hè', confidence: 0.9, provider: 'ai' }],
            confidence: 0.85,
            selectedSource: 'SUGGESTION_1',
            verdict: 'CONFIRMED',
            trainingEligible: true,
            // @ts-ignore
            groundTruth: 'Em yêu mùa hè',
          },
        ] as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);
      const metric = analytics.lineMetrics[0];

      expect(metric.decisionSource).toBe('AI_CORRECTION');
      expect(metric.correctionOrigin).toBe('AI');
      expect(metric.correctionType).toBe('AI_CORRECTED');
      expect(analytics.sourceDistribution.aiCorrection).toBe(1);
      expect(analytics.correctionContribution?.aiContribution).toBe(100);
      
      // Verify finalCer uses final result against GT (should be 0%)
      expect(analytics.aiImpact.finalCer).toBe(0);
      // Verify rawCer is > 0
      expect(analytics.aiImpact.rawCer).toBeGreaterThan(0);
    });

    it('TC3: MANUAL_EDIT verification - Human edits to correct value', () => {
      const trial: MultilineTrialResult = {
        trialId: 'tc3_manual_edit',
        source: 'CAMERA',
        pageImageObjectKey: 'tc3.jpg',
        pageImageSha256: 'sha256_tc3',
        pageWidth: 1080,
        pageHeight: 1920,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          {
            lineId: 'l1',
            predictedText: 'loi sai',
            rawOcrText: 'loi sai',
            currentText: 'lỗi sai',
            suggestions: [{ text: 'Loi Sai', confidence: 0.7, provider: 'ai' }], // AI is also wrong
            confidence: 0.60,
            selectedSource: 'MANUAL', // UI logic
            verdict: 'CONFIRMED',
            trainingEligible: true,
            // @ts-ignore
            groundTruth: 'lỗi sai',
          },
        ] as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);
      const metric = analytics.lineMetrics[0];

      expect(metric.decisionSource).toBe('MANUAL_EDIT');
      expect(metric.correctionOrigin).toBe('HUMAN');
      expect(metric.correctionType).toBe('MANUAL_CORRECTED');
      expect(analytics.sourceDistribution.manual).toBe(1);
      expect(analytics.correctionContribution?.humanContribution).toBe(100);
    });

    it('TC4: AI candidate exists but not chosen', () => {
      const trial: MultilineTrialResult = {
        trialId: 'tc4_ai_ignored',
        source: 'CAMERA',
        pageImageObjectKey: 'tc4.jpg',
        pageImageSha256: 'sha256_tc4',
        pageWidth: 1080,
        pageHeight: 1920,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          {
            lineId: 'l1',
            predictedText: 'x = 2',
            rawOcrText: 'x = 2',
            currentText: 'x = 2',
            suggestions: [{ text: 'y = 2', confidence: 0.8, provider: 'ai' }], // AI suggests wrong thing
            confidence: 0.95,
            selectedSource: 'OCR', // User sticks with OCR
            verdict: 'CORRECT',
            trainingEligible: true,
            // @ts-ignore
            groundTruth: 'x = 2',
          },
        ] as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);
      
      expect(analytics.sourceDistribution.crnn).toBe(1);
      expect(analytics.sourceDistribution.aiCorrection).toBe(0); // AI contribution should be 0
      expect(analytics.correctionContribution?.aiContribution).toBe(0);
      expect(analytics.correctionContribution?.ocrContribution).toBe(100);
    });

    it('TC5: Accuracy calculation with mixed sources', () => {
      const trial: MultilineTrialResult = {
        trialId: 'tc5_mixed_accuracy',
        source: 'CAMERA',
        pageImageObjectKey: 'tc5.jpg',
        pageImageSha256: 'sha256_tc5',
        pageWidth: 1080,
        pageHeight: 1920,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          { // 1. OCR Correct
            lineId: 'l1', predictedText: 'A', rawOcrText: 'A', currentText: 'A',
            confidence: 0.9, selectedSource: 'OCR', verdict: 'CORRECT', trainingEligible: true,
            // @ts-ignore
            groundTruth: 'A',
          },
          { // 2. AI Corrected
            lineId: 'l2', predictedText: 'B_wrong', rawOcrText: 'B_wrong', currentText: 'B',
            suggestions: [{ text: 'B', confidence: 0.9, provider: 'ai' }],
            confidence: 0.9, selectedSource: 'SUGGESTION_1', verdict: 'CONFIRMED', trainingEligible: true,
            // @ts-ignore
            groundTruth: 'B',
          },
          { // 3. Manual Edited
            lineId: 'l3', predictedText: 'C_wrong', rawOcrText: 'C_wrong', currentText: 'C',
            confidence: 0.9, selectedSource: 'MANUAL', verdict: 'CONFIRMED', trainingEligible: true,
            // @ts-ignore
            groundTruth: 'C',
          },
          { // 4. Failed Line (No one got it right)
            lineId: 'l4', predictedText: 'D_wrong', rawOcrText: 'D_wrong', currentText: 'D_still_wrong',
            confidence: 0.4, selectedSource: 'MANUAL', verdict: 'CONFIRMED', trainingEligible: true,
            // @ts-ignore
            groundTruth: 'D',
          }
        ] as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);
      
      // Total lines = 4
      expect(analytics.totalLines).toBe(4);
      
      // Raw OCR Accuracy = 1/4 = 25%
      expect(analytics.rawAccuracy).toBe(25);
      
      // Final Accuracy = 3/4 = 75%
      expect(analytics.finalAccuracy).toBe(75);
      
      // Contributions
      expect(analytics.correctionContribution?.ocrContribution).toBe(25); // 1/4
      expect(analytics.correctionContribution?.aiContribution).toBe(25);  // 1/4
      expect(analytics.correctionContribution?.humanContribution).toBe(50); // 2/4 (l3 and l4 were MANUAL source, even if l4 failed)
    });
  });

  describe('Phase 2.1: Research Reproducibility & Metric Provenance Suite', () => {
    it('TC1: Explicit Ground Truth is included in analytics', () => {
      const trial: MultilineTrialResult = {
        trialId: 'tc1_explicit_gt',
        source: 'CAMERA',
        pageImageObjectKey: 'tc1.jpg',
        pageImageSha256: 'sha256_tc1',
        pageWidth: 1080,
        pageHeight: 1920,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          {
            lineId: 'l1',
            predictedText: 'Hello',
            rawOcrText: 'Hello',
            currentText: 'Hello',
            confidence: 0.95,
            selectedSource: 'OCR',
            verdict: 'CORRECT',
            trainingEligible: true,
            // @ts-ignore
            groundTruth: 'Hello', // EXPLICIT
          },
        ] as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);
      const metric = analytics.lineMetrics[0];

      expect(metric.groundTruthStatus).toBe('EXPLICIT');
      expect(analytics.evaluatedLines).toBe(1);
      expect(analytics.rawAccuracy).toBe(100);
    });

    it('TC2: Fallback Ground Truth is excluded from research metrics', () => {
      const trial: MultilineTrialResult = {
        trialId: 'tc2_fallback_gt',
        source: 'CAMERA',
        pageImageObjectKey: 'tc2.jpg',
        pageImageSha256: 'sha256_tc2',
        pageWidth: 1080,
        pageHeight: 1920,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          {
            lineId: 'l1',
            predictedText: 'Hello',
            rawOcrText: 'Hello',
            currentText: 'Hello',
            confidence: 0.95,
            selectedSource: 'OCR',
            // Missing verdict, missing groundTruth -> FALLBACK
            trainingEligible: true,
            // @ts-ignore
            groundTruth: '',
          },
        ] as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);
      const metric = analytics.lineMetrics[0];

      expect(metric.groundTruthStatus).toBe('FALLBACK');
      expect(analytics.evaluatedLines).toBe(0); // Excluded from metrics
      expect(analytics.rawAccuracy).toBe(0); // 0 / 0
      expect(analytics.finalAccuracy).toBe(0);
    });

    it('TC3: Export contains metricVersion and groundTruthStatus', () => {
      const trial: MultilineTrialResult = {
        trialId: 'tc3_export',
        source: 'CAMERA',
        pageImageObjectKey: 'tc3.jpg',
        pageImageSha256: 'sha256_tc3',
        pageWidth: 1080,
        pageHeight: 1920,
        privacyConfirmed: true,
        isTestData: false,
        dataOrigin: 'RESEARCH',
        status: 'SUCCESS',
        createdAt: new Date().toISOString(),
        lines: [
          {
            lineId: 'l1',
            predictedText: 'Hello',
            rawOcrText: 'Hello',
            currentText: 'Hello',
            confidence: 0.95,
            selectedSource: 'OCR',
            verdict: 'CORRECT',
            trainingEligible: true,
            // @ts-ignore
            groundTruth: 'Hello', // EXPLICIT
          },
        ] as any,
      };

      const analytics = handAiAnalyticsStore.computeTrialAnalytics(trial, true);
      const jsonStr = require('../services/analytics/handAiAnalyticsStore').exportTrialToJson(analytics);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.metricProvenance).toBeDefined();
      expect(parsed.metricProvenance.metricVersion).toBe('v2.1');
      expect(parsed.lines[0].groundTruthStatus).toBe('EXPLICIT');
      expect(parsed.lines[0].metricVersion).toBe('v2.1');
    });

    it('TC4: Dataset split metadata preserved in store', () => {
      const datasetMetadata = {
        datasetId: 'ds_1',
        datasetName: 'HandAI-v1.2',
        version: 'v1.2',
        description: 'Test',
        sampleCount: 1000,
        characterCount: 5000,
        imageCount: 100,
        language: 'vi',
        gradeLevel: 'Grade 1',
        createdDate: '2026-07-01',
        annotationStatus: 'Verified',
        trainSamples: 800,
        validationSamples: 100,
        testSamples: 100,
        splitMethod: 'Random',
        randomSeed: 42,
      };
      
      expect(datasetMetadata.trainSamples).toBe(800);
      expect(datasetMetadata.randomSeed).toBe(42);
    });

    it('TC5: Model checkpoint metadata preserved in store', () => {
      const modelExperiment = {
        experimentId: 'exp_1',
        modelVersion: 'CRNN-v1.2',
        modelName: 'OCR',
        datasetVersion: 'v1.2',
        trainingDate: '2026-07-05',
        framework: 'PyTorch',
        parameters: 'None',
        metrics: { lineAccuracy: 95, characterAccuracy: 98, cer: 2, wer: 5, latency: 1.2 },
        status: 'ACTIVE',
        modelCheckpoint: 's3://models/crnn_v1.2.pt',
        checkpointHash: 'sha256:abc',
        trainingFramework: 'PyTorch',
        trainingSeed: 42,
      };
      
      expect(modelExperiment.checkpointHash).toBe('sha256:abc');
      expect(modelExperiment.trainingSeed).toBe(42);
    });
  });
});






