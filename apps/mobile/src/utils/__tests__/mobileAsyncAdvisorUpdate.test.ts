import {
  isAdvisorPending,
  mergeTrialWithAdvisorUpdate,
} from '../mobileAsyncAdvisor';
import { MultilineTrialResult, MultilineLineResult } from '../../services/api/OcrPilotService';

describe('PROD.4B.2R3 Section 7 — Mobile Background Async Update Mechanism', () => {
  const initialTrial: MultilineTrialResult = {
    trialId: 'trial-123',
    status: 'COMPLETED',
    source: 'CAMERA',
    pageImageObjectKey: 'pages/trial-123.jpg',
    pageImageSha256: 'a'.repeat(64),
    pageWidth: 800,
    pageHeight: 600,
    privacyConfirmed: true,
    isTestData: false,
    dataOrigin: 'TEST',
    createdAt: '2026-09-20T12:00:00Z',
    lines: [
      {
        lineId: 'line-1',
        lineOrder: 1,
        predictedText: 'Bó hoa sim tímm',
        rawOcrText: 'Bó hoa sim tímm',
        rawOcrConfidence: 0.88,
        verdict: 'UNREVIEWED',
        trainingEligible: false,
        // Advisors pending on fast-path response:
        groqStatus: undefined,
        geminiStatus: undefined,
        suggestions: [],
      },
      {
        lineId: 'line-2',
        lineOrder: 2,
        predictedText: 'Rừng chiều ngút ngàn',
        rawOcrText: 'Rừng chiều ngút ngàn',
        rawOcrConfidence: 0.95,
        verdict: 'UNREVIEWED',
        trainingEligible: false,
        groqStatus: undefined,
        geminiStatus: undefined,
        suggestions: [],
      },
      {
        lineId: 'line-3',
        lineOrder: 3,
        predictedText: 'Đồi sim tím biếc',
        rawOcrText: 'Đồi sim tím biếc',
        rawOcrConfidence: 0.92,
        verdict: 'UNREVIEWED',
        trainingEligible: false,
        groqStatus: undefined,
        geminiStatus: undefined,
        suggestions: [],
      },
    ],
  };

  test('1 & 2. Initial state reflects fast-path local OCR and detects advisors as PENDING', () => {
    expect(isAdvisorPending(initialTrial)).toBe(true);
    expect(initialTrial.lines[0].rawOcrText).toBe('Bó hoa sim tímm');
  });

  test('3, 4 & 5. Delayed advisor completion (e.g. 2500ms): mounted screen receives updates automatically without reload', async () => {
    // Simulate background advisor processing taking 2500ms
    const simulateDelayedAdvisorResponse = async (delayMs: number): Promise<MultilineTrialResult> => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return {
        ...initialTrial,
        correctionSource: 'GROQ_POST_CORRECTION',
        lines: [
          {
            ...initialTrial.lines[0],
            groqSuggestion: 'Bó hoa sim tím',
            groqStatus: 'SUCCESS',
            groqConfidence: 0.96,
            geminiSuggestion: 'Có hoa sim tím',
            geminiStatus: 'SUCCESS',
            geminiConfidence: 0.98,
          },
          {
            ...initialTrial.lines[1],
            groqStatus: 'SUCCESS',
            geminiStatus: 'SUCCESS',
            groqSuggestion: 'Rừng chiều ngút ngàn',
            geminiSuggestion: 'Rừng chiều ngút ngàn',
          },
          {
            ...initialTrial.lines[2],
            groqStatus: 'SUCCESS',
            geminiStatus: 'SUCCESS',
            groqSuggestion: 'Đồi sim tím biếc',
            geminiSuggestion: 'Đồi sim tím biếc',
          },
        ],
      };
    };

    // Test with small synthetic delay representing 2500ms background execution
    const completedTrial = await simulateDelayedAdvisorResponse(50);
    expect(isAdvisorPending(completedTrial)).toBe(false);

    // Merged state without reload
    const merged = mergeTrialWithAdvisorUpdate(initialTrial, completedTrial);
    expect(merged.lines[0].groqSuggestion).toBe('Bó hoa sim tím');
    expect(merged.lines[0].geminiSuggestion).toBe('Có hoa sim tím');
    expect(isAdvisorPending(merged)).toBe(false);
  });

  test('6. Late AI advisor response MUST NOT overwrite user selection or manual edit made before return', () => {
    // Suppose while advisors were in-flight:
    // - Line 1: User explicitly chose OCR ("Giữ OCR gốc", verdict: CORRECT)
    // - Line 2: User manually edited text ("Rừng chiều ngát hương", verdict: CORRECTED, selectedSource: MANUAL_EDIT)
    // - Line 3: Untouched (UNREVIEWED)
    const userModifiedTrial: MultilineTrialResult = {
      ...initialTrial,
      lines: [
        {
          ...initialTrial.lines[0],
          verdict: 'CORRECT',
          verifiedTextRaw: 'Bó hoa sim tímm',
          finalText: 'Bó hoa sim tímm',
          predictedText: 'Bó hoa sim tímm',
          selectedSource: 'OCR',
        },
        {
          ...initialTrial.lines[1],
          verdict: 'CORRECTED',
          verifiedTextRaw: 'Rừng chiều ngát hương',
          finalText: 'Rừng chiều ngát hương',
          predictedText: 'Rừng chiều ngát hương',
          currentText: 'Rừng chiều ngát hương',
          selectedSource: 'MANUAL_EDIT',
        },
        {
          ...initialTrial.lines[2],
        },
      ],
    };

    // Background advisors return late with different suggestions and auto-corrections:
    const incomingAdvisorTrial: MultilineTrialResult = {
      ...initialTrial,
      lines: [
        {
          ...initialTrial.lines[0],
          groqSuggestion: 'Bó hoa sim tím',
          geminiSuggestion: 'Có hoa sim tím',
          groqStatus: 'SUCCESS',
          geminiStatus: 'SUCCESS',
          predictedText: 'Bó hoa sim tím', // Advisor wants to suggest/apply this
          finalText: 'Bó hoa sim tím',
        },
        {
          ...initialTrial.lines[1],
          groqSuggestion: 'Rừng chiều bạt ngàn',
          geminiSuggestion: 'Rừng chiều bạt ngàn',
          groqStatus: 'SUCCESS',
          geminiStatus: 'SUCCESS',
          predictedText: 'Rừng chiều bạt ngàn', // Advisor suggestion
          finalText: 'Rừng chiều bạt ngàn',
        },
        {
          ...initialTrial.lines[2],
          groqSuggestion: 'Đồi sim tím ngát',
          geminiSuggestion: 'Đồi sim tím ngát',
          groqStatus: 'SUCCESS',
          geminiStatus: 'SUCCESS',
          predictedText: 'Đồi sim tím ngát',
          finalText: 'Đồi sim tím ngát',
        },
      ],
    };

    const merged = mergeTrialWithAdvisorUpdate(userModifiedTrial, incomingAdvisorTrial);

    // Verify Line 1: User's explicit CORRECT verdict and raw text are preserved!
    expect(merged.lines[0].verdict).toBe('CORRECT');
    expect(merged.lines[0].verifiedTextRaw).toBe('Bó hoa sim tímm');
    expect(merged.lines[0].finalText).toBe('Bó hoa sim tímm');
    // But advisor suggestions are attached for viewing:
    expect(merged.lines[0].groqSuggestion).toBe('Bó hoa sim tím');
    expect(merged.lines[0].geminiSuggestion).toBe('Có hoa sim tím');

    // Verify Line 2: User's manual edit is 100% PRESERVED, late advisor cannot overwrite it!
    expect(merged.lines[1].verdict).toBe('CORRECTED');
    expect(merged.lines[1].verifiedTextRaw).toBe('Rừng chiều ngát hương');
    expect(merged.lines[1].finalText).toBe('Rừng chiều ngát hương');
    expect(merged.lines[1].currentText).toBe('Rừng chiều ngát hương');
    expect(merged.lines[1].selectedSource).toBe('MANUAL_EDIT');
    // Advisor suggestions attached without overriding text:
    expect(merged.lines[1].groqSuggestion).toBe('Rừng chiều bạt ngàn');

    // Verify Line 3: Untouched line received the advisor update!
    expect(merged.lines[2].verdict).toBe('UNREVIEWED');
    expect(merged.lines[2].groqSuggestion).toBe('Đồi sim tím ngát');
    expect(merged.lines[2].finalText).toBe('Đồi sim tím ngát');
  });

  test('Active editing line guard: do not disturb line being typed in activeEditingLineId', () => {
    const trialDuringEdit: MultilineTrialResult = {
      ...initialTrial,
    };
    const incomingAdvisorTrial: MultilineTrialResult = {
      ...initialTrial,
      lines: [
        {
          ...initialTrial.lines[0],
          groqSuggestion: 'Bó hoa sim tím',
          finalText: 'Bó hoa sim tím',
          predictedText: 'Bó hoa sim tím',
          groqStatus: 'SUCCESS',
        },
      ],
    };

    // Active editing line is line-1
    const merged = mergeTrialWithAdvisorUpdate(trialDuringEdit, incomingAdvisorTrial, 'line-1');
    expect(merged.lines[0].finalText).toBe(trialDuringEdit.lines[0].finalText);
  });
});
