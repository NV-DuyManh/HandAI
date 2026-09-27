import {
  buildVisibleSuggestions,
  resolveLineDisplayState,
} from '../suggestionDedupe';
import { MultilineLineResult } from '../../services/api/OcrPilotService';

describe('PROD.4B.2R3 Section 8 — High-Confidence Badge Global Semantics', () => {
  const baseLine: MultilineLineResult = {
    lineId: 'line-1',
    lineOrder: 1,
    predictedText: 'Bó hoa sim tímm',
    rawOcrText: 'Bó hoa sim tímm',
    rawOcrConfidence: 0.88,
    verdict: 'UNREVIEWED',
    trainingEligible: false,
  };

  test('A. Conflicting suggestions: both cannot be high-confidence (neither receives "Đề xuất tin cậy cao")', () => {
    const line: MultilineLineResult = {
      ...baseLine,
      groqSuggestion: 'Bó hoa sim tím',
      groqStatus: 'SUCCESS',
      groqConfidence: 0.96,
      geminiSuggestion: 'Có hoa sim tím',
      geminiStatus: 'SUCCESS',
      geminiConfidence: 0.98,
    };

    const suggestions = buildVisibleSuggestions(line);
    expect(suggestions.length).toBe(2);
    expect(suggestions[0].badge).toBe('Gợi ý AI');
    expect(suggestions[1].badge).toBe('Gợi ý AI');
    expect(suggestions[0].badge).not.toBe('Đề xuất tin cậy cao');
    expect(suggestions[1].badge).not.toBe('Đề xuất tin cậy cao');
  });

  test('B. Single-provider suggestion: defaults to "Gợi ý AI"', () => {
    const line: MultilineLineResult = {
      ...baseLine,
      groqSuggestion: 'Bó hoa sim tím',
      groqStatus: 'SUCCESS',
      groqConfidence: 0.97,
      geminiSuggestion: undefined,
      geminiStatus: 'NOT_TRIGGERED',
    };

    const suggestions = buildVisibleSuggestions(line);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].badge).toBe('Gợi ý AI');
    expect(suggestions[0].badge).not.toBe('Đề xuất tin cậy cao');
  });

  test('C. Independent exact consensus + strong orthographic evidence: "Đề xuất tin cậy cao" allowed', () => {
    const line: MultilineLineResult = {
      ...baseLine,
      groqSuggestion: 'Bó hoa sim tím',
      groqStatus: 'SUCCESS',
      groqConfidence: 0.95,
      geminiSuggestion: 'Bó hoa sim tím',
      geminiStatus: 'SUCCESS',
      geminiConfidence: 0.96,
    };

    const suggestions = buildVisibleSuggestions(line);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].badge).toBe('Đề xuất tin cậy cao');
  });

  test('D. Provider outage: no strong badge even if one provider returned a suggestion', () => {
    const line: MultilineLineResult = {
      ...baseLine,
      groqSuggestion: 'Bó hoa sim tím',
      groqStatus: 'SUCCESS',
      groqConfidence: 0.99,
      geminiSuggestion: undefined,
      geminiStatus: 'UNAVAILABLE',
    };

    const suggestions = buildVisibleSuggestions(line);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].badge).toBe('Gợi ý AI');
    expect(suggestions[0].badge).not.toBe('Đề xuất tin cậy cao');
  });

  test('E. User manual edit: advisor badge cannot imply manual text was AI-confirmed', () => {
    const line: MultilineLineResult = {
      ...baseLine,
      verdict: 'CORRECTED',
      verifiedTextRaw: 'Nụ hoa sim tím biếc',
      selectedSource: 'MANUAL_EDIT',
      groqSuggestion: 'Bó hoa sim tím',
      groqStatus: 'SUCCESS',
      geminiSuggestion: 'Bó hoa sim tím',
      geminiStatus: 'SUCCESS',
    };

    const state = resolveLineDisplayState(line);
    expect(state.selectedSource).toBe('MANUAL_EDIT');
    expect(state.currentText).toBe('Nụ hoa sim tím biếc');
    expect(state.isAiConfirmed).toBe(false);
  });

  test('Student UI safety: Suggestion labels and badges do NOT contain provider names', () => {
    const line: MultilineLineResult = {
      ...baseLine,
      groqSuggestion: 'Bó hoa sim tím',
      groqStatus: 'SUCCESS',
      geminiSuggestion: 'Có hoa sim tím',
      geminiStatus: 'SUCCESS',
    };

    const suggestions = buildVisibleSuggestions(line);
    for (const sugg of suggestions) {
      expect(sugg.label).not.toMatch(/groq|gemini|openai|claude/i);
      expect(sugg.buttonLabel).not.toMatch(/groq|gemini|openai|claude/i);
      if (sugg.badge) {
        expect(sugg.badge).not.toMatch(/groq|gemini|openai|claude/i);
      }
    }
  });
});
