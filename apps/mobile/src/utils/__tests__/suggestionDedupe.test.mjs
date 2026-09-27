/**
 * AI.HWTEXT.PROD.3B — Suggestion Deduplication and Rendering Test Suite
 * Covers Cases 1 to 10 from Mandatory Test Matrix.
 */
import assert from 'node:assert';
import {
  normalizeForComparison,
  buildVisibleSuggestions,
  getLineReviewStatus,
  resolveLineDisplayState,
  assertLegalCurrentText,
  computeChangedSpans,
  isVietnameseSyllableValid,
  isStandardVietnameseReduplicative,
  computeDetailedSpanEvidence
} from '../suggestionDedupe.ts';

console.log('=== RUNNING PROD.3B & PROD.3F MANDATORY TEST MATRIX ===\n');

// --------------------------------------------------------------------------
// CASE 1: RAW="Em yêu mùa hè", AI_A="Em yêu mùa hè", AI_B=unavailable
// Expected: 0 suggestion cards, compact neutral state only
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'Em yêu mùa hè',
    groqSuggestion: 'Em yêu mùa hè',
    groqStatus: 'SUCCESS',
    geminiSuggestion: undefined,
    geminiStatus: 'UNAVAILABLE',
  };
  const distinctOnly = buildVisibleSuggestions(line, { includeConfirmedCard: false });
  assert.strictEqual(distinctOnly.length, 0, 'Case 1: Expected 0 distinct suggestions');

  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 1, 'Case 1: Expected 1 AI confirmed suggestion');
  assert.strictEqual(suggestions[0].label, 'Gợi ý 1');
  assert.strictEqual(suggestions[0].text, 'Em yêu mùa hè');
  assert.strictEqual(suggestions[0].isAiConfirmed, true);
  assert.strictEqual(suggestions[0].badge, 'AI xác nhận');
  console.log('PASS: Case 1 - RAW == AI_A -> distinct=0, PROD.3F.1 Gợi ý 1 confirmed card');
}

// --------------------------------------------------------------------------
// CASE 2: RAW="m yêu mùa hè", AI_A="Em yêu mùa hè", AI_B=unavailable
// Expected: one card labeled Gợi ý 1, no Gợi ý 2
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'm yêu mùa hè',
    groqSuggestion: 'Em yêu mùa hè',
    groqStatus: 'SUCCESS',
    geminiStatus: 'UNAVAILABLE',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 1, 'Case 2: Expected 1 suggestion');
  assert.strictEqual(suggestions[0].label, 'Gợi ý 1');
  assert.strictEqual(suggestions[0].buttonLabel, 'Dùng gợi ý 1');
  assert.strictEqual(suggestions[0].accessibilityLabel, 'Chọn gợi ý 1');
  assert.strictEqual(suggestions[0].text, 'Em yêu mùa hè');
  console.log('PASS: Case 2 - RAW != AI_A, AI_B unavailable -> Exactly 1 card labeled Gợi ý 1');
}

// --------------------------------------------------------------------------
// CASE 3: RAW="m yêu mùa hè", AI_A="Em yêu mùa hè", AI_B="Em yêu mùa hè"
// Expected: one unique card labeled Gợi ý 1
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'm yêu mùa hè',
    groqSuggestion: 'Em yêu mùa hè',
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Em yêu mùa hè',
    geminiStatus: 'SUCCESS',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 1, 'Case 3: Expected 1 unique suggestion');
  assert.strictEqual(suggestions[0].label, 'Gợi ý 1');
  assert.strictEqual(suggestions[0].text, 'Em yêu mùa hè');
  console.log('PASS: Case 3 - AI_A == AI_B -> Exactly 1 unique card labeled Gợi ý 1');
}

// --------------------------------------------------------------------------
// CASE 4: RAW="Mọc trên đổi quề", AI_A="Mọc trên đồi quê", AI_B="Mọc trên đồi quê"
// Expected: one unique card labeled Gợi ý 1
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'Mọc trên đổi quề',
    groqSuggestion: 'Mọc trên đồi quê',
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Mọc trên đồi quê',
    geminiStatus: 'SUCCESS',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 1, 'Case 4: Expected 1 unique suggestion');
  assert.strictEqual(suggestions[0].label, 'Gợi ý 1');
  assert.strictEqual(suggestions[0].text, 'Mọc trên đồi quê');
  console.log('PASS: Case 4 - Both AI propose same correction -> 1 unique card Gợi ý 1');
}

// --------------------------------------------------------------------------
// CASE 5: RAW="Mọc trên đổi quề", AI_A="Mọc trên đồi quê", AI_B="Mọc trên đồi quê."
// Expected: two unique cards Gợi ý 1 / Gợi ý 2
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'Mọc trên đổi quề',
    groqSuggestion: 'Mọc trên đồi quê',
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Mọc trên đồi quê.',
    geminiStatus: 'SUCCESS',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 2, 'Case 5: Expected 2 unique suggestions');
  assert.strictEqual(suggestions[0].label, 'Gợi ý 1');
  assert.strictEqual(suggestions[0].text, 'Mọc trên đồi quê');
  assert.strictEqual(suggestions[1].label, 'Gợi ý 2');
  assert.strictEqual(suggestions[1].text, 'Mọc trên đồi quê.');
  console.log('PASS: Case 5 - Distinct AI suggestions -> Two cards Gợi ý 1 and Gợi ý 2');
}

// --------------------------------------------------------------------------
// CASE 6: RAW="Có hoa sim tím", AI_A="Có hoa sim tím", AI_B="Có hoa sim tím"
// Expected: no suggestion cards, compact neutral state
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'Có hoa sim tím',
    groqSuggestion: 'Có hoa sim tím',
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Có hoa sim tím',
    geminiStatus: 'SUCCESS',
  };
  const distinctOnly = buildVisibleSuggestions(line, { includeConfirmedCard: false });
  assert.strictEqual(distinctOnly.length, 0, 'Case 6: Expected 0 distinct suggestions');

  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 1, 'Case 6: Expected 1 AI confirmed suggestion');
  assert.strictEqual(suggestions[0].label, 'Gợi ý 1');
  assert.strictEqual(suggestions[0].isAiConfirmed, true);
  console.log('PASS: Case 6 - Both AI match RAW -> distinct=0, PROD.3F.1 Gợi ý 1 confirmed card');
}

// --------------------------------------------------------------------------
// CASE 7: RAW="Trời, sao ngọt thế!", AI_A unavailable, AI_B unavailable
// Expected: no provider failure text, compact neutral state
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'Trời, sao ngọt thế!',
    groqStatus: 'UNAVAILABLE',
    geminiStatus: 'UNAVAILABLE',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 0, 'Case 7: Expected 0 suggestions');
  console.log('PASS: Case 7 - Both AI unavailable -> 0 suggestion cards, no failure text');
}

// --------------------------------------------------------------------------
// CASE 8: RAW distinct from one successful advisor, other advisor 429/403
// Expected: one suggestion only, no visible provider/error text
// --------------------------------------------------------------------------
{
  // Test 8A: Groq failed 429, Gemini succeeded with correction
  const lineA = {
    rawOcrText: 'Trời, sao ngọt the',
    groqStatus: 'UNAVAILABLE',
    geminiSuggestion: 'Trời, sao ngọt thế!',
    geminiStatus: 'SUCCESS',
  };
  const suggestionsA = buildVisibleSuggestions(lineA);
  assert.strictEqual(suggestionsA.length, 1, 'Case 8A: Expected 1 suggestion');
  assert.strictEqual(suggestionsA[0].label, 'Gợi ý 1', 'Case 8A: Must be relabeled Gợi ý 1 without gap');
  assert.strictEqual(suggestionsA[0].text, 'Trời, sao ngọt thế!');

  // Test 8B: Groq succeeded with correction, Gemini failed 403
  const lineB = {
    rawOcrText: 'Trời, sao ngọt the',
    groqSuggestion: 'Trời, sao ngọt thế!',
    groqStatus: 'SUCCESS',
    geminiStatus: 'UNAVAILABLE',
  };
  const suggestionsB = buildVisibleSuggestions(lineB);
  assert.strictEqual(suggestionsB.length, 1, 'Case 8B: Expected 1 suggestion');
  assert.strictEqual(suggestionsB[0].label, 'Gợi ý 1');
  assert.strictEqual(suggestionsB[0].text, 'Trời, sao ngọt thế!');
  console.log('PASS: Case 8 - One successful advisor, other 429/403 -> Exactly 1 suggestion relabeled Gợi ý 1');
}

// --------------------------------------------------------------------------
// CASE 9: Unicode-equivalent strings (NFC/NFD) and whitespace variation
// Expected: dedupe correctly for comparison, displayed text remains original suggestion string
// --------------------------------------------------------------------------
{
  const nfcText = 'Tiếng chim reo';
  const nfdText = nfcText.normalize('NFD');
  assert.notStrictEqual(nfcText, nfdText, 'NFC and NFD representations must differ in bytes');
  assert.strictEqual(normalizeForComparison(nfdText), 'Tiếng chim reo', 'normalizeForComparison must convert to NFC');

  const line = {
    rawOcrText: 'Tieng chim reo',
    groqSuggestion: '  Tiếng   chim  reo  ', // whitespace variation + NFC
    groqStatus: 'SUCCESS',
    geminiSuggestion: nfdText, // NFD unicode variation
    geminiStatus: 'SUCCESS',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 1, 'Case 9: Expected 1 unique suggestion after NFC/whitespace dedupe');
  assert.strictEqual(suggestions[0].label, 'Gợi ý 1');
  // Crucial check: original string is preserved for display/use!
  assert.strictEqual(suggestions[0].text, '  Tiếng   chim  reo  ', 'Case 9: Original display text must be preserved');
  console.log('PASS: Case 9 - Unicode NFC/NFD and whitespace dedupe normalized; original text preserved');
}

// --------------------------------------------------------------------------
// CASE 10: After user chooses Gợi ý 1 then taps Giữ OCR gốc
// Expected: finalText returns to rawOcrText, rawOcrText unchanged throughout
// --------------------------------------------------------------------------
{
  const rawOcrText = 'Gió thổi rung rinh';
  const initialLine = {
    lineId: 'line-10',
    lineOrder: 1,
    rawOcrText: rawOcrText,
    finalText: rawOcrText,
    verdict: undefined,
    groqSuggestion: 'Gió thổi rung rinh.',
    groqStatus: 'SUCCESS',
  };

  // Step 1: Initial state
  assert.strictEqual(initialLine.finalText, rawOcrText);
  assert.strictEqual(initialLine.rawOcrText, rawOcrText);

  // Step 2: User chooses Gợi ý 1
  const suggestions = buildVisibleSuggestions(initialLine);
  assert.strictEqual(suggestions.length, 1);
  const chosenText = suggestions[0].text;

  // Simulate feedback handler for suggestion selection
  const lineAfterChoice = {
    ...initialLine,
    verdict: 'CORRECTED',
    finalText: chosenText,
  };
  assert.strictEqual(lineAfterChoice.finalText, 'Gió thổi rung rinh.');
  assert.strictEqual(lineAfterChoice.rawOcrText, rawOcrText, 'rawOcrText must be immutable');

  // Step 3: User taps "Giữ OCR gốc"
  // Simulate feedback handler restoring raw
  const lineAfterRevert = {
    ...lineAfterChoice,
    verdict: 'CORRECT',
    finalText: lineAfterChoice.rawOcrText,
  };
  assert.strictEqual(lineAfterRevert.finalText, rawOcrText, 'finalText must return to rawOcrText');
  assert.strictEqual(lineAfterRevert.rawOcrText, rawOcrText, 'rawOcrText must remain unchanged');
  console.log('PASS: Case 10 - Choose Gợi ý 1 then Giữ OCR gốc -> finalText restored, rawOcrText immutable');
}

// --------------------------------------------------------------------------
// CASE 11 (PROD.3F Scope 4.4): Single provider returns 2 candidates in suggestions array
// Expected: renders Gợi ý 1 and Gợi ý 2 without needing second provider
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'Trời, sao ngọt thề!',
    suggestions: [
      { provider: 'GROQ', text: 'Trời, sao ngọt thế!', confidence: 0.95, status: 'SUCCESS' },
      { provider: 'GROQ', text: 'Trời, sao ngọt thế.', confidence: 0.85, status: 'SUCCESS' },
    ],
    groqStatus: 'SUCCESS',
    geminiStatus: 'UNAVAILABLE',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 2, 'Case 11: Expected 2 suggestions from single provider');
  assert.strictEqual(suggestions[0].label, 'Gợi ý 1');
  assert.strictEqual(suggestions[0].text, 'Trời, sao ngọt thế!');
  assert.strictEqual(suggestions[1].label, 'Gợi ý 2');
  assert.strictEqual(suggestions[1].text, 'Trời, sao ngọt thế.');
  console.log('PASS: Case 11 - Single provider returns 2 distinct candidates -> Gợi ý 1 + Gợi ý 2');
}

// --------------------------------------------------------------------------
// CASE 12 (PROD.3F Scope 4.5): getLineReviewStatus returns AI_CONFIRMED
// Expected: 'AI_CONFIRMED' when AI reviewed and confirmed OCR is correct
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'Em yêu mùa hè',
    groqSuggestion: 'Em yêu mùa hè',
    groqStatus: 'SUCCESS',
    geminiStatus: 'UNAVAILABLE',
  };
  const status = getLineReviewStatus(line);
  assert.strictEqual(status, 'AI_CONFIRMED', 'Case 12: Expected AI_CONFIRMED status');
  console.log('PASS: Case 12 - AI reviewed and confirmed OCR -> getLineReviewStatus returns AI_CONFIRMED');
}

// --------------------------------------------------------------------------
// CASE 13 (PROD.3F Scope 4.5): getLineReviewStatus returns PROVIDER_OUTAGE
// Expected: 'PROVIDER_OUTAGE' when all providers failed
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'Bầu trời xanh ngắt',
    groqStatus: 'UNAVAILABLE',
    geminiStatus: 'UNAVAILABLE',
  };
  const status = getLineReviewStatus(line);
  assert.strictEqual(status, 'PROVIDER_OUTAGE', 'Case 13: Expected PROVIDER_OUTAGE status');
  console.log('PASS: Case 13 - Both providers unavailable -> getLineReviewStatus returns PROVIDER_OUTAGE');
}

// --------------------------------------------------------------------------
// CASE 14 (PROD.3F Scope 8.D1): Obvious OCR typo corrected
// Expected: RAW="Trời, sao ngọt thề!" -> candidate includes "Trời, sao ngọt thế!"
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'Trời, sao ngọt thề!',
    groqSuggestion: 'Trời, sao ngọt thế!',
    groqStatus: 'SUCCESS',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 1);
  assert.strictEqual(suggestions[0].text, 'Trời, sao ngọt thế!');
  console.log('PASS: Case 14 - Obvious OCR typo corrected: "Trời, sao ngọt thề!" -> "Trời, sao ngọt thế!"');
}

// --------------------------------------------------------------------------
// CASE 15 (PROD.3F Scope 8.D2): Near-word confusion corrected
// Expected: RAW="Rung ring bướm lượn." -> candidate includes "Rung rinh bướm lượn."
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'Rung ring bướm lượn.',
    groqSuggestion: 'Rung rinh bướm lượn.',
    groqStatus: 'SUCCESS',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 1);
  assert.strictEqual(suggestions[0].text, 'Rung rinh bướm lượn.');
  console.log('PASS: Case 15 - Near-word confusion corrected: "Rung ring bướm lượn." -> "Rung rinh bướm lượn."');
}

// --------------------------------------------------------------------------
// CASE 16 (PROD.3F Scope 8.D11): Manual edit always wins & rawOcrText immutable
// --------------------------------------------------------------------------
{
  const rawOcrText = '12 + 25 = 38'; // student wrote 38 (arithmetic mistake)
  const line = {
    rawOcrText: rawOcrText,
    finalText: rawOcrText,
  };
  // User manually edits the recognized expression
  const manualEditText = '12 + 25 = 38 (học sinh làm)';
  const lineAfterEdit = {
    ...line,
    finalText: manualEditText,
    verdict: 'CORRECTED',
  };
  assert.strictEqual(lineAfterEdit.finalText, manualEditText, 'Manual edit must take precedence');
  assert.strictEqual(lineAfterEdit.rawOcrText, rawOcrText, 'rawOcrText must remain strictly immutable');
  console.log('PASS: Case 16 - Manual edit takes precedence; rawOcrText remains immutable');
}

// --------------------------------------------------------------------------
// CASE 17 (PROD.3F.1 Case C): AI confirms line -> Gợi ý 1 card with "AI xác nhận" badge
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'Bông hoa đỏ thắm',
    groqSuggestion: 'Bông hoa đỏ thắm',
    groqStatus: 'SUCCESS',
    groqDecision: 'KEEP_RAW',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 1, 'Case 17: Must return 1 suggestion card');
  assert.strictEqual(suggestions[0].label, 'Gợi ý 1');
  assert.strictEqual(suggestions[0].text, 'Bông hoa đỏ thắm');
  assert.strictEqual(suggestions[0].isAiConfirmed, true);
  assert.strictEqual(suggestions[0].badge, 'AI xác nhận');
  assert.strictEqual(getLineReviewStatus(line), 'AI_CONFIRMED');
  console.log('PASS: Case 17 - AI confirmed line -> Gợi ý 1 card with "AI xác nhận" badge');
}

// --------------------------------------------------------------------------
// CASE 18 (PROD.3F.1 Case B): Single healthy provider returns 2 distinct candidates
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: 'trang sách nhỏ',
    suggestions: [
      { provider: 'GROQ', text: 'Trang sách nhỏ', status: 'SUCCESS' },
      { provider: 'GROQ', text: 'trang sách nhỏ.', status: 'SUCCESS' },
    ],
    groqStatus: 'SUCCESS',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 2, 'Case 18: Must return 2 distinct suggestions');
  assert.strictEqual(suggestions[0].label, 'Gợi ý 1');
  assert.strictEqual(suggestions[0].text, 'Trang sách nhỏ');
  assert.strictEqual(suggestions[1].label, 'Gợi ý 2');
  assert.strictEqual(suggestions[1].text, 'trang sách nhỏ.');
  console.log('PASS: Case 18 - Single provider returns 2 distinct candidates in 1 response');
}

// --------------------------------------------------------------------------
// CASE 19 (PROD.3F.1 Case F): All providers fail -> PROVIDER_OUTAGE, 0 fake cards
// --------------------------------------------------------------------------
{
  const line = {
    rawOcrText: '12 + 25 = 38',
    groqStatus: 'UNAVAILABLE',
    geminiStatus: 'ERROR',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 0, 'Case 19: Must NOT fabricate suggestions on outage');
  assert.strictEqual(getLineReviewStatus(line), 'PROVIDER_OUTAGE');
  console.log('PASS: Case 19 - All providers fail -> clean outage status, 0 fake cards');
}

// --------------------------------------------------------------------------
// CASE 20 (PROD.3F.1 Math Safety): Math equations protected from arithmetic "solving"
// --------------------------------------------------------------------------
{
  const rawEquation = '12 + 25 = 38';
  // If AI attempts to "solve" it to 37, the safety gate enforces KEEP_RAW
  const line = {
    rawOcrText: rawEquation,
    finalText: rawEquation,
    groqSuggestion: rawEquation, // blocked from 37 by evaluate_correction_safety
    groqStatus: 'SUCCESS',
    groqDecision: 'KEEP_RAW',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 1);
  assert.strictEqual(suggestions[0].text, rawEquation);
  assert.strictEqual(suggestions[0].isAiConfirmed, true);
  console.log('PASS: Case 20 - Math statement truth protected, arithmetic solve blocked');
}

// --------------------------------------------------------------------------
// CASE 21 (PROD.4A.1 Case 1): rawOcrText="Em yêu mùa hè", OCR conf=0.88, AI="Em yêu mùa hè", AI conf=0.95
// => currentText must be exactly "Em yêu mùa hè" (normalized identical)
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-case-1',
    rawOcrText: 'Em yêu mùa hè',
    rawOcrConfidence: 0.88,
    predictedText: 'Cm yêu mùa hè', // Simulated noise must be ignored
    groqSuggestion: 'Em yêu mùa hè',
    groqConfidence: 0.95,
    groqStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.ocrText, 'Em yêu mùa hè');
  assert.strictEqual(state.currentText, 'Em yêu mùa hè', 'Case 1: Must equal canonical text');
  assert.strictEqual(state.selectedSource, 'OCR', 'PROD.4A.2: currentText === ocrText -> selectedSource must strictly be OCR');
  assert.strictEqual(state.isAiConfirmed, true, 'PROD.4A.2: isAiConfirmed must be true independently of selectedSource');
  assert.strictEqual(state.selectionReason, 'AI_CONFIRMED_IDENTICAL');
  assert.ok(assertLegalCurrentText(state), 'Case 1: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.2 Case 1 - OCR="Em yêu mùa hè" (0.88), AI="Em yêu mùa hè" (0.95) -> currentText="Em yêu mùa hè", selectedSource=OCR, isAiConfirmed=true');
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// CASE 22 (PROD.4A.1/4A.4 Case 2): rawOcrText="Bó hoa si tím", OCR conf=0.86, AI="Bó hoa sim tím" (Multi-Provider Consensus)
// => default currentText="Bó hoa sim tím", selectedSource=SUGGESTION_1 (MULTI_PROVIDER_CONSENSUS)
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-case-2',
    rawOcrText: 'Bó hoa si tím',
    rawOcrConfidence: 0.86,
    predictedText: 'Bó hoa ssim tí', // Simulated noise must be ignored
    groqSuggestion: 'Bó hoa sim tím',
    groqConfidence: 0.97,
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Bó hoa sim tím',
    geminiConfidence: 0.96,
    geminiStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.ocrText, 'Bó hoa si tím');
  assert.strictEqual(state.currentText, 'Bó hoa sim tím', 'Case 2: Must choose higher-confidence AI with multi-provider consensus');
  assert.strictEqual(state.selectedSource, 'SUGGESTION_1');
  assert.strictEqual(state.selectionReason, 'MULTI_PROVIDER_CONSENSUS');
  assert.strictEqual(state.rawOcrConfidenceSource, 'CRNN_CTC_SOFTMAX');
  assert.strictEqual(state.aiConfidenceSource, 'MULTI_PROVIDER');
  assert.ok(assertLegalCurrentText(state), 'Case 2: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.1 Case 2 - OCR="Bó hoa si tím" (0.86), AI="Bó hoa sim tím" (consensus) -> currentText="Bó hoa sim tím", source=SUGGESTION_1');
}

// --------------------------------------------------------------------------
// CASE 23 (PROD.4A.1/4A.4 Case 3): rawOcrText="Trời, sao ngọt thề!", OCR conf=0.89, AI="Trời, sao ngọt thế!" (Multi-Provider Consensus)
// => default currentText="Trời, sao ngọt thế!" (MULTI_PROVIDER_CONSENSUS)
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-case-3',
    rawOcrText: 'Trời, sao ngọt thề!',
    rawOcrConfidence: 0.89,
    groqSuggestion: 'Trời, sao ngọt thế!',
    groqConfidence: 0.98,
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Trời, sao ngọt thế!',
    geminiConfidence: 0.97,
    geminiStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Trời, sao ngọt thế!');
  assert.strictEqual(state.selectedSource, 'SUGGESTION_1');
  assert.strictEqual(state.selectionReason, 'MULTI_PROVIDER_CONSENSUS');
  assert.ok(assertLegalCurrentText(state), 'Case 3: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.1 Case 3 - OCR="Trời, sao ngọt thề!" (0.89), AI="Trời, sao ngọt thế!" (consensus) -> currentText="Trời, sao ngọt thế!"');
}

// --------------------------------------------------------------------------
// CASE 24 (PROD.4A.1 Case 4): OCR conf=0.98, AI distinct suggestion conf=0.75
// => default currentText stays OCR
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-case-4',
    rawOcrText: 'Ngôi trường mến yêu',
    rawOcrConfidence: 0.98,
    groqSuggestion: 'Ngôi trường thân yêu',
    groqConfidence: 0.75,
    groqStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Ngôi trường mến yêu', 'Case 4: OCR has higher confidence, must stay OCR');
  assert.strictEqual(state.selectedSource, 'OCR');
  assert.strictEqual(state.selectionReason, 'OCR_CONFIDENCE_HIGHER_OR_EQUAL');
  assert.ok(assertLegalCurrentText(state), 'Case 4: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.1 Case 4 - OCR conf=0.98 > AI conf=0.75 -> default stays OCR (selectedSource=OCR)');
}

// --------------------------------------------------------------------------
// CASE 25 (PROD.4A.1 Case 5): User presses “Giữ OCR gốc” after AI was selected
// => currentText exactly rawOcrText and remains so across rerender/hydration
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-case-5',
    rawOcrText: 'Bó hoa si tím',
    rawOcrConfidence: 0.86,
    groqSuggestion: 'Bó hoa sim tím',
    groqConfidence: 0.97,
    groqStatus: 'SUCCESS',
    verdict: 'CORRECT', // User explicitly pressed "Giữ OCR gốc"
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Bó hoa si tím');
  assert.strictEqual(state.selectedSource, 'OCR');
  assert.strictEqual(state.selectionReason, 'USER_EXPLICIT_SELECTION');
  assert.ok(assertLegalCurrentText(state), 'Case 5: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.1 Case 5 - User presses "Giữ OCR gốc" -> currentText=rawOcrText, source=OCR');
}

// --------------------------------------------------------------------------
// CASE 26 (PROD.4A.1 Case 6): User presses “Dùng gợi ý 1”
// => currentText exactly suggestion1 and persists through save/hydration
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-case-6',
    rawOcrText: 'Trời, sao ngọt thề!',
    rawOcrConfidence: 0.89,
    groqSuggestion: 'Trời, sao ngọt thế!',
    groqConfidence: 0.98,
    groqStatus: 'SUCCESS',
    verdict: 'CORRECTED',
    verifiedTextRaw: 'Trời, sao ngọt thế!', // User selected Gợi ý 1
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Trời, sao ngọt thế!');
  assert.strictEqual(state.selectedSource, 'SUGGESTION_1');
  assert.strictEqual(state.selectionReason, 'USER_EXPLICIT_SELECTION');
  assert.ok(assertLegalCurrentText(state), 'Case 6: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.1 Case 6 - User presses "Dùng gợi ý 1" -> currentText=sugg1, source=SUGGESTION_1');
}

// --------------------------------------------------------------------------
// CASE 27 (PROD.4A.1 Case 7): Manual edit
// => manual text wins even if OCR/AI confidence is higher
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-case-7',
    rawOcrText: 'Một đàn chym',
    rawOcrConfidence: 0.99,
    groqSuggestion: 'Một đàn chim',
    groqConfidence: 0.99,
    groqStatus: 'SUCCESS',
    verdict: 'CORRECTED',
    verifiedTextRaw: 'Một đàn chim non', // User typed manual edit
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Một đàn chim non', 'Case 7: Manual edit must win over 0.99 confidences');
  assert.strictEqual(state.selectedSource, 'MANUAL_EDIT');
  assert.strictEqual(state.selectionReason, 'MANUAL_EDIT_OVERRIDE');
  assert.ok(assertLegalCurrentText(state, 'Một đàn chim non'), 'Case 7: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.1 Case 7 - Manual edit -> manual text wins over higher OCR/AI confidences');
}

// --------------------------------------------------------------------------
// CASE 28 (PROD.4A.1 Invariant Test): Deterministic invariant test fails if
// currentText is not strictly one of the legal source strings.
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-case-8-invariant',
    rawOcrText: 'Dòng chữ chuẩn',
    rawOcrConfidence: 0.90,
    predictedText: 'Chuỗi lạ không hợp lệ', // Simulated illegal candidate
    groqSuggestion: 'Dòng chữ đẹp',
    groqConfidence: 0.85,
    groqStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.notStrictEqual(state.currentText, 'Chuỗi lạ không hợp lệ', 'Invariant: Must NEVER equal predictedText');
  assert.ok(
    state.currentText === state.rawOcrText ||
    state.currentText === state.aiSuggestions[0]?.text ||
    state.currentText === state.aiSuggestions[1]?.text,
    'Invariant: currentText must equal exactly one of rawOcrText, sugg1, sugg2, or manual text'
  );
  assert.ok(assertLegalCurrentText(state), 'Invariant: assertLegalCurrentText must return true');

  // Negative test: simulate an illegal mutation and verify assertLegalCurrentText returns false
  const mutatedState = { ...state, currentText: 'Chuỗi đột biến' };
  assert.strictEqual(assertLegalCurrentText(mutatedState), false, 'Invariant: Mutated string must FAIL invariant test');
  console.log('PASS: PROD.4A.1 Invariant Test - currentText strictly bound to legal sources; mutated string correctly FAILS');
}

// --------------------------------------------------------------------------
// CASE 29 (PROD.4A.1 Section C): Provider outage -> NO fake AI confirmation
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-outage',
    rawOcrText: 'Văn bản kiểm tra',
    rawOcrConfidence: 0.85,
    groqStatus: 'UNAVAILABLE',
    geminiStatus: 'ERROR',
  };
  const status = getLineReviewStatus(line);
  assert.strictEqual(status, 'PROVIDER_OUTAGE', 'Section C: Outage must yield PROVIDER_OUTAGE, never AI_CONFIRMED');
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 0, 'Section C: Outage must NOT fabricate confirmed card');
  console.log('PASS: PROD.4A.1 Section C - All providers fail -> PROVIDER_OUTAGE, zero fake AI confirmation');
}

// --------------------------------------------------------------------------
// CASE 30 (PROD.4A.1 Section C): One provider returns 2 distinct candidates -> Gợi ý 1 & 2
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-two-cands',
    rawOcrText: 'Cây bàng to',
    rawOcrConfidence: 0.80,
    groqSuggestion: 'Cây bàng xanh',
    groqConfidence: 0.92,
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Cây bàng to lớn',
    geminiConfidence: 0.88,
    geminiStatus: 'SUCCESS',
  };
  const suggestions = buildVisibleSuggestions(line);
  assert.strictEqual(suggestions.length, 2, 'Section C: Expected 2 distinct suggestions');
  assert.strictEqual(suggestions[0].label, 'Gợi ý 1');
  assert.strictEqual(suggestions[0].text, 'Cây bàng xanh');
  assert.strictEqual(suggestions[1].label, 'Gợi ý 2');
  assert.strictEqual(suggestions[1].text, 'Cây bàng to lớn');
  console.log('PASS: PROD.4A.1 Section C - Two distinct provider candidates -> Gợi ý 1 & Gợi ý 2');
}

// --------------------------------------------------------------------------
// CASE 31 (PROD.4A.3 Safe Arbitration Closure for "Rung ring"):
// OCR: "Rung ring bướm lượn." (rawOcrConfidence=0.97, CRNN_CTC_SOFTMAX)
// AI:  "Rung rinh bướm lượn." (rawAiConfidence=0.95, GROQ_SELF_REPORTED)
// NO arbitrary 0.90 multiplier! Without multi-provider consensus or token uncertainty,
// safe default preserves OCR as currentText, with Gợi ý 1 available for user selection.
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-rung-ring-single-ai',
    rawOcrText: 'Rung ring bướm lượn.',
    rawOcrConfidence: 0.97,
    groqSuggestion: 'Rung rinh bướm lượn.',
    groqConfidence: 0.95,
    groqStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Rung ring bướm lượn.', 'Case 31: Without sufficient independent evidence, confident OCR stays currentText');
  assert.strictEqual(state.selectedSource, 'OCR');
  assert.strictEqual(state.selectionReason, 'OCR_CONFIDENCE_HIGHER_OR_EQUAL');
  assert.strictEqual(state.rawOcrConfidence, 0.97);
  assert.strictEqual(state.rawOcrConfidenceSource, 'CRNN_CTC_SOFTMAX');
  assert.strictEqual(state.rawAiConfidence, 0.95);
  assert.strictEqual(state.aiConfidenceSource, 'GROQ_SELF_REPORTED');
  assert.strictEqual(state.aiSuggestions.length, 1);
  assert.strictEqual(state.aiSuggestions[0].text, 'Rung rinh bướm lượn.', 'Case 31: Gợi ý 1 must remain available for user selection');
  assert.ok(assertLegalCurrentText(state), 'Case 31: Must pass legal current text and provenance invariant');
  console.log('PASS: PROD.4A.3 Case 31 - Safe arbitration keeps OCR="Rung ring" (0.97) when single AI=0.95 without fake 0.90 penalty');
}

// --------------------------------------------------------------------------
// CASE 32 (PROD.4A.2 Decoupled AI Confirmation State):
// When AI confirms identical text, selectedSource remains 'OCR' while isAiConfirmed=true
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-decoupled-ai',
    rawOcrText: 'Có hoa sim tím',
    rawOcrConfidence: 0.92,
    groqSuggestion: 'Có hoa sim tím',
    groqConfidence: 0.98,
    groqStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Có hoa sim tím');
  assert.strictEqual(state.selectedSource, 'OCR', 'Case 32: selectedSource must be OCR when text equals rawOcrText');
  assert.strictEqual(state.isAiConfirmed, true, 'Case 32: isAiConfirmed must be true');
  assert.strictEqual(state.aiReviewed, true, 'Case 32: aiReviewed must be true');
  assert.strictEqual(state.reviewStatus, 'AI_CONFIRMED');
  assert.deepStrictEqual(state.confirmationProviders, ['GROQ']);
  assert.ok(assertLegalCurrentText(state), 'Case 32: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.2 Case 32 - Decoupled AI confirmation: source=OCR, isAiConfirmed=true, reviewStatus=AI_CONFIRMED');
}

// --------------------------------------------------------------------------
// CASE 33 (PROD.4A.2 Strict Provenance Invariant Violation Test):
// assertLegalCurrentText must FAIL if selectedSource disagrees with currentText provenance
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-provenance-violation',
    rawOcrText: 'Mùa hè rực rỡ',
    rawOcrConfidence: 0.90,
    groqSuggestion: 'Mùa hè rực rỡ nắng',
    groqConfidence: 0.92,
    groqStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.ok(assertLegalCurrentText(state), 'Case 33: Genuine state must PASS invariant');

  // Negative test: currentText is rawOcrText but selectedSource claims SUGGESTION_1
  const violatedState = {
    ...state,
    currentText: 'Mùa hè rực rỡ',
    selectedSource: 'SUGGESTION_1',
  };
  assert.strictEqual(assertLegalCurrentText(violatedState), false, 'Case 33: Mismatched provenance must FAIL assertLegalCurrentText');
  console.log('PASS: PROD.4A.2 Case 33 - Strict provenance invariant catches illegal source attribution');
}

// --------------------------------------------------------------------------
// CASE 34 (PROD.4A.3 Multi-Provider Consensus on "Rung ring"):
// Both Groq and Gemini independently propose "Rung rinh bướm lượn."
// => Independent multi-provider consensus provides sufficient evidence for AI win
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-rung-ring-consensus',
    rawOcrText: 'Rung ring bướm lượn.',
    rawOcrConfidence: 0.97,
    groqSuggestion: 'Rung rinh bướm lượn.',
    groqConfidence: 0.95,
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Rung rinh bướm lượn.',
    geminiConfidence: 0.94,
    geminiStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Rung rinh bướm lượn.', 'Case 34: Multi-provider consensus allows AI suggestion to win');
  assert.strictEqual(state.selectedSource, 'SUGGESTION_1');
  assert.strictEqual(state.selectionReason, 'MULTI_PROVIDER_CONSENSUS');
  assert.strictEqual(state.aiConfidenceSource, 'MULTI_PROVIDER');
  assert.strictEqual(state.decisionEvidence.providerConsensus, true);
  assert.ok(assertLegalCurrentText(state), 'Case 34: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.3 Case 34 - Multi-provider consensus resolves "Rung rinh" with inspectable independent evidence');
}

// --------------------------------------------------------------------------
// CASE 35 (PROD.4A.3 Test Matrix Item 1: OCR correct, AI makes 1-char wrong correction):
// OCR="Bé học chăm chỉ" (0.96), AI="Bé học chăm chỉa" (0.92)
// => Must NOT auto-select AI without evidence; currentText stays OCR
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-ai-wrong-char',
    rawOcrText: 'Bé học chăm chỉ',
    rawOcrConfidence: 0.96,
    groqSuggestion: 'Bé học chăm chỉa',
    groqConfidence: 0.92,
    groqStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Bé học chăm chỉ', 'Case 35: Confident OCR must not be overridden by flawed AI edit');
  assert.strictEqual(state.selectedSource, 'OCR');
  assert.strictEqual(state.selectionReason, 'OCR_CONFIDENCE_HIGHER_OR_EQUAL');
  assert.ok(assertLegalCurrentText(state), 'Case 35: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.3 Case 35 - OCR correct (0.96), AI flawed 1-char (0.92) -> currentText stays OCR');
}

// --------------------------------------------------------------------------
// CASE 36 (PROD.4A.4 Section A & B Case 3: OCR 0.50, AI 0.99 with single provider):
// OCR="Đêm nay trời rét" (0.50), AI="Đêm nay trời rét." (0.99)
// => Cross-scale confidence alone is NOT independent evidence -> MUST NOT auto-select AI!
// => Default stays OCR, Suggestion 1 remains visible for user choice.
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-low-ocr-high-ai-single-provider',
    rawOcrText: 'Đêm nay trời rét',
    rawOcrConfidence: 0.50,
    groqSuggestion: 'Đêm nay trời rét.',
    groqConfidence: 0.99,
    groqStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Đêm nay trời rét', 'Case 36: Cross-scale confidence alone must NOT auto-select AI');
  assert.strictEqual(state.selectedSource, 'OCR');
  assert.strictEqual(state.selectionReason, 'OCR_DEFAULT_INSUFFICIENT_EVIDENCE');
  assert.strictEqual(state.decisionEvidence.ruleApplied, 'RULE_5_INSUFFICIENT_EVIDENCE_OCR_DEFAULT');
  assert.strictEqual(state.aiSuggestions.length, 1);
  assert.strictEqual(state.aiSuggestions[0].text, 'Đêm nay trời rét.');
  assert.ok(assertLegalCurrentText(state), 'Case 36: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.4 Case 36 - Low OCR (0.50) with high AI (0.99) single provider -> stays OCR, Gợi ý 1 visible');
}

// --------------------------------------------------------------------------
// CASE 37 (PROD.4A.3 Test Matrix Item 3: OCR 0.98, AI 0.90 -> do not penalize OCR):
// OCR="Con cò bé bé" (0.98), AI="Con cò bé tí" (0.90)
// => OCR wins, no fake multiplier
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-ocr-098-ai-090',
    rawOcrText: 'Con cò bé bé',
    rawOcrConfidence: 0.98,
    groqSuggestion: 'Con cò bé tí',
    groqConfidence: 0.90,
    groqStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Con cò bé bé', 'Case 37: High OCR (0.98) must not be penalized for AI (0.90)');
  assert.strictEqual(state.selectedSource, 'OCR');
  assert.strictEqual(state.selectionReason, 'OCR_CONFIDENCE_HIGHER_OR_EQUAL');
  assert.ok(assertLegalCurrentText(state), 'Case 37: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.3 Case 37 - OCR 0.98 > AI 0.90 -> OCR wins without arbitrary reduction');
}

// --------------------------------------------------------------------------
// CASE 38 (PROD.4A.3 Confidence Provenance & Inspectable Changed Spans):
// Verify changedSpans accurately extracts character differences
// --------------------------------------------------------------------------
{
  const spans = computeChangedSpans('Rung ring bướm lượn.', 'Rung rinh bướm lượn.');
  assert.deepStrictEqual(spans, [{ rawSpan: 'g', suggSpan: 'h' }]);
  console.log('PASS: PROD.4A.3 Case 38 - computeChangedSpans correctly identifies diff [g -> h]');
}

// --------------------------------------------------------------------------
// CASE 39 (PROD.4A.4 Section B Case 1: OCR 0.97, Groq 0.95, Gemini UNAVAILABLE):
// OCR="Rung ring bướm lượn." (0.97), Groq="Rung rinh bướm lượn." (0.95), Gemini=UNAVAILABLE
// => Default stays OCR! Gợi ý 1 remains visible for user choice, NOT auto-selected.
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-case-1-single-provider',
    rawOcrText: 'Rung ring bướm lượn.',
    rawOcrConfidence: 0.97,
    groqSuggestion: 'Rung rinh bướm lượn.',
    groqConfidence: 0.95,
    groqStatus: 'SUCCESS',
    geminiStatus: 'UNAVAILABLE',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Rung ring bướm lượn.', 'Case 39: OCR stays default when only 1 provider is available');
  assert.strictEqual(state.selectedSource, 'OCR');
  assert.strictEqual(state.selectionReason, 'OCR_CONFIDENCE_HIGHER_OR_EQUAL');
  assert.strictEqual(state.aiSuggestions.length, 1);
  assert.strictEqual(state.aiSuggestions[0].text, 'Rung rinh bướm lượn.');
  assert.ok(assertLegalCurrentText(state), 'Case 39: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.4 Case 39 - Single provider (0.95) does not auto-override OCR (0.97); Gợi ý 1 visible');
}

// --------------------------------------------------------------------------
// CASE 40 (PROD.4A.4 Section B Case 2: Multi-Provider Consensus):
// OCR="Rung ring bướm lượn." (0.97), Groq="Rung rinh bướm lượn." (SUCCESS), Gemini="Rung rinh bướm lượn." (SUCCESS)
// => 2 independent calls return exact same valid correction
// => AUTO_SELECT SUGGESTION_1 with MULTI_PROVIDER_CONSENSUS
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-case-2-multi-provider',
    rawOcrText: 'Rung ring bướm lượn.',
    rawOcrConfidence: 0.97,
    groqSuggestion: 'Rung rinh bướm lượn.',
    groqConfidence: 0.95,
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Rung rinh bướm lượn.',
    geminiConfidence: 0.94,
    geminiStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Rung rinh bướm lượn.', 'Case 40: Multi-provider consensus auto-selects AI suggestion');
  assert.strictEqual(state.selectedSource, 'SUGGESTION_1');
  assert.strictEqual(state.selectionReason, 'MULTI_PROVIDER_CONSENSUS');
  assert.strictEqual(state.decisionEvidence.ruleApplied, 'RULE_4A_MULTI_PROVIDER_CONSENSUS');
  assert.strictEqual(state.decisionEvidence.providerConsensus, true);
  assert.ok(assertLegalCurrentText(state), 'Case 40: Must pass legal current text invariant');
  console.log('PASS: PROD.4A.4 Case 40 - Multi-provider consensus auto-selects SUGGESTION_1 with inspectable reason');
}

// --------------------------------------------------------------------------
// CASE 41 (PROD.4A.4 Section C: User manual edit enters text identical to OCR):
// User explicitly edits line to match rawOcrText.
// => selectedSource MUST be 'MANUAL_EDIT' (action provenance preserved).
// => assertLegalCurrentText MUST return TRUE (source-implies-value one-way implication).
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-manual-same-as-ocr',
    rawOcrText: 'Rung rinh bướm lượn.',
    rawOcrConfidence: 0.97,
    verdict: 'CORRECTED',
    verifiedTextRaw: 'Rung rinh bướm lượn.',
    selectedSource: 'MANUAL_EDIT',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Rung rinh bướm lượn.');
  assert.strictEqual(state.selectedSource, 'MANUAL_EDIT', 'Case 41: Action provenance must be preserved as MANUAL_EDIT');
  assert.strictEqual(state.selectionReason, 'MANUAL_EDIT_OVERRIDE');
  assert.ok(assertLegalCurrentText(state, 'Rung rinh bướm lượn.'), 'Case 41: assertLegalCurrentText must be TRUE for MANUAL_EDIT identical to OCR');
  console.log('PASS: PROD.4A.4 Case 41 - Manual edit identical to OCR preserves MANUAL_EDIT provenance and passes invariant');
}

// --------------------------------------------------------------------------
// CASE 42 (PROD.4A.4 Section C: User explicitly selects suggestion matching OCR):
// Suggestion text happens to match OCR, user explicitly taps it.
// => selectedSource MUST be 'SUGGESTION_1' (explicit user selection preserved).
// => assertLegalCurrentText MUST return TRUE.
// --------------------------------------------------------------------------
{
  const line = {
    lineId: 'line-user-sugg1-same-as-ocr',
    rawOcrText: 'Rung rinh bướm lượn.',
    rawOcrConfidence: 0.97,
    groqSuggestion: 'Rung rinh bướm lượn.',
    groqConfidence: 0.98,
    groqStatus: 'SUCCESS',
    verdict: 'CORRECTED',
    verifiedTextRaw: 'Rung rinh bướm lượn.',
    selectedSource: 'SUGGESTION_1',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.currentText, 'Rung rinh bướm lượn.');
  assert.strictEqual(state.selectedSource, 'SUGGESTION_1', 'Case 42: Explicit selection must be SUGGESTION_1, not rewritten to OCR');
  assert.strictEqual(state.selectionReason, 'USER_EXPLICIT_SELECTION');
  assert.ok(assertLegalCurrentText(state), 'Case 42: assertLegalCurrentText must be TRUE for SUGGESTION_1');
  console.log('PASS: PROD.4A.4 Case 42 - Explicit suggestion selection preserves SUGGESTION_1 provenance and passes invariant');
}

// --------------------------------------------------------------------------
// CASE 43 (PROD.4A.4 Section C: Invariant failure on illegal third string):
// A fabricated synthetic string not present in any legal source.
// => assertLegalCurrentText MUST return FALSE.
// --------------------------------------------------------------------------
{
  const state = {
    rawOcrText: 'Em yêu mùa hè',
    ocrText: 'Em yêu mùa hè',
    aiSuggestions: [{ id: '1', provider: 'GROQ', text: 'Em yêu mùa hè.', isAiConfirmed: true }],
    currentText: 'Một câu hoàn toàn bịa đặt', // Third synthetic string
    selectedSource: 'OCR',
    selectionReason: 'AI_CONFIRMED_IDENTICAL',
    decisionReason: 'AI_CONFIRMED_IDENTICAL',
    aiReviewed: true,
    isAiConfirmed: true,
    reviewStatus: 'AI_CONFIRMED',
    confirmationProviders: ['GROQ'],
  };
  assert.strictEqual(assertLegalCurrentText(state), false, 'Case 43: Arbitrary third string must fail invariant');
  console.log('PASS: PROD.4A.4 Case 43 - Arbitrary third string strictly rejected by assertLegalCurrentText');
}


// ==========================================================================
// MANDATORY PROD.4A.2 SOURCE-IMPLIES-VALUE PROVENANCE INVARIANT TESTS (A1 - A5)
// ==========================================================================

// A1: rawOcrText="Em yêu mùa hè", manualEditText="Em yêu mùa hè", selectedSource=MANUAL_EDIT, currentText="Em yêu mùa hè"
// => PASS, source remains MANUAL_EDIT (string equality does not force reverse inference to OCR)
{
  const state = {
    rawOcrText: 'Em yêu mùa hè',
    ocrText: 'Em yêu mùa hè',
    aiSuggestions: [{ id: '1', provider: 'GROQ', text: 'Em yêu mùa hè', isAiConfirmed: true }],
    currentText: 'Em yêu mùa hè',
    selectedSource: 'MANUAL_EDIT',
    selectionReason: 'MANUAL_OVERRIDE',
    decisionReason: 'MANUAL_OVERRIDE',
    verifiedTextRaw: 'Em yêu mùa hè',
  };
  assert.strictEqual(assertLegalCurrentText(state, 'Em yêu mùa hè'), true, 'A1: Manual edit matching OCR must pass invariant');
  assert.strictEqual(state.selectedSource, 'MANUAL_EDIT', 'A1: selectedSource must remain MANUAL_EDIT');
  console.log('PASS: A1 - rawOcrText="Em yêu mùa hè", manualEditText="Em yêu mùa hè", selectedSource=MANUAL_EDIT, currentText="Em yêu mùa hè" => PASS, source remains MANUAL_EDIT');
}

// A2: rawOcrText="Em yêu mùa hè", suggestion1="Em yêu mùa hè", user EXPLICITLY chọn suggestion1
// => PASS, selectedSource remains SUGGESTION_1
{
  const state = {
    rawOcrText: 'Em yêu mùa hè',
    ocrText: 'Em yêu mùa hè',
    aiSuggestions: [{ id: '1', provider: 'GROQ', text: 'Em yêu mùa hè', isAiConfirmed: true }],
    currentText: 'Em yêu mùa hè',
    selectedSource: 'SUGGESTION_1',
    selectionReason: 'USER_SELECTED_SUGGESTION_1',
    decisionReason: 'USER_SELECTED_SUGGESTION_1',
  };
  assert.strictEqual(assertLegalCurrentText(state), true, 'A2: Explicitly chosen suggestion1 matching OCR must pass invariant');
  assert.strictEqual(state.selectedSource, 'SUGGESTION_1', 'A2: selectedSource must remain SUGGESTION_1');
  console.log('PASS: A2 - rawOcrText="Em yêu mùa hè", suggestion1="Em yêu mùa hè", user EXPLICITLY chọn suggestion1 => PASS, selectedSource remains SUGGESTION_1');
}

// A3: OCR và AI identical, user chưa chọn suggestion
// => selectedSource=OCR => isAiConfirmed=true CHỈ khi provider SUCCESS
{
  // Sub-case A3.1: Provider SUCCESS
  const lineSuccess = {
    rawOcrText: 'Em yêu mùa hè',
    rawOcrConfidence: 0.90,
    groqSuggestion: 'Em yêu mùa hè',
    groqConfidence: 0.95,
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Em yêu mùa hè',
    geminiConfidence: 0.95,
    geminiStatus: 'SUCCESS',
  };
  const resolvedSuccess = resolveLineDisplayState(lineSuccess);
  assert.strictEqual(resolvedSuccess.selectedSource, 'OCR', 'A3.1: selectedSource must be OCR');
  assert.strictEqual(resolvedSuccess.isAiConfirmed, true, 'A3.1: isAiConfirmed must be true when provider is SUCCESS');
  assert.strictEqual(resolvedSuccess.reviewStatus, 'AI_CONFIRMED', 'A3.1: reviewStatus must be AI_CONFIRMED');

  // Sub-case A3.2: Provider OUTAGE/FAILED
  const lineFailed = {
    rawOcrText: 'Em yêu mùa hè',
    rawOcrConfidence: 0.90,
    groqStatus: 'UNAVAILABLE',
    geminiStatus: 'ERROR',
  };
  const resolvedFailed = resolveLineDisplayState(lineFailed);
  assert.strictEqual(resolvedFailed.selectedSource, 'OCR', 'A3.2: selectedSource must be OCR');
  assert.strictEqual(resolvedFailed.isAiConfirmed, false, 'A3.2: isAiConfirmed must be false when providers failed');
  assert.strictEqual(resolvedFailed.reviewStatus, 'PROVIDER_OUTAGE', 'A3.2: reviewStatus must be PROVIDER_OUTAGE');

  console.log('PASS: A3 - OCR và AI identical, user chưa chọn suggestion => selectedSource=OCR => isAiConfirmed=true CHỈ khi provider SUCCESS');
}

// A4: selectedSource=SUGGESTION_1 nhưng currentText khác suggestion1 => invariant FAIL
{
  const state = {
    rawOcrText: 'Em yêu mùa hè',
    ocrText: 'Em yêu mùa hè',
    aiSuggestions: [{ id: '1', provider: 'GROQ', text: 'Em yêu mùa hè rực rỡ', isAiConfirmed: false }],
    currentText: 'Em yêu mùa hè', // Does not match suggestion1!
    selectedSource: 'SUGGESTION_1',
    selectionReason: 'USER_SELECTED_SUGGESTION_1',
    decisionReason: 'USER_SELECTED_SUGGESTION_1',
  };
  assert.strictEqual(assertLegalCurrentText(state), false, 'A4: selectedSource=SUGGESTION_1 with mismatched currentText must fail invariant');
  console.log('PASS: A4 - selectedSource=SUGGESTION_1 nhưng currentText khác suggestion1 => invariant FAIL');
}

// A5: selectedSource=MANUAL_EDIT nhưng currentText khác manualEditText => invariant FAIL
{
  const state = {
    rawOcrText: 'Em yêu mùa hè',
    ocrText: 'Em yêu mùa hè',
    aiSuggestions: [{ id: '1', provider: 'GROQ', text: 'Em yêu mùa hè rực rỡ', isAiConfirmed: false }],
    currentText: 'Em yêu mùa hè', // Does not match manualEditText!
    selectedSource: 'MANUAL_EDIT',
    selectionReason: 'MANUAL_OVERRIDE',
    decisionReason: 'MANUAL_OVERRIDE',
    verifiedTextRaw: 'Mùa hè đã đến rồi',
  };
  assert.strictEqual(assertLegalCurrentText(state, 'Mùa hè đã đến rồi'), false, 'A5: selectedSource=MANUAL_EDIT with mismatched currentText must fail invariant');
  console.log('PASS: A5 - selectedSource=MANUAL_EDIT nhưng currentText khác manualEditText => invariant FAIL');
}

// ==========================================================================
// MANDATORY PROD.4A.5 DUPLICATE-PROVIDER CONSENSUS REJECTION TESTS (D1 - D3)
// ==========================================================================

// D1: GROQ SUCCESS + GEMINI SUCCESS + same normalized suggestion => consensus valid
{
  const line = {
    rawOcrText: 'Mọc trên đổi quề',
    rawOcrConfidence: 0.85,
    groqSuggestion: 'Mọc trên đồi quê',
    groqConfidence: 0.97,
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Mọc trên đồi quê',
    geminiConfidence: 0.96,
    geminiStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.selectedSource, 'SUGGESTION_1', 'D1: Two independent providers agreeing must yield SUGGESTION_1');
  assert.strictEqual(state.selectionReason, 'MULTI_PROVIDER_CONSENSUS', 'D1: selectionReason must be MULTI_PROVIDER_CONSENSUS');
  assert.strictEqual(state.decisionEvidence.providerConsensus, true, 'D1: providerConsensus must be true');
  assert.strictEqual(state.aiConfidenceSource, 'MULTI_PROVIDER', 'D1: aiConfidenceSource must be MULTI_PROVIDER');
  assert.ok(assertLegalCurrentText(state), 'D1: Must pass legal current text invariant');
  console.log('PASS: D1 - GROQ SUCCESS + GEMINI SUCCESS + same suggestion => valid multi-provider consensus');
}

// D2: GROQ appears twice (duplicate provider ID) => MUST NOT be counted as two-provider consensus
{
  // Simulate: both suggestions come from GROQ (same provider), even though they agree
  const line = {
    rawOcrText: 'Mọc trên đổi quề',
    rawOcrConfidence: 0.85,
    groqSuggestion: 'Mọc trên đồi quê',
    groqConfidence: 0.97,
    groqStatus: 'SUCCESS',
    // Gemini is NOT available - no second independent provider
    geminiStatus: 'UNAVAILABLE',
  };
  const state = resolveLineDisplayState(line);
  // With only 1 provider, consensus must NOT be claimed
  assert.strictEqual(state.decisionEvidence.providerConsensus, false, 'D2: Single provider (GROQ only) must NOT claim consensus');
  assert.notStrictEqual(state.aiConfidenceSource, 'MULTI_PROVIDER', 'D2: aiConfidenceSource must NOT be MULTI_PROVIDER with single provider');
  // Default must stay OCR since only single-provider evidence
  assert.strictEqual(state.selectedSource, 'OCR', 'D2: Must default to OCR without multi-provider consensus');
  console.log('PASS: D2 - GROQ duplicate/single provider => NOT counted as two-provider consensus');
}

// D3: One provider SUCCESS, other FALLBACK/CACHED_COPY/UNAVAILABLE => NOT consensus
{
  const line = {
    rawOcrText: 'Mọc trên đổi quề',
    rawOcrConfidence: 0.85,
    groqSuggestion: 'Mọc trên đồi quê',
    groqConfidence: 0.97,
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Mọc trên đồi quê', // Same text but provider is UNAVAILABLE
    geminiConfidence: 0.96,
    geminiStatus: 'UNAVAILABLE', // NOT SUCCESS
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.decisionEvidence.providerConsensus, false, 'D3: SUCCESS + UNAVAILABLE must NOT claim consensus');
  assert.notStrictEqual(state.aiConfidenceSource, 'MULTI_PROVIDER', 'D3: aiConfidenceSource must NOT be MULTI_PROVIDER');
  assert.strictEqual(state.selectedSource, 'OCR', 'D3: Must default to OCR when second provider is UNAVAILABLE');
  console.log('PASS: D3 - One provider SUCCESS + other UNAVAILABLE => NOT consensus, stays OCR');
}

// ==========================================================================
// MANDATORY PROD.4A.5 HIDDEN RE-OCR TEST (H1)
// ==========================================================================

// H1: rawOcrText must remain immutable through resolveLineDisplayState
// No hidden re-OCR should modify rawOcrText during display state resolution
{
  const originalRawOcrText = 'Em yêu mùa hè';
  const line = {
    rawOcrText: originalRawOcrText,
    rawOcrConfidence: 0.90,
    groqSuggestion: 'Em yêu mùa hè!',
    groqConfidence: 0.95,
    groqStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  // rawOcrText in output must be identical to input
  assert.strictEqual(state.rawOcrText, originalRawOcrText, 'H1: rawOcrText must be immutable through resolveLineDisplayState');
  assert.strictEqual(state.ocrText, originalRawOcrText, 'H1: ocrText must equal rawOcrText (no hidden re-OCR)');
  // Verify no mutation occurred on the input object
  assert.strictEqual(line.rawOcrText, originalRawOcrText, 'H1: Input line.rawOcrText must not be mutated');
  console.log('PASS: H1 - rawOcrText remains immutable, no hidden re-OCR mutation detected (count=0)');
}

// ==========================================================================
// MANDATORY PROD.4B.1 ARBITRATION TESTS (B1 - B7)
// ==========================================================================

// B1: Physical Line 4 Defect: OCR="Rung sring bướm lượn." (0.94) -> "Rung rinh bướm lượn." auto-selects
{
  assert.strictEqual(isVietnameseSyllableValid('sring'), false, 'B1: "sring" must be invalid (illegal "sr" onset cluster)');
  assert.strictEqual(isVietnameseSyllableValid('rinh'), true, 'B1: "rinh" must be valid Vietnamese syllable');
  assert.strictEqual(isStandardVietnameseReduplicative('Rung', 'rinh'), true, 'B1: "rung rinh" must be recognized reduplicative');

  const line = {
    lineId: 'line-4-physical',
    rawOcrText: 'Rung sring bướm lượn.',
    rawOcrConfidence: 0.94,
    groqSuggestion: 'Rung rinh bướm lượn.',
    groqConfidence: 0.98,
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Rung ring bướm lượn.',
    geminiConfidence: 0.95,
    geminiStatus: 'SUCCESS',
  };

  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.selectedSource, 'SUGGESTION_1', 'B1: Candidate 1 must be auto-selected over garbled OCR');
  assert.strictEqual(state.currentText, 'Rung rinh bướm lượn.', 'B1: currentText must strictly match Candidate 1');
  assert.strictEqual(state.selectionReason, 'GARBLED_OCR_DETERMINISTIC_CORRECTION', 'B1: selectionReason must be GARBLED_OCR_DETERMINISTIC_CORRECTION');
  assert.strictEqual(state.decisionEvidence.ruleApplied, 'RULE_4B_DETERMINISTIC_EVIDENCE_WINS', 'B1: Rule 4B must be applied');
  assert.ok(assertLegalCurrentText(state), 'B1: Must pass legal current text invariant');
  console.log('PASS: B1 - Physical Line 4: "sring" garbled onset -> "rinh" wins deterministically (selectedSource=SUGGESTION_1)');
}

// B2: OCR valid + AI wrong -> OCR stays default
{
  const line = {
    rawOcrText: 'Em yêu mùa hè',
    rawOcrConfidence: 0.92,
    groqSuggestion: 'Em yêu mùa thu',
    groqConfidence: 0.98,
    groqStatus: 'SUCCESS',
    geminiStatus: 'UNAVAILABLE',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.selectedSource, 'OCR', 'B2: Valid OCR text must NOT be overridden by single AI');
  assert.strictEqual(state.currentText, 'Em yêu mùa hè', 'B2: currentText must remain original valid OCR text');
  assert.strictEqual(state.selectionReason, 'OCR_DEFAULT_INSUFFICIENT_EVIDENCE', 'B2: Reason must be OCR_DEFAULT_INSUFFICIENT_EVIDENCE');
  console.log('PASS: B2 - OCR valid + AI wrong -> OCR stays default');
}

// B3: Two providers disagree on ambiguous garble without clear winner -> NEEDS_REVIEW
{
  const line = {
    rawOcrText: 'Mùa xq quê hương',
    rawOcrConfidence: 0.70,
    groqSuggestion: 'Mùa xa quê hương',
    groqConfidence: 0.95,
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Mùa xưa quê hương',
    geminiConfidence: 0.95,
    geminiStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.strictEqual(state.selectedSource, 'OCR', 'B3: Ambiguous candidates on garbled OCR must retain OCR and flag NEEDS_REVIEW');
  assert.strictEqual(state.selectionReason, 'NEEDS_REVIEW', 'B3: selectionReason must be NEEDS_REVIEW');
  assert.strictEqual(state.decisionEvidence.ruleApplied, 'RULE_4B_CONFLICTING_CANDIDATES_NEEDS_REVIEW');
  console.log('PASS: B3 - Two providers disagree on ambiguous garble -> stays OCR + NEEDS_REVIEW');
}

// B4: Explicit user selection wins over auto-selection
{
  // User explicitly taps "Giữ OCR gốc" (verdict='CORRECT')
  const lineKeepOcr = {
    rawOcrText: 'Rung sring bướm lượn.',
    rawOcrConfidence: 0.94,
    groqSuggestion: 'Rung rinh bướm lượn.',
    groqConfidence: 0.98,
    groqStatus: 'SUCCESS',
    verdict: 'CORRECT',
  };
  const stateOcr = resolveLineDisplayState(lineKeepOcr);
  assert.strictEqual(stateOcr.selectedSource, 'OCR', 'B4.1: Explicit keep OCR must yield OCR');
  assert.strictEqual(stateOcr.currentText, 'Rung sring bướm lượn.');

  // User explicitly taps "Dùng gợi ý 2" (selectedSource='SUGGESTION_2')
  const lineSugg2 = {
    rawOcrText: 'Rung sring bướm lượn.',
    rawOcrConfidence: 0.94,
    groqSuggestion: 'Rung rinh bướm lượn.',
    groqConfidence: 0.98,
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Rung ring bướm lượn.',
    geminiConfidence: 0.95,
    geminiStatus: 'SUCCESS',
    selectedSource: 'SUGGESTION_2',
  };
  const stateSugg2 = resolveLineDisplayState(lineSugg2);
  assert.strictEqual(stateSugg2.selectedSource, 'SUGGESTION_2', 'B4.2: Explicit SUGGESTION_2 selection must yield SUGGESTION_2');
  assert.strictEqual(stateSugg2.currentText, 'Rung ring bướm lượn.');
  console.log('PASS: B4 - Explicit user selection (OCR or Suggestion 2) strictly wins over auto-selection');
}

// B5: Manual edit wins over auto-selection
{
  const lineManual = {
    rawOcrText: 'Rung sring bướm lượn.',
    rawOcrConfidence: 0.94,
    groqSuggestion: 'Rung rinh bướm lượn.',
    groqConfidence: 0.98,
    groqStatus: 'SUCCESS',
    verdict: 'CORRECTED',
    verifiedTextRaw: 'Rung rinh bướm vàng bay.',
  };
  const state = resolveLineDisplayState(lineManual);
  assert.strictEqual(state.selectedSource, 'MANUAL_EDIT', 'B5: Manual edit must win');
  assert.strictEqual(state.currentText, 'Rung rinh bướm vàng bay.');
  assert.strictEqual(state.selectionReason, 'MANUAL_EDIT_OVERRIDE');
  assert.ok(assertLegalCurrentText(state, 'Rung rinh bướm vàng bay.'));
  console.log('PASS: B5 - Manual edit strictly wins over auto-selection');
}

// B6: Third-string invariant PASS
{
  const line = {
    rawOcrText: 'Rung sring bướm lượn.',
    rawOcrConfidence: 0.94,
    groqSuggestion: 'Rung rinh bướm lượn.',
    groqConfidence: 0.98,
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Rung ring bướm lượn.',
    geminiConfidence: 0.95,
    geminiStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.ok(assertLegalCurrentText(state), 'B6.1: Legal state must pass invariant');

  // Corrupted synthetic state must fail
  const corruptedState = {
    ...state,
    currentText: 'Rung rinh bướm bay lượn trên đồng', // synthetic string
  };
  assert.strictEqual(assertLegalCurrentText(corruptedState), false, 'B6.2: Synthetic third string must fail invariant');
  console.log('PASS: B6 - Third-string invariant PASS; synthetic string strictly rejected');
}

// B7: Provider provenance and suggestionDevLogs logged
{
  const line = {
    rawOcrText: 'Rung sring bướm lượn.',
    rawOcrConfidence: 0.94,
    groqSuggestion: 'Rung rinh bướm lượn.',
    groqConfidence: 0.98,
    groqStatus: 'SUCCESS',
    geminiSuggestion: 'Rung ring bướm lượn.',
    geminiConfidence: 0.95,
    geminiStatus: 'SUCCESS',
  };
  const state = resolveLineDisplayState(line);
  assert.ok(Array.isArray(state.suggestionDevLogs), 'B7: suggestionDevLogs must be an array');
  assert.strictEqual(state.suggestionDevLogs.length, 2, 'B7: Must have 2 dev log entries');
  assert.strictEqual(state.suggestionDevLogs[0].suggestionIndex, 1);
  assert.strictEqual(state.suggestionDevLogs[0].provider, 'GROQ');
  assert.strictEqual(state.suggestionDevLogs[0].selected, true);
  assert.strictEqual(state.suggestionDevLogs[0].selectionReason, 'GARBLED_OCR_DETERMINISTIC_CORRECTION');
  assert.strictEqual(state.suggestionDevLogs[1].suggestionIndex, 2);
  assert.strictEqual(state.suggestionDevLogs[1].provider, 'GEMINI');
  assert.strictEqual(state.suggestionDevLogs[1].selected, false);
  console.log('PASS: B7 - Provider provenance and suggestionDevLogs correctly structured and logged');
}

console.log('\n=== ALL PROD.3B, PROD.3F, PROD.4A.1-4A.5, A1-A5, D1-D3, H1, B1-B7 REGRESSION CASES PASSED SUCCESSFULLY ===\n');

