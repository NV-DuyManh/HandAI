import { MultilineTrialResult, MultilineLineResult } from '../services/api/OcrPilotService';

/**
 * Checks if background advisors are still in-flight for a multiline trial.
 * Advisors are considered pending if any line has neither groqStatus nor geminiStatus
 * and no parsed suggestions have been populated yet.
 */
export function isAdvisorPending(trial: MultilineTrialResult | null | undefined): boolean {
  if (!trial || !Array.isArray(trial.lines) || trial.lines.length === 0) {
    return false;
  }
  return trial.lines.some((l) => {
    const hasStatus = Boolean(l.groqStatus || l.geminiStatus);
    const hasSuggestions = Array.isArray(l.suggestions) && l.suggestions.length > 0;
    const hasDirectText = Boolean(l.groqSuggestion || l.geminiSuggestion);
    return !hasStatus && !hasSuggestions && !hasDirectText;
  });
}

/**
 * Safely merges fresh advisor results into the current mounted trial state.
 *
 * CRITICAL SAFETY RULES (PROD.4B.2R3 Section 7):
 * 1. If the user already made a selection or verdict (CORRECT, CORRECTED, SKIPPED, MANUAL_EDIT)
 *    on a line, late incoming advisor results MUST NOT overwrite that user choice.
 * 2. If the user is currently editing a line in the text input (activeEditingLineId),
 *    the line's in-progress editing state MUST NOT be disturbed.
 * 3. Advisor suggestions are safely attached to the line so suggestion cards can be viewed
 *    without replacing the user-selected text.
 * 4. Untouched lines are updated with the incoming advisor text/suggestions.
 */
export function mergeTrialWithAdvisorUpdate(
  currentTrial: MultilineTrialResult,
  incomingTrial: MultilineTrialResult,
  activeEditingLineId?: string | null
): MultilineTrialResult {
  if (!incomingTrial || !Array.isArray(incomingTrial.lines)) {
    return currentTrial;
  }

  const existingMap = new Map<string, MultilineLineResult>();
  for (const l of currentTrial.lines) {
    existingMap.set(l.lineId, l);
  }

  const mergedLines: MultilineLineResult[] = incomingTrial.lines.map((incoming) => {
    const existing = existingMap.get(incoming.lineId);
    if (!existing) {
      return incoming;
    }

    const isUserTouched = Boolean(
      (existing.verdict && existing.verdict !== 'UNREVIEWED') ||
      existing.selectedSource === 'MANUAL_EDIT' ||
      existing.selectedSource === 'manual_edit' ||
      existing.lineId === activeEditingLineId
    );

    if (isUserTouched) {
      // Preserve all user choices, verdicts, and text edits strictly
      return {
        ...incoming,
        verdict: existing.verdict,
        verifiedTextRaw: existing.verifiedTextRaw,
        verifiedTextNormalized: existing.verifiedTextNormalized,
        finalText: existing.finalText,
        predictedText: existing.predictedText,
        currentText: existing.currentText,
        selectedSource: existing.selectedSource,
        selectionReason: existing.selectionReason,
        // Incorporate advisor updates so suggestions appear without altering user text
        groqSuggestion: incoming.groqSuggestion ?? existing.groqSuggestion,
        groqConfidence: incoming.groqConfidence ?? existing.groqConfidence,
        groqStatus: incoming.groqStatus ?? existing.groqStatus,
        groqModel: incoming.groqModel ?? existing.groqModel,
        groqDecision: incoming.groqDecision ?? existing.groqDecision,
        geminiSuggestion: incoming.geminiSuggestion ?? existing.geminiSuggestion,
        geminiConfidence: incoming.geminiConfidence ?? existing.geminiConfidence,
        geminiStatus: incoming.geminiStatus ?? existing.geminiStatus,
        geminiModel: incoming.geminiModel ?? existing.geminiModel,
        geminiDecision: incoming.geminiDecision ?? existing.geminiDecision,
        suggestions: incoming.suggestions ?? existing.suggestions,
      };
    }

    // Untouched line: accept incoming line
    return incoming;
  });

  return {
    ...currentTrial,
    ...incomingTrial,
    lines: mergedLines,
  };
}
