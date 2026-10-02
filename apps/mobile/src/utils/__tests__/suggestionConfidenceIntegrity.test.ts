import {
  buildAdvisorView,
  buildVisibleSuggestions,
  getLineReviewStatus,
  resolveLineDisplayState,
} from '../suggestionDedupe';
import type { MultilineLineResult } from '../../services/api/OcrPilotService';

const base: Partial<MultilineLineResult> = {
  rawOcrText: 'Cm yêu mùa hè',
  predictedText: 'Cm yêu mùa hè',
  rawOcrConfidence: 0.97,
  rawOcrConfidenceSource: 'CRNN_CTC_SOFTMAX',
};

describe('Actual provider suggestion and confidence integrity', () => {
  test('rejects legacy local corrections even when they copied cloud model names and SUCCESS fields', () => {
    const line: Partial<MultilineLineResult> = {
      ...base, correctionDecision: 'LOCAL_ADVISOR_APPLY' as MultilineLineResult['correctionDecision'], correctionApplied: true,
      correctedText: 'Em yêu mùa hè',
      groqSuggestion: 'Em yêu mùa hè', groqStatus: 'SUCCESS', groqModel: 'qwen/qwen3.8-27b',
      geminiSuggestion: 'Em yêu mùa hè', geminiStatus: 'SUCCESS', geminiModel: 'gemini-3.6-flash',
      suggestions: [{ provider: 'GROQ', model: 'qwen/qwen3.8-27b', text: 'Em yêu mùa hè', status: 'SUCCESS' }],
    };
    expect(buildVisibleSuggestions(line)).toEqual([]);
    expect(buildAdvisorView(line, 'GROQ').status).toBe('UNAVAILABLE');
    expect(buildAdvisorView(line, 'GEMINI').text).toBe('');
    expect(resolveLineDisplayState(line).aiReviewed).toBe(false);
  });

  test('structured provider outage overrides contradictory legacy flat SUCCESS without hiding the other real provider', () => {
    const line: Partial<MultilineLineResult> = {
      ...base, groqSuggestion: 'Em yêu mùa hè', groqStatus: 'SUCCESS', groqModel: 'cloud-model',
      geminiSuggestion: 'Em yêu mùa hè', geminiStatus: 'SUCCESS', geminiModel: 'gemini-model',
      suggestions: [
        { provider: 'GROQ', model: 'cloud-model', text: '', status: 'UNAVAILABLE' },
        { provider: 'GEMINI', model: 'gemini-model', text: 'Em yêu mùa hè', status: 'SUCCESS' },
      ],
    };
    expect(buildAdvisorView(line, 'GROQ').status).toBe('UNAVAILABLE');
    expect(buildAdvisorView(line, 'GROQ').text).toBe('');
    expect(buildVisibleSuggestions(line)).toHaveLength(1);
    expect(buildVisibleSuggestions(line)[0].provider).toBe('GEMINI');
  });

  test.each(['Local-Advisor', ' local-advisor ', 'LOCAL_ADVISOR'])('excludes canned %s direct and array outputs', (model) => {
    const line: Partial<MultilineLineResult> = {
      ...base,
      groqSuggestion: 'Em yêu mùa hè', groqStatus: 'SUCCESS', groqModel: model,
      groqConfidence: 0.99, groqConfidenceSource: 'AI_SELF_REPORTED',
      geminiSuggestion: 'Em yêu mùa hè', geminiStatus: 'SUCCESS', geminiModel: model,
      geminiConfidence: 0.99, geminiConfidenceSource: 'AI_SELF_REPORTED',
      suggestions: [
        { provider: 'GROQ', model, text: 'Em yêu mùa hè', status: 'SUCCESS', confidence: 0.99, confidenceSource: 'AI_SELF_REPORTED' },
        { provider: 'GEMINI', model, text: 'Em yêu mùa hè', status: 'SUCCESS', confidence: 0.99, confidenceSource: 'AI_SELF_REPORTED' },
      ],
    };
    expect(buildVisibleSuggestions(line)).toEqual([]);
    expect(buildAdvisorView(line, 'GROQ').confidence).toBeUndefined();
    expect(buildAdvisorView(line, 'GROQ').text).toBe('');
    const state = resolveLineDisplayState(line);
    expect(state.currentText).toBe(base.rawOcrText);
    expect(state.selectedSource).toBe('OCR');
    expect(state.isAiConfirmed).toBe(false);
    expect(state.aiReviewed).toBe(false);
    expect(state.decisionEvidence?.providerConsensus).toBe(false);
    expect(state.rawAiConfidence).toBeUndefined();
    expect(state.aiConfidenceSource).toBe('NONE');
    expect(state.reviewStatus).toBe('PROVIDER_OUTAGE');
  });

  test('array-only canned matches cannot synthesize an AI confirmed card', () => {
    const line: Partial<MultilineLineResult> = {
      ...base,
      suggestions: [{ provider: 'GROQ', model: 'Local-Advisor', text: base.rawOcrText!, status: 'SUCCESS', confidence: 0.99 }],
    };
    expect(buildVisibleSuggestions(line)).toEqual([]);
    expect(getLineReviewStatus(line)).toBe('PROVIDER_OUTAGE');
  });

  test('a Local-Advisor array model cannot bypass filtering through direct fields lacking a model', () => {
    const line: Partial<MultilineLineResult> = {
      ...base, groqStatus: 'SUCCESS', groqSuggestion: 'Em yêu mùa hè',
      suggestions: [{ provider: 'GROQ', model: 'Local-Advisor', text: 'Em yêu mùa hè', status: 'SUCCESS' }],
    };
    expect(buildVisibleSuggestions(line)).toEqual([]);
  });

  test.each(['UNAVAILABLE', 'ERROR', 'DISABLED', 'NOT_TRIGGERED', 'SKIPPED', 'FALLBACK', 'CACHED_COPY'])('excludes %s stale text and tagged scores', (status) => {
    const line: Partial<MultilineLineResult> = {
      ...base, groqSuggestion: 'Em yêu mùa hè', groqStatus: status,
      groqConfidence: 0.99, groqConfidenceSource: 'AI_SELF_REPORTED',
      suggestions: [{ provider: 'GROQ', text: 'Em yêu mùa hè', status: 'SUCCESS', confidence: 0.99, confidenceSource: 'AI_SELF_REPORTED' }],
    };
    expect(buildVisibleSuggestions(line)).toEqual([]);
    expect(buildAdvisorView(line, 'GROQ').confidence).toBeUndefined();
    expect(getLineReviewStatus(line)).toBe('PROVIDER_OUTAGE');
  });

  test('keeps a real candidate without a score and strips untagged direct and array scores', () => {
    const line: Partial<MultilineLineResult> = {
      ...base, groqSuggestion: 'Em yêu mùa hè', groqStatus: 'SUCCESS', groqConfidence: 0.99,
      suggestions: [{ provider: 'GROQ', text: 'Em yêu mùa hè', status: 'SUCCESS', confidence: 0.98 }],
    };
    const suggestions = buildVisibleSuggestions(line);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].text).toBe('Em yêu mùa hè');
    expect(suggestions[0].confidence).toBeUndefined();
    expect(buildAdvisorView(line, 'GROQ').status).toBe('SUCCESS');
    expect(buildAdvisorView(line, 'GROQ').confidence).toBeUndefined();
    expect(resolveLineDisplayState(line).aiConfidenceSource).toBe('NONE');
  });

  test.each([null, undefined, NaN, Infinity, -0.1, 1.1])('preserves candidate text but hides invalid score %s', (confidence) => {
    const line: Partial<MultilineLineResult> = {
      ...base, geminiSuggestion: 'Em yêu mùa hè', geminiStatus: 'SUCCESS',
      geminiConfidence: confidence, geminiConfidenceSource: 'AI_SELF_REPORTED',
      suggestions: [{ provider: 'GEMINI', text: 'Em yêu mùa hè', status: 'SUCCESS', confidence, confidenceSource: 'AI_SELF_REPORTED' }],
    };
    expect(buildVisibleSuggestions(line)[0].text).toBe('Em yêu mùa hè');
    expect(buildVisibleSuggestions(line)[0].confidence).toBeUndefined();
    expect(buildAdvisorView(line, 'GEMINI').confidence).toBeUndefined();
  });

  test('keeps a measured zero in distinct and confirmed cards and OCR provenance', () => {
    const line: Partial<MultilineLineResult> = {
      ...base, rawOcrConfidence: 0,
      groqSuggestion: 'Em yêu mùa hè', groqStatus: 'SUCCESS',
      groqConfidence: 0, groqConfidenceSource: 'AI_SELF_REPORTED',
    };
    expect(buildVisibleSuggestions(line)[0].confidence).toBe(0);
    expect(buildAdvisorView(line, 'GROQ').confidence).toBe(0);
    expect(resolveLineDisplayState(line).rawOcrConfidence).toBe(0);
    expect(resolveLineDisplayState(line).rawAiConfidence).toBe(0);
    const confirmed = buildVisibleSuggestions({ ...line, groqSuggestion: base.rawOcrText });
    expect(confirmed[0].isAiConfirmed).toBe(true);
    expect(confirmed[0].confidence).toBe(0);
  });

  test('deduplication preserves a tagged zero from the same provider without giving it to another provider', () => {
    const line: Partial<MultilineLineResult> = {
      ...base, groqSuggestion: 'Em yêu mùa hè', groqStatus: 'SUCCESS',
      groqConfidence: 0, groqConfidenceSource: 'AI_SELF_REPORTED',
      suggestions: [{ provider: 'GROQ', text: 'Em yêu mùa hè', status: 'SUCCESS', confidence: 0.99 }],
    };
    expect(buildVisibleSuggestions(line)[0].confidence).toBe(0);
    const differentProvider = { ...line, groqConfidence: null, suggestions: [
      { provider: 'GROQ', text: 'Em yêu mùa hè', status: 'SUCCESS' },
      { provider: 'GEMINI', text: 'Em yêu mùa hè', status: 'SUCCESS', confidence: 0.98, confidenceSource: 'AI_SELF_REPORTED' },
    ] };
    expect(buildVisibleSuggestions(differentProvider)[0].provider).toBe('GROQ');
    expect(buildVisibleSuggestions(differentProvider)[0].confidence).toBeUndefined();
  });

  test('does not attach a tagged array source to a stale direct score', () => {
    const line: Partial<MultilineLineResult> = {
      ...base, groqSuggestion: 'Em yêu mùa hè', groqStatus: 'SUCCESS', groqConfidence: 0.99,
      suggestions: [{ provider: 'GROQ', text: 'Em yêu mùa hè', status: 'SUCCESS', confidence: 0.2, confidenceSource: 'AI_SELF_REPORTED' }],
    };
    expect(buildAdvisorView(line, 'GROQ').confidence).toBe(0.2);
    expect(buildVisibleSuggestions(line)[0].confidence).toBe(0.2);
  });

  test('confirmed cards preserve real text but never turn missing or untagged scores into numbers', () => {
    const line: Partial<MultilineLineResult> = {
      ...base, groqSuggestion: base.rawOcrText, groqStatus: 'SUCCESS', groqConfidence: 0.99,
    };
    const confirmed = buildVisibleSuggestions(line);
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].text).toBe(base.rawOcrText);
    expect(confirmed[0].isAiConfirmed).toBe(true);
    expect(confirmed[0].confidence).toBeUndefined();
  });

  test('unknown providers and uncalled legacy corrected text cannot masquerade as AI', () => {
    const line: Partial<MultilineLineResult> = {
      ...base, correctedText: 'Em yêu mùa hè', correctionApplied: true,
      suggestions: [{ provider: 'LOCAL', text: base.rawOcrText!, status: 'SUCCESS', confidence: 0.99, confidenceSource: 'AI_SELF_REPORTED' }],
    };
    expect(buildVisibleSuggestions(line)).toEqual([]);
    expect(getLineReviewStatus(line)).toBe('PROVIDER_OUTAGE');
    expect(resolveLineDisplayState(line).currentText).toBe(base.rawOcrText);
  });

  test('ignores null entries in older history without losing a real provider candidate', () => {
    const line: Partial<MultilineLineResult> = {
      ...base,
      suggestions: [null, { provider: 'GROQ', text: 'Em yêu mùa hè', status: 'SUCCESS' }] as unknown as MultilineLineResult['suggestions'],
    };
    expect(buildVisibleSuggestions(line)[0].text).toBe('Em yêu mùa hè');
    expect(buildVisibleSuggestions(line)[0].confidence).toBeUndefined();
    expect(getLineReviewStatus(line)).toBe('SUGGESTIONS_AVAILABLE');
  });
});
