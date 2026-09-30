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
  value.trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');

const isMeasuredLine = (line: LineMetric): boolean =>
  line.evaluationStatus === 'EVALUATED' &&
  (line.groundTruthStatus === 'EXPLICIT' || line.groundTruthStatus === 'USER_CONFIRMED') &&
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

  const measuredLines = sessions.flatMap((session) =>
    (session.lineMetrics || []).filter(isMeasuredLine)
  );

  const totalLines = sessions.reduce((sum, session) => sum + session.totalLines, 0);
  const evaluatedLines = measuredLines.length;
  const rawCorrectLines = measuredLines.filter((line) => line.isRawCorrect).length;
  const finalCorrectLines = measuredLines.filter((line) => line.isFinalCorrect).length;
  const aiAssistedLines = measuredLines.filter(
    (line) => line.decisionSource === 'AI_CORRECTION' || line.sourceDecision === 'AI_CORRECTION'
  ).length;
  const manualEditedLines = measuredLines.filter(
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

  const confidenceValues = measuredLines
    .map((line) => line.confidence)
    .filter((value) => Number.isFinite(value));
  const averageConfidence = confidenceValues.length > 0
    ? round1(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
    : null;

  const latencyValues = sessions
    .map((session) => session.processingTimeSeconds)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
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
    totalLines,
    evaluatedLines,
    rawCorrectLines,
    finalCorrectLines,
    aiAssistedLines,
    manualEditedLines,
    rawAccuracy,
    finalAccuracy,
    aiGain:
      rawAccuracy !== null && finalAccuracy !== null
        ? round1(finalAccuracy - rawAccuracy)
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
