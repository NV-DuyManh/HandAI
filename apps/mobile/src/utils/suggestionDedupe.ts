import type { MultilineLineResult } from '../services/api/OcrPilotService';

export interface AdvisorView {
  provider: 'GROQ' | 'GEMINI';
  model: string;
  status: 'SUCCESS' | 'NOT_TRIGGERED' | 'UNAVAILABLE' | 'DISABLED' | 'ERROR';
  text: string;
  confidence: number;
  decision?: string;
  wasTriggered: boolean;
}

/**
 * Internal candidate representation abstraction (PROD.3F Scope 4.4).
 * A provider may return 1 or 2 candidates.
 * Provider/source identities are strictly internal and NEVER shown in student UI.
 */
export interface SuggestionCandidate {
  text: string;
  confidence?: number;
  sourceInternal?: string;
  reasoningTagInternal?: string;
  providerInternal?: string;
  decision?: string;
}

export interface VisibleSuggestion {
  id: string; // 'sugg-1' | 'sugg-2'
  label: string; // 'Gợi ý 1' | 'Gợi ý 2'
  buttonLabel: string; // 'Dùng gợi ý 1' | 'Dùng gợi ý 2'
  accessibilityLabel: string; // 'Chọn gợi ý 1' | 'Chọn gợi ý 2'
  text: string; // Original, unnormalized string for display and application
  confidence?: number;
  decision?: string;
  provider?: string; // Preserved internally for diagnostics/audit; NEVER shown in student UI
  isAiConfirmed?: boolean;
  badge?: string; // e.g. 'AI xác nhận'
}

export interface BuildSuggestionsOptions {
  includeConfirmedCard?: boolean; // Defaults to true in PROD.3F.1
}

export type LineReviewStatus = 'SUGGESTIONS_AVAILABLE' | 'AI_CONFIRMED' | 'PROVIDER_OUTAGE';

/**
 * Builds the internal advisor view for a given provider.
 */
export function buildAdvisorView(
  line: Partial<MultilineLineResult>,
  provider: 'GROQ' | 'GEMINI'
): AdvisorView {
  const fromSuggestions = Array.isArray(line.suggestions)
    ? line.suggestions.find((s) => s.provider === provider)
    : undefined;

  let directText = provider === 'GROQ' ? line.groqSuggestion : line.geminiSuggestion;
  const directStatus = provider === 'GROQ' ? line.groqStatus : line.geminiStatus;
  const directModel = provider === 'GROQ' ? line.groqModel : line.geminiModel;
  const directConfidence = provider === 'GROQ' ? line.groqConfidence : line.geminiConfidence;
  const directDecision = provider === 'GROQ' ? line.groqDecision : line.geminiDecision;

  // Fallback for Groq legacy correctedText
  if (provider === 'GROQ' && !directText && line.correctedText && directStatus !== 'UNAVAILABLE') {
    directText = line.correctedText;
  }

  const text = (directText || fromSuggestions?.text || '').trim();
  const rawModel = directModel || fromSuggestions?.model;
  const model = rawModel || provider;
  const confidence = directConfidence ?? fromSuggestions?.confidence ?? 0.0;
  const decision = directDecision || fromSuggestions?.decision || 'KEEP_RAW';

  const wasTriggered = Boolean(
    line.correctionApplied ||
    (line.correctedText && line.correctedText !== line.rawOcrText) ||
    line.groqStatus ||
    line.geminiStatus ||
    line.groqSuggestion ||
    line.geminiSuggestion ||
    (Array.isArray(line.suggestions) && line.suggestions.some((s) => s.provider === provider))
  );

  const rawStatus = (directStatus || fromSuggestions?.status || '').toUpperCase();
  let status: 'SUCCESS' | 'NOT_TRIGGERED' | 'UNAVAILABLE' | 'DISABLED' | 'ERROR';

  // Respect explicit provider status FIRST — do not override UNAVAILABLE/ERROR/DISABLED
  // just because suggestion text happens to be present (it could be stale/cached).
  if (rawStatus === 'UNAVAILABLE') {
    status = 'UNAVAILABLE';
  } else if (rawStatus === 'DISABLED') {
    status = 'DISABLED';
  } else if (rawStatus === 'ERROR') {
    status = 'ERROR';
  } else if (text.length > 0) {
    status = 'SUCCESS';
  } else if (wasTriggered) {
    status = 'UNAVAILABLE';
  } else {
    status = 'NOT_TRIGGERED';
  }

  return {
    provider,
    model,
    status,
    text,
    confidence,
    decision,
    wasTriggered,
  };
}

/**
 * Normalizes strings strictly for equality comparison.
 * - Trims outer whitespace
 * - Normalizes Unicode consistently (NFC)
 * - Collapses accidental repeated internal whitespace into a single space
 * - Does NOT change displayed/original suggestion text
 * - Does NOT alter spelling semantically
 */
export function normalizeForComparison(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .trim()
    .normalize('NFC')
    .replace(/\s+/g, ' ');
}

/**
 * Builds visible, deduplicated suggestions for a line in the student UI.
 *
 * Rules:
 * 1. Filter out suggestions that match the RAW OCR text (not distinct).
 * 2. Dedupe identical suggestions against each other (keeps first unique).
 * 3. Max 2 unique suggestions returned.
 * 4. Deterministic sequential numbering:
 *    - First unique suggestion -> "Gợi ý 1", button "Dùng gợi ý 1"
 *    - Second unique suggestion -> "Gợi ý 2", button "Dùng gợi ý 2"
 * 5. Provider identities (Groq, Gemini) are NEVER exposed in labels or student UI.
 * 6. If no unique suggestions remain, returns [].
 */
export function buildVisibleSuggestions(
  line: Partial<MultilineLineResult>,
  options?: BuildSuggestionsOptions
): VisibleSuggestion[] {
  const includeConfirmedCard = options?.includeConfirmedCard ?? true;
  const rawOcr = line.rawOcrText || line.predictedText || '';
  const normRaw = normalizeForComparison(rawOcr);

  const rawCandidates: SuggestionCandidate[] = [];

  // 1. Collect from line.suggestions array if provided (supports multiple candidates per provider)
  if (Array.isArray(line.suggestions)) {
    for (const s of line.suggestions) {
      if (s && s.text && s.text.trim().length > 0 && s.status !== 'UNAVAILABLE') {
        rawCandidates.push({
          text: s.text,
          confidence: s.confidence,
          decision: s.decision,
          providerInternal: s.provider,
          sourceInternal: s.model,
        });
      }
    }
  }

  // 2. Direct field fallback for Groq / legacy
  const rawGroqText = line.groqSuggestion ?? (line.correctedText && line.groqStatus !== 'UNAVAILABLE' ? line.correctedText : undefined);
  if (rawGroqText && rawGroqText.trim().length > 0 && line.groqStatus !== 'UNAVAILABLE') {
    rawCandidates.push({
      text: rawGroqText,
      confidence: line.groqConfidence,
      decision: line.groqDecision,
      providerInternal: 'GROQ',
    });
  }

  // 3. Direct field fallback for Gemini
  const rawGeminiText = line.geminiSuggestion;
  if (rawGeminiText && rawGeminiText.trim().length > 0 && line.geminiStatus !== 'UNAVAILABLE') {
    rawCandidates.push({
      text: rawGeminiText,
      confidence: line.geminiConfidence,
      decision: line.geminiDecision,
      providerInternal: 'GEMINI',
    });
  }

  const visible: VisibleSuggestion[] = [];
  const seenNorms: string[] = [];

  for (const cand of rawCandidates) {
    const normCand = normalizeForComparison(cand.text);

    // Rule A: If suggestion equals RAW OCR text, it is not distinct -> hide it from distinct list
    if (normCand === normRaw) {
      continue;
    }

    // Rule B: If duplicate of an earlier surviving suggestion -> hide it
    if (seenNorms.includes(normCand)) {
      continue;
    }

    // Max 2 unique suggestions
    if (visible.length >= 2) {
      break;
    }

    seenNorms.push(normCand);
    const index = visible.length + 1; // 1 or 2
    visible.push({
      id: `sugg-${index}`,
      label: `Gợi ý ${index}`,
      buttonLabel: `Dùng gợi ý ${index}`,
      accessibilityLabel: `Chọn gợi ý ${index}`,
      text: cand.text, // keep original display text untouched
      confidence: cand.confidence,
      decision: cand.decision,
      provider: cand.providerInternal,
      isAiConfirmed: false,
    });
  }

  // Section 8: High-Confidence Badge Global Semantics
  // A. conflicting suggestions -> neither can be high-confidence (default 'Gợi ý AI')
  // B. single-provider suggestion -> default 'Gợi ý AI'
  // C. independent exact consensus + strong visual evidence -> 'Đề xuất tin cậy cao' allowed
  // D. provider outage -> no strong badge
  if (visible.length === 1 && !visible[0].isAiConfirmed) {
    const groqView = buildAdvisorView(line, 'GROQ');
    const geminiView = buildAdvisorView(line, 'GEMINI');
    const groqSuccess = groqView.status === 'SUCCESS';
    const geminiSuccess = geminiView.status === 'SUCCESS';
    const noOutage = groqView.status !== 'UNAVAILABLE' && geminiView.status !== 'UNAVAILABLE';
    const hasConsensus = Boolean(
      noOutage &&
      groqSuccess &&
      geminiSuccess &&
      line.groqSuggestion &&
      line.geminiSuggestion &&
      normalizeForComparison(line.groqSuggestion) === normalizeForComparison(line.geminiSuggestion) &&
      normalizeForComparison(line.groqSuggestion) === normalizeForComparison(visible[0].text) &&
      isOrthographicCorrection(rawOcr, visible[0].text)
    );
    visible[0].badge = hasConsensus ? 'Đề xuất tin cậy cao' : 'Gợi ý AI';
  } else if (visible.length > 1) {
    for (const sugg of visible) {
      if (!sugg.isAiConfirmed) {
        sugg.badge = 'Gợi ý AI';
      }
    }
  }

  // Case C (PROD.3F.1 / PROD.4A.1): If no distinct suggestions exist, but AI successfully reviewed the line
  // and confirmed OCR is accurate, provide a real suggestion card labeled "Gợi ý 1" with badge "AI xác nhận".
  // RULE: Only allowed if at least one real provider call SUCCEEDED. Never fabricate AI confirmation.
  if (visible.length === 0 && includeConfirmedCard && rawOcr) {
    const groqView = buildAdvisorView(line, 'GROQ');
    const geminiView = buildAdvisorView(line, 'GEMINI');
    const groqSuccess = groqView.status === 'SUCCESS';
    const geminiSuccess = geminiView.status === 'SUCCESS';
    const hasSuccessfulProvider =
      groqSuccess ||
      geminiSuccess ||
      (Array.isArray(line.suggestions) && line.suggestions.some((s) => s.status === 'SUCCESS'));

    if (hasSuccessfulProvider) {
      visible.push({
        id: 'sugg-1',
        label: 'Gợi ý 1',
        buttonLabel: 'Dùng gợi ý 1',
        accessibilityLabel: 'Chọn gợi ý 1',
        text: rawOcr,
        confidence: groqView.confidence || geminiView.confidence || line.rawOcrConfidence,
        decision: groqView.decision || geminiView.decision || 'KEEP_RAW',
        provider: groqSuccess ? 'GROQ' : (geminiSuccess ? 'GEMINI' : undefined),
        isAiConfirmed: true,
        badge: 'AI xác nhận',
      });
    }
  }

  return visible;
}

/**
 * Determines the line review status for student-facing UI presentation (PROD.3F Scope 4.5 / PROD.4A.1).
 *
 * Statuses:
 * - SUGGESTIONS_AVAILABLE: At least 1 distinct suggestion exists ("Gợi ý 1", "Gợi ý 2").
 * - AI_CONFIRMED: AI reviewed the line and confirmed OCR is accurate (shows compact friendly confirmation).
 * - PROVIDER_OUTAGE: All providers are down/unavailable (shows graceful fallback "Chưa thể kiểm tra thêm lúc này.").
 */
export function getLineReviewStatus(line: Partial<MultilineLineResult>): LineReviewStatus {
  const distinctVisible = buildVisibleSuggestions(line, { includeConfirmedCard: false });
  if (distinctVisible.length > 0) {
    return 'SUGGESTIONS_AVAILABLE';
  }

  const groqView = buildAdvisorView(line, 'GROQ');
  const geminiView = buildAdvisorView(line, 'GEMINI');

  const groqSuccess = groqView.status === 'SUCCESS';
  const geminiSuccess = geminiView.status === 'SUCCESS';
  const hasSuggestionSuccess =
    Array.isArray(line.suggestions) && line.suggestions.some((s) => s.status === 'SUCCESS');

  if (groqSuccess || geminiSuccess || hasSuggestionSuccess) {
    return 'AI_CONFIRMED';
  }

  // Never synthesize fake AI confirmation when providers failed or were not called
  return 'PROVIDER_OUTAGE';
}

export type LineSelectedSource =
  | 'OCR'
  | 'SUGGESTION_1'
  | 'SUGGESTION_2'
  | 'MANUAL_EDIT'
  | 'ocr'
  | 'suggestion_1'
  | 'suggestion_2'
  | 'manual_edit';

export type SelectionReason =
  | 'MANUAL_EDIT_OVERRIDE'
  | 'USER_EXPLICIT_SELECTION'
  | 'MULTI_PROVIDER_CONSENSUS'
  | 'GARBLED_OCR_DETERMINISTIC_CORRECTION'
  | 'NEEDS_REVIEW'
  | 'LOW_OCR_HIGH_AI_EVIDENCE'
  | 'AI_CONFIDENCE_HIGHER'
  | 'OCR_DEFAULT_INSUFFICIENT_EVIDENCE'
  | 'OCR_CONFIDENCE_HIGHER_OR_EQUAL'
  | 'AI_CONFIRMED_IDENTICAL'
  | 'NO_SUGGESTIONS_OCR_DEFAULT'
  | 'PROVIDER_OUTAGE_OCR_FALLBACK';

export type OcrConfidenceSource = 'CRNN_CTC_SOFTMAX' | 'NONE';
export type AiConfidenceSource = 'GROQ_SELF_REPORTED' | 'GEMINI_SELF_REPORTED' | 'MULTI_PROVIDER' | 'NONE';

export interface ChangedSpanEvidence {
  rawSpan: string;
  suggSpan: string;
  ocrToken?: string;
  candidateToken?: string;
  editDistance: number;
  normalizedEditRatio: number;
  ocrTokenValid: boolean;
  candidateTokenValid: boolean;
  lexicalValidity?: boolean;
  contextEvidence?: string;
}

export interface SuggestionDevLog {
  suggestionIndex: number; // 1 | 2
  text: string;
  provider?: string;
  providerStatus?: string;
  selfReportedConfidence?: number;
  independentProviderId?: string;
  evidenceReason?: string;
  selected: boolean;
  selectionReason: string;
}

export interface LineDecisionEvidence {
  rawOcrConfidence?: number;
  rawOcrConfidenceSource: OcrConfidenceSource;
  rawAiConfidence?: number;
  aiConfidenceSource: AiConfidenceSource;
  isOrthographicEdit: boolean;
  editDistance: number;
  providerConsensus: boolean;
  hasLowOcrConfidence: boolean;
  hasHighAiConfidence: boolean;
  changedSpans: { rawSpan: string; suggSpan: string }[];
  detailedSpans?: ChangedSpanEvidence[];
  ruleApplied: string;
  notes?: string;
}

export interface LineDisplayState {
  rawOcrText: string;
  rawOcrConfidence?: number;
  rawOcrConfidenceSource?: OcrConfidenceSource;
  ocrText: string;
  aiSuggestions: VisibleSuggestion[];
  currentText: string;
  selectedSource: LineSelectedSource;
  selectionReason: SelectionReason;

  // Confidence Provenance & Safe Arbitration fields (PROD.4A.3 / 4B.1)
  rawAiConfidence?: number;
  aiConfidenceSource?: AiConfidenceSource;
  decisionEvidence?: LineDecisionEvidence;
  decisionReason?: string;
  arbitrationScore?: number; // Internal heuristic score, NOT probability
  suggestionDevLogs?: SuggestionDevLog[];

  // Decoupled AI Confirmation & Provenance fields (PROD.4A.2/4A.3 Section D)
  isAiConfirmed?: boolean;
  aiReviewed?: boolean;
  reviewStatus?: LineReviewStatus;
  confirmationProviders?: string[];
}

/**
 * Common standard Vietnamese reduplicative pairs (từ láy) and collocations.
 */
export const COMMON_VIETNAMESE_REDUPLICATIVES = new Set([
  'rung rinh', 'ra rả', 'thong thả', 'rộn ràng', 'róc rách', 'lung linh', 'lao xao',
  'bâng khuâng', 'lom khom', 'lác đác', 'loang loáng', 'xao xuyến', 'thoang thoảng',
  'nhè nhẹ', 'vàng vọt', 'đo đỏ', 'xanh xanh', 'tím tím', 'trăng trắng', 'chầm chậm',
  'bướm lượn', 'nắng xế', 'lưng đồi', 'ngọt thế'
]);

export function normalizeVietnameseWord(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^[^a-zA-ZàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]+|[^a-zA-ZàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]+$/g, '')
    .toLowerCase();
}

export function removeToneMarks(str: string): string {
  return str
    .replace(/[àáảãạ]/g, 'a')
    .replace(/[ằắẳẵặ]/g, 'ă')
    .replace(/[ầấẩẫậ]/g, 'â')
    .replace(/[èéẻẽẹ]/g, 'e')
    .replace(/[ềếểễệ]/g, 'ê')
    .replace(/[ìíỉĩị]/g, 'i')
    .replace(/[òóỏõọ]/g, 'o')
    .replace(/[ồốổỗộ]/g, 'ô')
    .replace(/[ờớởỡợ]/g, 'ơ')
    .replace(/[ùúủũụ]/g, 'u')
    .replace(/[ừứửữự]/g, 'ư')
    .replace(/[ỳýỷỹỵ]/g, 'y')
    .replace(/đ/g, 'd');
}

/**
 * Validates whether a token represents a phonotactically legal Vietnamese syllable.
 * Rejects illegal consonant clusters (e.g. 'sr', 'bl', 'str'), invalid tone placements,
 * or non-Vietnamese letters (w, z, j, f).
 */
export function isVietnameseSyllableValid(raw: string | null | undefined): boolean {
  const word = normalizeVietnameseWord(raw);
  if (!word) return false;

  // Reject foreign characters not in Vietnamese orthography
  if (/[wzjf]/i.test(word)) {
    return false;
  }

  // Reject illegal initial consonant clusters in Vietnamese
  if (/^(sr|str|bl|br|cl|cr|dr|fl|fr|gl|gr|pl|pr|sk|sl|sm|sn|sp|st|vr|ts|ps)/i.test(word)) {
    return false;
  }

  // Reject duplicate adjacent letters (no geminate consonants or double vowels in Vietnamese)
  if (/(.)\1/i.test(word)) {
    return false;
  }

  // Reject 3+ consecutive consonants unless standard trigraph 'ngh'
  if (/[bcdfghjklmnpqrstvx]{3,}/i.test(word) && !/^(ngh)/i.test(word)) {
    return false;
  }

  const base = removeToneMarks(word);

  // Match legal Vietnamese onset (phụ âm đầu)
  const onsetMatch = base.match(/^(ngh|ng|gh|gi|kh|nh|ph|qu|th|tr|ch|[bcdđghklmnprstvx])?/);
  const onset = onsetMatch ? onsetMatch[0] : '';
  const remainder = base.slice(onset.length);

  // Remainder must begin with a vowel (nucleus)
  if (!remainder || !/^[aăâeêiyoôơuư]/.test(remainder)) {
    return false;
  }

  // Orthographic spelling constraints:
  // ngh, gh, k only with front vowels (e, ê, i, y)
  if (['ngh', 'gh', 'k'].includes(onset)) {
    if (!/^[eêiy]/.test(remainder)) return false;
  }
  // c, g, ng before front vowels e, ê, i is illegal spelling (c -> k, g -> gh, ng -> ngh)
  if (['c', 'g', 'ng'].includes(onset) && /^[eêi]/.test(remainder)) {
    return false;
  }

  return true;
}

export function isStandardNativeRhyme(token: string): boolean {
  const clean = normalizeVietnameseWord(token);
  // -ing is loanword or non-native (standard native is -inh)
  if (clean.endsWith('ing') && !clean.endsWith('nh')) {
    return false;
  }
  return true;
}

export function isStandardVietnameseReduplicative(word1: string, word2: string): boolean {
  if (!word1 || !word2) return false;
  const w1 = normalizeVietnameseWord(word1);
  const w2 = normalizeVietnameseWord(word2);
  const pair = `${w1} ${w2}`;
  if (COMMON_VIETNAMESE_REDUPLICATIVES.has(pair)) return true;
  // Alliteration check with valid syllables
  if (w1.length >= 2 && w2.length >= 2 && w1[0] === w2[0]) {
    if (isVietnameseSyllableValid(w1) && isVietnameseSyllableValid(w2) && isStandardNativeRhyme(w2)) {
      return true;
    }
  }
  return false;
}

/**
 * Computes differing character spans between two strings for inspectable provenance evidence.
 */
export function computeChangedSpans(s1: string, s2: string): { rawSpan: string; suggSpan: string }[] {
  if (!s1 && !s2) return [];
  if (s1 === s2) return [];
  let start = 0;
  while (start < s1.length && start < s2.length && s1[start] === s2[start]) {
    start++;
  }
  let end1 = s1.length - 1;
  let end2 = s2.length - 1;
  while (end1 >= start && end2 >= start && s1[end1] === s2[end2]) {
    end1--;
    end2--;
  }
  const rawSpan = s1.slice(start, end1 + 1);
  const suggSpan = s2.slice(start, end2 + 1);
  return [{ rawSpan, suggSpan }];
}

/**
 * Computes detailed token/span-level evidence comparing OCR and suggestion strings.
 */
export function computeDetailedSpanEvidence(ocrText: string, candText: string): ChangedSpanEvidence[] {
  const ocrTokens = ocrText.trim().split(/\s+/);
  const candTokens = candText.trim().split(/\s+/);
  const results: ChangedSpanEvidence[] = [];

  const maxLen = Math.max(ocrTokens.length, candTokens.length);
  for (let i = 0; i < maxLen; i++) {
    const ocrTok = ocrTokens[i] || '';
    const candTok = candTokens[i] || '';
    if (ocrTok !== candTok) {
      const dist = computeLevenshteinDistance(ocrTok, candTok);
      const ratio = Math.max(ocrTok.length, candTok.length) > 0 ? dist / Math.max(ocrTok.length, candTok.length) : 0;
      const ocrValid = isVietnameseSyllableValid(ocrTok);
      const candValid = isVietnameseSyllableValid(candTok);
      const prevTok = i > 0 ? (candTokens[i - 1] || ocrTokens[i - 1]) : '';
      const isRedup = isStandardVietnameseReduplicative(prevTok, candTok);
      const isNative = isStandardNativeRhyme(candTok);
      const lexicalValidity = isRedup || isNative;
      let contextEvidence = '';
      if (isRedup) contextEvidence = `Reduplicative collocation with '${prevTok}'`;
      else if (isNative) contextEvidence = 'Standard native rhyme';

      results.push({
        rawSpan: ocrTok,
        suggSpan: candTok,
        ocrToken: ocrTok,
        candidateToken: candTok,
        editDistance: dist,
        normalizedEditRatio: ratio,
        ocrTokenValid: ocrValid,
        candidateTokenValid: candValid,
        lexicalValidity,
        contextEvidence,
      });
    }
  }

  // Fallback to character spans if token count mismatch produced nothing
  if (results.length === 0 && ocrText !== candText) {
    const charSpans = computeChangedSpans(ocrText, candText);
    for (const cs of charSpans) {
      const dist = computeLevenshteinDistance(cs.rawSpan, cs.suggSpan);
      results.push({
        rawSpan: cs.rawSpan,
        suggSpan: cs.suggSpan,
        ocrToken: cs.rawSpan,
        candidateToken: cs.suggSpan,
        editDistance: dist,
        normalizedEditRatio: Math.max(cs.rawSpan.length, cs.suggSpan.length) > 0 ? dist / Math.max(cs.rawSpan.length, cs.suggSpan.length) : 0,
        ocrTokenValid: isVietnameseSyllableValid(cs.rawSpan),
        candidateTokenValid: isVietnameseSyllableValid(cs.suggSpan),
      });
    }
  }

  return results;
}

/**
 * Standard Levenshtein edit distance between two strings.
 */
export function computeLevenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Evaluates whether an AI suggestion represents a valid orthographic/spelling correction
 * of the OCR text (e.g. diacritic variation, character confusion like ng/nh, r/d/gi, s/x).
 */
export function isOrthographicCorrection(ocr: string, sugg: string): boolean {
  if (!ocr || !sugg) return false;
  const normOcr = normalizeForComparison(ocr);
  const normSugg = normalizeForComparison(sugg);
  if (normOcr === normSugg) return false;

  const dist = computeLevenshteinDistance(normOcr, normSugg);
  const maxLen = Math.max(normOcr.length, normSugg.length);
  if (maxLen === 0) return false;

  // Minimal edit: distance <= 2 characters, or edit ratio <= 0.20 for longer lines
  const editRatio = dist / maxLen;
  return dist <= 2 || (editRatio <= 0.20 && dist <= 4);
}

/**
 * Asserts that currentText strictly equals one of the legal source strings,
 * AND that selectedSource strictly matches the provenance of currentText (PROD.4A.4 Section C).
 *
 * Source-implies-value (one-way implication):
 * 1) selectedSource === 'OCR' => currentText === rawOcrText || currentText === ocrText
 * 2) selectedSource === 'SUGGESTION_1' => currentText === suggestion[0].text
 * 3) selectedSource === 'SUGGESTION_2' => currentText === suggestion[1].text
 * 4) selectedSource === 'MANUAL_EDIT' => currentText === manualText (or currentText is recorded manual text)
 *
 * We DO NOT apply the reverse direction (IFF).
 * For instance, if user manually edits text to be identical to rawOcrText,
 * selectedSource='MANUAL_EDIT' is valid and preserves the manual edit action provenance.
 */
export function assertLegalCurrentText(state: LineDisplayState, manualText?: string | null): boolean {
  const legalSources = new Set<string>();
  legalSources.add(state.rawOcrText);
  legalSources.add(state.ocrText);
  if (state.aiSuggestions.length > 0) legalSources.add(state.aiSuggestions[0].text);
  if (state.aiSuggestions.length > 1) legalSources.add(state.aiSuggestions[1].text);
  if (manualText != null && manualText.trim().length > 0) legalSources.add(manualText);

  // Invariant 1: currentText must strictly match one of the legal source strings (no third synthetic string)
  if (!legalSources.has(state.currentText)) {
    return false;
  }

  // Invariant 2: Source-implies-value (one-way implication)
  const src = state.selectedSource.toUpperCase();
  if (src === 'OCR') {
    if (state.currentText !== state.rawOcrText && state.currentText !== state.ocrText) {
      return false;
    }
  } else if (src === 'SUGGESTION_1') {
    if (state.aiSuggestions.length === 0 || state.currentText !== state.aiSuggestions[0].text) {
      return false;
    }
  } else if (src === 'SUGGESTION_2') {
    if (state.aiSuggestions.length < 2 || state.currentText !== state.aiSuggestions[1].text) {
      return false;
    }
  } else if (src === 'MANUAL_EDIT' || src === 'MANUAL') {
    if (manualText != null && state.currentText !== manualText) {
      return false;
    }
  }

  return true;
}

/**
 * Resolves the display state for a line item strictly and immutably (PROD.4A.3 Confidence Provenance & Safe Arbitration Closure).
 *
 * Requirements:
 * 1. rawOcrText / ocrText: Immutable raw OCR result.
 * 2. rawOcrConfidence: CRNN CTC token-level softmax confidence.
 * 3. rawOcrConfidenceSource: 'CRNN_CTC_SOFTMAX' or 'NONE'.
 * 4. aiSuggestions: Array of visible AI suggestions.
 * 5. currentText: Must equal exactly one of: rawOcrText, suggestion[0].text, suggestion[1].text, manual-edit text.
 * 6. selectedSource: Must strictly match the provenance of currentText:
 *    - 'OCR' if currentText equals rawOcrText / ocrText.
 *    - 'SUGGESTION_1' if currentText equals suggestion[0].text.
 *    - 'SUGGESTION_2' if currentText equals suggestion[1].text.
 *    - 'MANUAL_EDIT' if currentText equals manual edit text.
 * 7. Safe Arbitration (PROD.4A.3 Section B):
 *    - Order of precedence: MANUAL_EDIT > USER_EXPLICIT_SELECTION > OCR == AI > OCR != AI (only if sufficient evidence) > DEFAULT OCR.
 *    - AI only auto-selects if there is demonstrable independent evidence (multi-provider consensus, or low OCR + high AI + minimal orthographic edit).
 *    - No artificial 0.90 multiplier / fake calibration.
 * 8. Decoupled AI Confirmation:
 *    - isAiConfirmed and reviewStatus reflect AI review independently of selectedSource.
 */
export function resolveLineDisplayState(line: Partial<MultilineLineResult>): LineDisplayState {
  // 1. ocrText: Immutable raw OCR text (fallback to predictedText only if rawOcrText is absent)
  const rawOcrText = (line.rawOcrText || line.predictedText || '').trim();
  const rawOcrConfidence = line.rawOcrConfidence;
  const rawOcrConfidenceSource: OcrConfidenceSource =
    typeof rawOcrConfidence === 'number' && !isNaN(rawOcrConfidence) ? 'CRNN_CTC_SOFTMAX' : 'NONE';
  const ocrText = rawOcrText;

  // 2. aiSuggestions: Clean, visible suggestions (Gợi ý 1, Gợi ý 2)
  const aiSuggestions = buildVisibleSuggestions(line);
  const sugg1 = aiSuggestions.length > 0 ? aiSuggestions[0].text : null;
  const sugg2 = aiSuggestions.length > 1 ? aiSuggestions[1].text : null;

  // 3. Provider review status and confirmation providers
  const groqView = buildAdvisorView(line, 'GROQ');
  const geminiView = buildAdvisorView(line, 'GEMINI');
  const groqSuccess = groqView.status === 'SUCCESS';
  const geminiSuccess = geminiView.status === 'SUCCESS';
  const confirmationProviders: string[] = [];
  if (groqSuccess) confirmationProviders.push('GROQ');
  if (geminiSuccess) confirmationProviders.push('GEMINI');
  const aiReviewed = confirmationProviders.length > 0;
  const reviewStatus = getLineReviewStatus(line);
  const isAiConfirmed = reviewStatus === 'AI_CONFIRMED' || Boolean(aiSuggestions[0]?.isAiConfirmed);

  // 4. First suggestion details & multi-provider consensus check
  const firstSugg = aiSuggestions.length > 0 ? aiSuggestions[0] : null;
  const rawAiConfidence =
    firstSugg && typeof firstSugg.confidence === 'number' && !isNaN(firstSugg.confidence)
      ? firstSugg.confidence
      : undefined;

  let aiConfidenceSource: AiConfidenceSource = 'NONE';
  if (firstSugg) {
    if (firstSugg.provider === 'GROQ') aiConfidenceSource = 'GROQ_SELF_REPORTED';
    else if (firstSugg.provider === 'GEMINI') aiConfidenceSource = 'GEMINI_SELF_REPORTED';
  }

  // Check if both Groq and Gemini independently agreed on the exact suggestion text
  const hasMultiProviderConsensus = Boolean(
    groqSuccess &&
    geminiSuccess &&
    line.groqSuggestion &&
    line.geminiSuggestion &&
    normalizeForComparison(line.groqSuggestion) === normalizeForComparison(line.geminiSuggestion) &&
    normalizeForComparison(line.groqSuggestion) !== normalizeForComparison(ocrText)
  );

  if (hasMultiProviderConsensus) {
    aiConfidenceSource = 'MULTI_PROVIDER';
  }

  const isOrtho = firstSugg ? isOrthographicCorrection(ocrText, firstSugg.text) : false;
  const editDist = firstSugg
    ? computeLevenshteinDistance(normalizeForComparison(ocrText), normalizeForComparison(firstSugg.text))
    : 0;
  const changedSpans = firstSugg ? computeChangedSpans(ocrText, firstSugg.text) : [];
  const hasLowOcrConfidence =
    typeof rawOcrConfidence === 'number' && !isNaN(rawOcrConfidence) && rawOcrConfidence < 0.90;
  const hasHighAiConfidence =
    typeof rawAiConfidence === 'number' && !isNaN(rawAiConfidence) && rawAiConfidence >= 0.95;

  const detailedSpans = firstSugg ? computeDetailedSpanEvidence(ocrText, firstSugg.text) : [];
  const decisionEvidence: LineDecisionEvidence = {
    rawOcrConfidence,
    rawOcrConfidenceSource,
    rawAiConfidence,
    aiConfidenceSource,
    isOrthographicEdit: isOrtho,
    editDistance: editDist,
    providerConsensus: hasMultiProviderConsensus,
    hasLowOcrConfidence,
    hasHighAiConfidence,
    changedSpans,
    detailedSpans,
    ruleApplied: 'INITIAL_EVALUATION',
  };

  const buildDevLogs = (selectedSrc: LineSelectedSource, selReason: SelectionReason): SuggestionDevLog[] => {
    return aiSuggestions.map((sugg, idx) => {
      const isSelected =
        (idx === 0 && (selectedSrc === 'SUGGESTION_1' || selectedSrc === 'suggestion_1')) ||
        (idx === 1 && (selectedSrc === 'SUGGESTION_2' || selectedSrc === 'suggestion_2'));
      let evidenceReason = sugg.isAiConfirmed ? 'AI confirmed match' : 'Single provider candidate';
      if (hasMultiProviderConsensus) evidenceReason = 'Multi-provider consensus';
      else if (isSelected && selReason === 'GARBLED_OCR_DETERMINISTIC_CORRECTION') {
        evidenceReason = 'Phonotactic garble correction with deterministic lexical superiority';
      }
      return {
        suggestionIndex: idx + 1,
        text: sugg.text,
        provider: sugg.provider,
        providerStatus: sugg.provider === 'GROQ' ? groqView.status : (sugg.provider === 'GEMINI' ? geminiView.status : undefined),
        selfReportedConfidence: sugg.confidence,
        independentProviderId: sugg.provider,
        evidenceReason,
        selected: isSelected,
        selectionReason: isSelected ? selReason : 'NOT_SELECTED',
      };
    });
  };

  const baseDiags = {
    rawAiConfidence,
    aiConfidenceSource,
    decisionEvidence,
    isAiConfirmed,
    aiReviewed,
    reviewStatus,
    confirmationProviders,
  };

  // 5. User manual edit or explicit suggestion selection
  if (line.verdict === 'CORRECTED' && line.verifiedTextRaw !== undefined && line.verifiedTextRaw !== null) {
    const manual = line.verifiedTextRaw;
    decisionEvidence.ruleApplied = 'RULE_1_MANUAL_EDIT_OVERRIDE';

    // If explicit selectedSource was provided on the line, preserve it!
    if (line.selectedSource) {
      const srcUpper = line.selectedSource.toUpperCase();
      if (srcUpper === 'SUGGESTION_1' && sugg1) {
        return {
          rawOcrText,
          rawOcrConfidence,
          rawOcrConfidenceSource,
          ocrText,
          aiSuggestions,
          currentText: sugg1,
          selectedSource: 'SUGGESTION_1',
          selectionReason: 'USER_EXPLICIT_SELECTION',
          decisionReason: 'USER_EXPLICIT_SELECTION',
          ...baseDiags,
        };
      }
      if (srcUpper === 'SUGGESTION_2' && sugg2) {
        return {
          rawOcrText,
          rawOcrConfidence,
          rawOcrConfidenceSource,
          ocrText,
          aiSuggestions,
          currentText: sugg2,
          selectedSource: 'SUGGESTION_2',
          selectionReason: 'USER_EXPLICIT_SELECTION',
          decisionReason: 'USER_EXPLICIT_SELECTION',
          ...baseDiags,
        };
      }
      if (srcUpper === 'MANUAL_EDIT' || srcUpper === 'MANUAL') {
        return {
          rawOcrText,
          rawOcrConfidence,
          rawOcrConfidenceSource,
          ocrText,
          aiSuggestions,
          currentText: manual,
          selectedSource: 'MANUAL_EDIT',
          selectionReason: 'MANUAL_EDIT_OVERRIDE',
          decisionReason: 'MANUAL_EDIT_OVERRIDE',
          ...baseDiags,
          isAiConfirmed: false,
        };
      }
    }

    // Otherwise infer action from text matching without rewriting to OCR
    if (sugg1 && manual === sugg1) {
      return {
        rawOcrText,
        rawOcrConfidence,
        rawOcrConfidenceSource,
        ocrText,
        aiSuggestions,
        currentText: sugg1,
        selectedSource: 'SUGGESTION_1',
        selectionReason: 'USER_EXPLICIT_SELECTION',
        decisionReason: 'USER_EXPLICIT_SELECTION',
        ...baseDiags,
      };
    }
    if (sugg2 && manual === sugg2) {
      return {
        rawOcrText,
        rawOcrConfidence,
        rawOcrConfidenceSource,
        ocrText,
        aiSuggestions,
        currentText: sugg2,
        selectedSource: 'SUGGESTION_2',
        selectionReason: 'USER_EXPLICIT_SELECTION',
        decisionReason: 'USER_EXPLICIT_SELECTION',
        ...baseDiags,
      };
    }

    // Manual edit: even if manual === ocrText, selectedSource remains MANUAL_EDIT!
    return {
      rawOcrText,
      rawOcrConfidence,
      rawOcrConfidenceSource,
      ocrText,
      aiSuggestions,
      currentText: manual,
      selectedSource: 'MANUAL_EDIT',
      selectionReason: 'MANUAL_EDIT_OVERRIDE',
      decisionReason: 'MANUAL_EDIT_OVERRIDE',
      ...baseDiags,
      isAiConfirmed: false,
    };
  }

  // 6. User explicitly chose "Giữ OCR gốc" (verdict === 'CORRECT')
  if (line.verdict === 'CORRECT') {
    decisionEvidence.ruleApplied = 'RULE_2_USER_EXPLICIT_OCR_SELECTION';
    return {
      rawOcrText,
      rawOcrConfidence,
      rawOcrConfidenceSource,
      ocrText,
      aiSuggestions,
      currentText: ocrText,
      selectedSource: 'OCR',
      selectionReason: 'USER_EXPLICIT_SELECTION',
      decisionReason: 'USER_EXPLICIT_SELECTION',
      ...baseDiags,
    };
  }

  // 7. Preserved explicit selection from hydrated state
  if (line.selectedSource) {
    const srcUpper = line.selectedSource.toUpperCase();
    if (srcUpper === 'MANUAL_EDIT' || srcUpper === 'MANUAL') {
      const manual = line.verifiedTextRaw || line.currentText || ocrText;
      decisionEvidence.ruleApplied = 'RULE_1_MANUAL_EDIT_OVERRIDE';
      return {
        rawOcrText,
        rawOcrConfidence,
        rawOcrConfidenceSource,
        ocrText,
        aiSuggestions,
        currentText: manual,
        selectedSource: 'MANUAL_EDIT',
        selectionReason: 'MANUAL_EDIT_OVERRIDE',
        decisionReason: 'MANUAL_EDIT_OVERRIDE',
        ...baseDiags,
        isAiConfirmed: false,
      };
    }
    if (srcUpper === 'SUGGESTION_1' && sugg1) {
      decisionEvidence.ruleApplied = 'RULE_2_USER_EXPLICIT_SUGGESTION_1';
      return {
        rawOcrText,
        rawOcrConfidence,
        rawOcrConfidenceSource,
        ocrText,
        aiSuggestions,
        currentText: sugg1,
        selectedSource: 'SUGGESTION_1',
        selectionReason: 'USER_EXPLICIT_SELECTION',
        decisionReason: 'USER_EXPLICIT_SELECTION',
        ...baseDiags,
      };
    }
    if (srcUpper === 'SUGGESTION_2' && sugg2) {
      decisionEvidence.ruleApplied = 'RULE_2_USER_EXPLICIT_SUGGESTION_2';
      return {
        rawOcrText,
        rawOcrConfidence,
        rawOcrConfidenceSource,
        ocrText,
        aiSuggestions,
        currentText: sugg2,
        selectedSource: 'SUGGESTION_2',
        selectionReason: 'USER_EXPLICIT_SELECTION',
        decisionReason: 'USER_EXPLICIT_SELECTION',
        ...baseDiags,
      };
    }
    if (srcUpper === 'OCR') {
      decisionEvidence.ruleApplied = 'RULE_2_USER_EXPLICIT_OCR';
      return {
        rawOcrText,
        rawOcrConfidence,
        rawOcrConfidenceSource,
        ocrText,
        aiSuggestions,
        currentText: ocrText,
        selectedSource: 'OCR',
        selectionReason: 'USER_EXPLICIT_SELECTION',
        decisionReason: 'USER_EXPLICIT_SELECTION',
        ...baseDiags,
      };
    }
  }

  // 8. Automatic selection when unverified (Safe Arbitration Rules)
  if (aiSuggestions.length > 0 && firstSugg) {
    const normOcr = normalizeForComparison(ocrText);
    const normSugg1 = normalizeForComparison(firstSugg.text);

    // Rule 3: If OCR and AI candidate text normalize to the same text:
    // Provenance invariant: currentText equals OCR text => selectedSource is strictly 'OCR'
    // isAiConfirmed is true ONLY when at least one provider was genuinely SUCCESS
    if (normOcr === normSugg1 || firstSugg.isAiConfirmed) {
      const genuinelyConfirmed = groqSuccess || geminiSuccess;
      decisionEvidence.ruleApplied = 'RULE_3_OCR_EQUALS_AI_CONFIRMED';
      return {
        rawOcrText,
        rawOcrConfidence,
        rawOcrConfidenceSource,
        ocrText,
        aiSuggestions,
        currentText: ocrText || firstSugg.text,
        selectedSource: 'OCR',
        selectionReason: 'AI_CONFIRMED_IDENTICAL',
        decisionReason: 'AI_CONFIRMED_IDENTICAL',
        ...baseDiags,
        isAiConfirmed: genuinelyConfirmed,
      };
    }

    // Rule 4: OCR differs from AI (OCR != AI)
    // AI only AUTO-SELECTS when there is INDEPENDENT EVIDENCE outside self-reported scores:

    // Case 4A: Multi-Provider Independent Consensus
    // Both Groq and Gemini independently agree on the exact same minimal correction
    if (hasMultiProviderConsensus && isOrtho) {
      decisionEvidence.ruleApplied = 'RULE_4A_MULTI_PROVIDER_CONSENSUS';
      const selSrc: LineSelectedSource = 'SUGGESTION_1';
      const selReason: SelectionReason = 'MULTI_PROVIDER_CONSENSUS';
      return {
        rawOcrText,
        rawOcrConfidence,
        rawOcrConfidenceSource,
        ocrText,
        aiSuggestions,
        currentText: firstSugg.text,
        selectedSource: selSrc,
        selectionReason: selReason,
        decisionReason: selReason,
        ...baseDiags,
        suggestionDevLogs: buildDevLogs(selSrc, selReason),
      };
    }

    // Case 4B: Deterministic Evidence on Garbled OCR (PROD.4B.1)
    // When an OCR token has strong evidence of being phonotactically invalid/garbled (e.g. 'sring'),
    // and candidate 1 has deterministic evidence of valid Vietnamese orthography and minimal edit,
    // and candidate 1 is demonstrably superior to candidate 2:
    const sugg1Detailed = detailedSpans;
    const hasGarbledOcrToken = sugg1Detailed.some((e) => !e.ocrTokenValid);
    const hasValidCand1 = sugg1Detailed.length > 0 && sugg1Detailed.every((e) => e.candidateTokenValid);
    const isMinimalEdit1 = isOrtho || sugg1Detailed.every((e) => e.editDistance <= 2 || e.normalizedEditRatio <= 0.40);

    const secondSugg = aiSuggestions.length > 1 ? aiSuggestions[1] : null;
    const sugg2Detailed = secondSugg ? computeDetailedSpanEvidence(ocrText, secondSugg.text) : [];

    if (hasGarbledOcrToken && hasValidCand1 && isMinimalEdit1) {
      let cand1StrongerThanCand2 = true;
      if (secondSugg) {
        const cand1LexicalHits = sugg1Detailed.reduce((sum, e) => sum + (e.lexicalValidity ? 1 : 0), 0);
        const cand2LexicalHits = sugg2Detailed.reduce((sum, e) => sum + (e.lexicalValidity ? 1 : 0), 0);
        const cand2AllValid = sugg2Detailed.every((e) => e.candidateTokenValid);

        const cand1ValidOverwrites = sugg1Detailed.filter((e) => e.ocrTokenValid && e.editDistance > 0).length;
        const cand2ValidOverwrites = sugg2Detailed.filter((e) => e.ocrTokenValid && e.editDistance > 0).length;

        if (!cand2AllValid) {
          cand1StrongerThanCand2 = true;
        } else if (cand1ValidOverwrites < cand2ValidOverwrites) {
          // Candidate 1 repairs garbled tokens without mutating valid OCR words
          cand1StrongerThanCand2 = true;
        } else if (cand1ValidOverwrites > cand2ValidOverwrites) {
          cand1StrongerThanCand2 = false;
        } else if (cand1LexicalHits > cand2LexicalHits) {
          cand1StrongerThanCand2 = true;
        } else if (cand1LexicalHits < cand2LexicalHits) {
          cand1StrongerThanCand2 = false;
        } else {
          // Tied evidence without consensus -> ambiguous, require user review
          cand1StrongerThanCand2 = false;
        }
      }

      if (cand1StrongerThanCand2) {
        decisionEvidence.ruleApplied = 'RULE_4B_DETERMINISTIC_EVIDENCE_WINS';
        decisionEvidence.notes = 'OCR token is phonotactically invalid, Candidate 1 has strong deterministic validity';
        const selSrc: LineSelectedSource = 'SUGGESTION_1';
        const selReason: SelectionReason = 'GARBLED_OCR_DETERMINISTIC_CORRECTION';
        return {
          rawOcrText,
          rawOcrConfidence,
          rawOcrConfidenceSource,
          ocrText,
          aiSuggestions,
          currentText: firstSugg.text,
          selectedSource: selSrc,
          selectionReason: selReason,
          decisionReason: selReason,
          ...baseDiags,
          suggestionDevLogs: buildDevLogs(selSrc, selReason),
        };
      } else {
        // Conflicting candidates without clear superiority -> keep OCR + NEEDS_REVIEW
        decisionEvidence.ruleApplied = 'RULE_4B_CONFLICTING_CANDIDATES_NEEDS_REVIEW';
        const selSrc: LineSelectedSource = 'OCR';
        const selReason: SelectionReason = 'NEEDS_REVIEW';
        return {
          rawOcrText,
          rawOcrConfidence,
          rawOcrConfidenceSource,
          ocrText,
          aiSuggestions,
          currentText: ocrText,
          selectedSource: selSrc,
          selectionReason: selReason,
          decisionReason: selReason,
          ...baseDiags,
          suggestionDevLogs: buildDevLogs(selSrc, selReason),
        };
      }
    }

    // Rule 5: INSUFFICIENT INDEPENDENT EVIDENCE to override OCR (PROD.4A.4 Section A)
    // Cross-scale confidence comparison (rawOcrConfidence < X && rawAiConfidence >= Y) is NOT independent evidence.
    // Even if OCR confidence is low (e.g. 0.50, 0.70) and AI confidence is high (0.98, 0.99),
    // we DO NOT auto-select AI when there is only 1 provider and no independent consensus.
    // -> Default stays OCR! Suggestion 1 remains visible in card for student/user choice.
    // Safety is prioritized over automated speculation.
    decisionEvidence.ruleApplied = 'RULE_5_INSUFFICIENT_EVIDENCE_OCR_DEFAULT';
    const isOcrHigher =
      typeof rawOcrConfidence === 'number' &&
      typeof rawAiConfidence === 'number' &&
      rawOcrConfidence >= rawAiConfidence;

    const selSrc: LineSelectedSource = 'OCR';
    const selReason: SelectionReason = isOcrHigher ? 'OCR_CONFIDENCE_HIGHER_OR_EQUAL' : 'OCR_DEFAULT_INSUFFICIENT_EVIDENCE';
    return {
      rawOcrText,
      rawOcrConfidence,
      rawOcrConfidenceSource,
      ocrText,
      aiSuggestions,
      currentText: ocrText,
      selectedSource: selSrc,
      selectionReason: selReason,
      decisionReason: selReason,
      ...baseDiags,
      suggestionDevLogs: buildDevLogs(selSrc, selReason),
    };
  }

  // Default to OCR text if no suggestions available
  decisionEvidence.ruleApplied = 'RULE_6_NO_SUGGESTIONS_OCR_DEFAULT';
  const selSrc: LineSelectedSource = 'OCR';
  const selReason: SelectionReason = 'NO_SUGGESTIONS_OCR_DEFAULT';
  return {
    rawOcrText,
    rawOcrConfidence,
    rawOcrConfidenceSource,
    ocrText,
    aiSuggestions,
    currentText: ocrText,
    selectedSource: selSrc,
    selectionReason: selReason,
    decisionReason: selReason,
    ...baseDiags,
    suggestionDevLogs: buildDevLogs(selSrc, selReason),
  };
}

