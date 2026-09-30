/// <reference types="jest" />

import { buildHandAiDashboardMetrics } from '../services/analytics/handAiDashboardMetrics';
import { LineMetric, RecognitionSession } from '../services/analytics/handAiAnalyticsStore';

const makeLine = (overrides: Partial<LineMetric>): LineMetric =>
  ({
    lineIndex: 1,
    lineId: 'line-1',
    modelOutput: 'xin chao',
    ocrOutput: 'xin chao',
    aiSuggestion: 'xin chào',
    aiCandidate: 'xin chào',
    finalText: 'xin chào',
    finalResult: 'xin chào',
    groundTruth: 'xin chào',
    evaluationStatus: 'EVALUATED',
    cer: 0,
    characterAccuracy: 100,
    referenceWords: ['xin', 'chào'],
    predictedWords: ['xin', 'chao'],
    wer: 50,
    wordAccuracy: 50,
    source: 'AI_CORRECTION',
    sourceDecision: 'AI_CORRECTION',
    decisionSource: 'AI_CORRECTION',
    confidence: 80,
    isCorrect: true,
    correctionType: 'AI_CORRECTED',
    status: 'Corrected',
    ocrText: 'xin chao',
    text: 'xin chào',
    isRawCorrect: false,
    isFinalCorrect: true,
    groundTruthStatus: 'EXPLICIT',
    errorAnalysis: {
      errorType: 'VIETNAMESE_TONE_ERROR',
      severity: 'LOW',
      examples: ['xin chao → xin chào'],
      characterPairs: [{ wrongCharacter: 'a', correctCharacter: 'à', count: 1 }],
    },
    ...overrides,
  }) as LineMetric;

const makeSession = (overrides: Partial<RecognitionSession>): RecognitionSession =>
  ({
    sessionId: 'live-1',
    timestamp: 1,
    dateStr: 'Session 1',
    status: 'COMPLETED',
    isSampleData: false,
    totalLines: 2,
    confirmedLines: 2,
    rawCorrectLines: 1,
    correctLines: 2,
    rawAccuracy: 50,
    accuracy: 100,
    averageConfidence: 85,
    processingTimeSeconds: 2.4,
    modelVersion: 'CRNN-v1.2-PyTorch',
    datasetVersion: 'HandAI-v1.2',
    experimentId: 'live',
    crnnRawCount: 1,
    aiCorrectionCount: 1,
    manualEditCount: 0,
    lineMetrics: [
      makeLine({}),
      makeLine({
        lineIndex: 2,
        lineId: 'line-2',
        modelOutput: 'bé học bài',
        ocrOutput: 'bé học bài',
        aiSuggestion: '',
        aiCandidate: '',
        finalText: 'bé học bài',
        finalResult: 'bé học bài',
        groundTruth: 'bé học bài',
        source: 'CRNN',
        sourceDecision: 'CRNN_RAW',
        decisionSource: 'CRNN_RAW',
        confidence: 90,
        correctionType: 'OCR_CORRECT',
        status: 'Accepted',
        ocrText: 'bé học bài',
        text: 'bé học bài',
        isRawCorrect: true,
        isFinalCorrect: true,
        errorAnalysis: {
          errorType: 'NO_ERROR',
          severity: 'LOW',
          examples: [],
          characterPairs: [],
        },
      }),
    ],
    ...overrides,
  }) as RecognitionSession;

describe('buildHandAiDashboardMetrics', () => {
  it('excludes sample sessions and derives metrics from verified live lines', () => {
    const live = makeSession({});
    const sample = makeSession({ sessionId: 'sample-1', isSampleData: true });

    const metrics = buildHandAiDashboardMetrics([sample, live]);

    expect(metrics.totalSessions).toBe(1);
    expect(metrics.totalLines).toBe(2);
    expect(metrics.evaluatedLines).toBe(2);
    expect(metrics.rawAccuracy).toBe(50);
    expect(metrics.finalAccuracy).toBe(100);
    expect(metrics.aiGain).toBe(50);
    expect(metrics.aiAssistedLines).toBe(1);
    expect(metrics.averageConfidence).toBe(85);
    expect(metrics.averageLatencySeconds).toBe(2.4);
    expect(metrics.errorItems).toHaveLength(1);
    expect(metrics.errorItems[0].errorType).toBe('VIETNAMESE_TONE_ERROR');
  });

  it('does not invent percentages when no verified live lines exist', () => {
    const session = makeSession({
      lineMetrics: [
        makeLine({
          evaluationStatus: 'PENDING',
          groundTruth: '',
          groundTruthStatus: 'MISSING',
        }),
      ],
    });

    const metrics = buildHandAiDashboardMetrics([session]);

    expect(metrics.hasLiveSessions).toBe(true);
    expect(metrics.hasEvaluatedLines).toBe(false);
    expect(metrics.rawAccuracy).toBeNull();
    expect(metrics.finalAccuracy).toBeNull();
    expect(metrics.cer).toBeNull();
    expect(metrics.wer).toBeNull();
  });
});
