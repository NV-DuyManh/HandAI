import {
  resolveLineDisplayState,
  buildVisibleSuggestions,
  isVietnameseSyllableValid,
} from '../suggestionDedupe';

describe('PROD.4B.2R3 Section 3 — Current Owner Physical OCR Line-2 Regression', () => {
  const lineInput = {
    lineId: 'line-owner-2',
    lineOrder: 2,
    predictedText: 'Bó hoa sim tímm',
    rawOcrText: 'Bó hoa sim tímm',
    rawOcrConfidence: 0.88,
    groqSuggestion: 'Bó hoa sim tím',
    groqConfidence: 0.96,
    groqStatus: 'SUCCESS',
    groqModel: 'qwen/qwen3.8-27b',
    geminiSuggestion: 'Có hoa sim tím',
    geminiConfidence: 0.98,
    geminiStatus: 'SUCCESS',
    geminiModel: 'gemini-3.6-flash',
    suggestions: [
      {
        provider: 'GROQ',
        text: 'Bó hoa sim tím',
        confidence: 0.96,
        status: 'SUCCESS',
        model: 'qwen/qwen3.8-27b',
      },
      {
        provider: 'GEMINI',
        text: 'Có hoa sim tím',
        confidence: 0.98,
        status: 'SUCCESS',
        model: 'gemini-3.6-flash',
      },
    ],
    verdict: 'UNREVIEWED',
    trainingEligible: false,
  };

  test('Phonotactic validation flags duplicate terminal consonant "tímm" as invalid', () => {
    expect(isVietnameseSyllableValid('tímm')).toBe(false);
    expect(isVietnameseSyllableValid('tím')).toBe(true);
    expect(isVietnameseSyllableValid('Bó')).toBe(true);
    expect(isVietnameseSyllableValid('Có')).toBe(true);
  });

  test('Automatic arbitration deterministically selects S1 (fixes "tímm" -> "tím", preserves valid "Bó")', () => {
    const res = resolveLineDisplayState(lineInput);

    // S1 fixes the phonotactically illegal syllable "tímm" -> "tím" while preserving valid word "Bó"
    // S2 attempts an unverified rewrite of valid word "Bó" -> "Có" without consensus
    expect(res.currentText).toBe('Bó hoa sim tím');
    expect(res.selectedSource).toBe('SUGGESTION_1');
    expect(res.decisionReason).toBe('GARBLED_OCR_DETERMINISTIC_CORRECTION');

    // Exactly 2 suggestions displayed to student
    expect(res.aiSuggestions.length).toBe(2);
    expect(res.aiSuggestions[0].text).toBe('Bó hoa sim tím');
    expect(res.aiSuggestions[1].text).toBe('Có hoa sim tím');

    // No third synthetic string
    const allowed = new Set(['Bó hoa sim tímm', 'Bó hoa sim tím', 'Có hoa sim tím']);
    expect(allowed.has(res.currentText)).toBe(true);
  });

  test('B/C rewrite is NOT accepted merely from Gemini higher self-confidence (0.98 > 0.96)', () => {
    // Even if Gemini reports 0.98 vs Groq 0.96, cross-provider score is not independent consensus
    const res = resolveLineDisplayState(lineInput);
    expect(res.currentText).not.toBe('Có hoa sim tím');
  });

  test('Explicit user selection of Suggestion 2 ("Có hoa sim tím") wins', () => {
    const userSelectedS2 = {
      ...lineInput,
      selectedSource: 'SUGGESTION_2',
      finalText: 'Có hoa sim tím',
    };
    const res = resolveLineDisplayState(userSelectedS2);
    expect(res.currentText).toBe('Có hoa sim tím');
    expect(res.selectedSource).toBe('SUGGESTION_2');
    expect(res.selectionReason).toBe('USER_EXPLICIT_SELECTION');
  });

  test('Explicit user selection of OCR ("Giữ OCR gốc") wins', () => {
    const userKeptOcr = {
      ...lineInput,
      verdict: 'CORRECT',
    };
    const res = resolveLineDisplayState(userKeptOcr);
    expect(res.currentText).toBe('Bó hoa sim tímm');
    expect(res.selectedSource).toBe('OCR');
  });

  test('Manual edit wins over all AI suggestions', () => {
    const manualEdited = {
      ...lineInput,
      selectedSource: 'MANUAL_EDIT',
      verifiedTextRaw: 'Hoa sim tím trên đồi',
      verdict: 'CORRECTED',
    };
    const res = resolveLineDisplayState(manualEdited);
    expect(res.currentText).toBe('Hoa sim tím trên đồi');
    expect(res.selectedSource).toBe('MANUAL_EDIT');
    expect(res.decisionReason).toBe('MANUAL_EDIT_OVERRIDE');
  });
});
