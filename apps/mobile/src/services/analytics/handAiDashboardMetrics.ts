import {
  computeLevenshteinDistance,
  computeWordLevenshteinDistance,
  tokenizeWords,
  type ErrorType,
  type LineMetric,
  type RecognitionSession,
} from './handAiAnalyticsStore';

export interface DashboardErrorItem {
  id: string;
  errorType: ErrorType;
  originalText: string;
  suggestedText: string;
  characterSnippet?: string;
}

export interface HandAiDashboardMetrics {
  sessions: RecognitionSession[];
  hasLiveSessions: boolean;
  hasEvaluatedLines: boolean;
  totalSessions: number;
  totalImages: number;
  comparedSessions: number;
  comparedImages: number;
  comparisonLines: number;
  aiResponseLines: number;
  rawComparisonCorrectLines: number;
  aiCorrectLines: number;
  rawComparisonAccuracy: number | null;
  aiAccuracy: number | null;
  confidenceLineCount: number;
  totalLines: number;
  evaluatedLines: number;
  rawCorrectLines: number;
  finalCorrectLines: number;
  aiAssistedLines: number;
  manualEditedLines: number;
  rawAccuracy: number | null;
  finalAccuracy: number | null;
  aiGain: number | null;
  cer: number | null;
  characterAccuracy: number | null;
  wer: number | null;
  wordAccuracy: number | null;
  averageConfidence: number | null;
  averageLatencySeconds: number | null;
  errorItems: DashboardErrorItem[];
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

const normalizeMetricText = (value: string): string =>
  value.normalize('NFC').trim().replace(/\s+/g, ' ');

const isMeasuredLine = (line: LineMetric): boolean =>
  line.evaluationStatus === 'EVALUATED' &&
  (line.groundTruthStatus === 'EXPLICIT' || line.referenceSource === 'EXPLICIT_REFERENCE') &&
  normalizeMetricText(line.groundTruth).length > 0;

const getRawText = (line: LineMetric): string =>
  line.ocrOutput || line.modelOutput || line.ocrText || '';

const getFinalText = (line: LineMetric): string =>
  line.finalResult || line.finalText || line.text || '';

const getSuggestedText = (line: LineMetric): string =>
  line.aiCandidate || line.aiSuggestion || getFinalText(line);

export function buildHandAiDashboardMetrics(
  allSessions: RecognitionSession[]
): HandAiDashboardMetrics {
  const sessions = allSessions.filter(
    (session) =>
      session.status === 'COMPLETED' &&
      session.isSampleData !== true &&
      session.totalLines > 0
  );

  const processedLines = sessions.flatMap((session) =>
    (session.lineMetrics || []).filter((line) => line.status !== 'Detection Failed')
  );
  const measuredLines = processedLines.filter(isMeasuredLine);
  const pairedLines = measuredLines.filter((line) => line.aiReviewRecorded === true && !!line.afterAiText?.trim());
  const aiResponseLines = processedLines.filter((line) => line.aiReviewRecorded === true && !!line.afterAiText?.trim()).length;
  const imageKey = (session: RecognitionSession): string | undefined =>
    (session as RecognitionSession & { imageSha256?: string }).imageSha256 || session.imageUri || session.imageThumbnailUri;
  const countImages = (items: RecognitionSession[]): number => new Set(items.map(imageKey).filter(Boolean)).size;
  const pairedSessions = sessions.filter((session) => (session.lineMetrics || []).some((line) => pairedLines.includes(line)));

  const totalLines = sessions.reduce((sum, session) => sum + session.totalLines, 0);
  const evaluatedLines = measuredLines.length;
  const rawCorrectLines = measuredLines.filter((line) => normalizeMetricText(getRawText(line)) === normalizeMetricText(line.groundTruth)).length;
  const finalCorrectLines = measuredLines.filter((line) => normalizeMetricText(getFinalText(line)) === normalizeMetricText(line.groundTruth)).length;
  const rawComparisonCorrectLines = pairedLines.filter((line) => normalizeMetricText(getRawText(line)) === normalizeMetricText(line.groundTruth)).length;
  const aiCorrectLines = pairedLines.filter((line) => normalizeMetricText(line.afterAiText!) === normalizeMetricText(line.groundTruth)).length;
  const rawComparisonAccuracy = pairedLines.length ? round1(rawComparisonCorrectLines / pairedLines.length * 100) : null;
  const aiAccuracy = pairedLines.length ? round1(aiCorrectLines / pairedLines.length * 100) : null;
  const aiAssistedLines = processedLines.filter(
    (line) => line.decisionSource === 'AI_CORRECTION' || line.sourceDecision === 'AI_CORRECTION'
  ).length;
  const manualEditedLines = processedLines.filter(
    (line) => line.decisionSource === 'MANUAL_EDIT' || line.sourceDecision === 'MANUAL_EDIT'
  ).length;

  let rawCharacterEdits = 0;
  let referenceCharacters = 0;
  let rawWordEdits = 0;
  let referenceWords = 0;

  measuredLines.forEach((line) => {
    const raw = normalizeMetricText(getRawText(line));
    const reference = normalizeMetricText(line.groundTruth);
    const rawWords = tokenizeWords(raw);
    const refWords = tokenizeWords(reference);

    rawCharacterEdits += computeLevenshteinDistance(raw, reference);
    referenceCharacters += reference.length;
    rawWordEdits += computeWordLevenshteinDistance(rawWords, refWords);
    referenceWords += refWords.length;
  });

  const rawAccuracy = evaluatedLines > 0
    ? round1((rawCorrectLines / evaluatedLines) * 100)
    : null;
  const finalAccuracy = evaluatedLines > 0
    ? round1((finalCorrectLines / evaluatedLines) * 100)
    : null;
  const cer = referenceCharacters > 0
    ? round1((rawCharacterEdits / referenceCharacters) * 100)
    : null;
  const wer = referenceWords > 0
    ? round1((rawWordEdits / referenceWords) * 100)
    : null;

  const confidenceValues = processedLines
    .filter((line) => line.confidenceSource === 'CRNN_CTC_SOFTMAX')
    .map((line) => line.confidence)
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
  const averageConfidence = confidenceValues.length > 0
    ? round1(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
    : null;

  const latencyValues = sessions
    .map((session) => session.processingTimeSeconds)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  const averageLatencySeconds = latencyValues.length > 0
    ? round1(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
    : null;

  const errorItems = measuredLines
    .filter((line) => line.errorAnalysis && line.errorAnalysis.errorType !== 'NO_ERROR')
    .slice(0, 12)
    .map((line, index) => {
      const pair = line.errorAnalysis?.characterPairs?.[0];
      return {
        id: `${line.lineId}-${index}`,
        errorType: line.errorAnalysis!.errorType,
        originalText: getRawText(line),
        suggestedText: getSuggestedText(line),
        characterSnippet: pair ? `${pair.wrongCharacter} → ${pair.correctCharacter}` : undefined,
      };
    });

  return {
    sessions,
    hasLiveSessions: sessions.length > 0,
    hasEvaluatedLines: evaluatedLines > 0,
    totalSessions: sessions.length,
    totalImages: countImages(sessions),
    comparedSessions: pairedSessions.length,
    comparedImages: countImages(pairedSessions),
    comparisonLines: pairedLines.length,
    aiResponseLines,
    rawComparisonCorrectLines,
    aiCorrectLines,
    rawComparisonAccuracy,
    aiAccuracy,
    confidenceLineCount: confidenceValues.length,
    totalLines,
    evaluatedLines,
    rawCorrectLines,
    finalCorrectLines,
    aiAssistedLines,
    manualEditedLines,
    rawAccuracy,
    finalAccuracy,
    aiGain:
      rawComparisonAccuracy !== null && aiAccuracy !== null
        ? round1(aiAccuracy - rawComparisonAccuracy)
        : null,
    cer,
    characterAccuracy: cer === null ? null : round1(Math.max(0, 100 - cer)),
    wer,
    wordAccuracy: wer === null ? null : round1(Math.max(0, 100 - wer)),
    averageConfidence,
    averageLatencySeconds,
    errorItems,
  };
}
