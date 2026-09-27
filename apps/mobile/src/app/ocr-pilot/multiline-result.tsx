import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { OcrPilotService, MultilineTrialResult, MultilineLineResult } from '../../services/api/OcrPilotService';
import { logFlowDomain } from '../../services/draft/submissionDraftStore';
import {
  buildVisibleSuggestions,
  VisibleSuggestion,
  normalizeForComparison,
  getLineReviewStatus,
  resolveLineDisplayState,
} from '../../utils/suggestionDedupe';
import { isAdvisorPending, mergeTrialWithAdvisorUpdate } from '../../utils/mobileAsyncAdvisor';
import { isHandAIMode } from '../../config/appMode';
import { handAiAnalyticsStore } from '../../services/analytics/handAiAnalyticsStore';

export function getDecisionExplanation(
  state: ReturnType<typeof resolveLineDisplayState>,
  line: MultilineLineResult,
  isHandAI: boolean
): string {
  const src = (state.selectedSource || '').toUpperCase();
  const reason = state.selectionReason;

  if (src === 'MANUAL_EDIT' || src === 'MANUAL') {
    return isHandAI
      ? 'Manual edit verified by evaluator.'
      : 'Đã tự sửa bởi người dùng.';
  }

  if (src === 'SUGGESTION_1' || src === 'SUGGESTION_2') {
    if (reason === 'USER_EXPLICIT_SELECTION') {
      return isHandAI
        ? 'AI Suggestion selected by evaluator.'
        : 'Gợi ý AI được người dùng chọn.';
    }
    if (reason === 'MULTI_PROVIDER_CONSENSUS') {
      return isHandAI
        ? 'AI Suggestion selected because multi-provider consensus independently confirmed the spelling correction.'
        : 'Gợi ý AI được tự động chọn vì các mô hình AI độc lập cùng đồng thuận xác nhận lỗi chính tả.';
    }
    if (reason === 'GARBLED_OCR_DETERMINISTIC_CORRECTION') {
      return isHandAI
        ? 'AI Suggestion selected because OCR contained invalid Vietnamese spelling pattern and correction passed validation.'
        : 'Gợi ý AI được tự động chọn vì OCR gốc chứa mẫu âm vị tiếng Việt không hợp lệ và từ sửa đổi đạt chuẩn từ điển.';
    }
    return isHandAI
      ? 'AI Suggestion selected based on candidate confidence validation.'
      : 'Gợi ý AI được chọn theo độ tin cậy mô hình.';
  }

  // OCR
  if (state.isAiConfirmed) {
    return isHandAI
      ? 'Raw OCR kept because AI model confirmed exact match with predicted handwriting.'
      : 'Giữ OCR gốc vì mô hình AI đã xác nhận nội dung trùng khớp chính xác.';
  }
  if (reason === 'USER_EXPLICIT_SELECTION') {
    return isHandAI
      ? 'Raw OCR kept by explicit evaluator selection.'
      : 'Giữ OCR gốc theo lựa chọn của người dùng.';
  }
  return isHandAI
    ? 'Raw OCR kept because confidence is high and no stronger correction was found.'
    : 'Giữ OCR gốc vì độ tin cậy cao và không có đề xuất sửa đổi mạnh hơn.';
}

export {
  VisibleSuggestion,
  normalizeForComparison,
  buildVisibleSuggestions,
  getLineReviewStatus,
  resolveLineDisplayState,
  isAdvisorPending,
  mergeTrialWithAdvisorUpdate,
};

export interface AdvisorView {
  provider: 'GROQ' | 'GEMINI';
  model: string;
  status: 'SUCCESS' | 'NOT_TRIGGERED' | 'UNAVAILABLE' | 'DISABLED' | 'ERROR';
  text: string;
  confidence: number;
  decision?: string;
  wasTriggered: boolean;
}

export function buildAdvisorView(line: MultilineLineResult, provider: 'GROQ' | 'GEMINI'): AdvisorView {
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

  if (text.length > 0) {
    status = 'SUCCESS';
  } else if (rawStatus === 'UNAVAILABLE') {
    status = 'UNAVAILABLE';
  } else if (rawStatus === 'DISABLED') {
    status = 'DISABLED';
  } else if (rawStatus === 'ERROR') {
    status = 'ERROR';
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

export default function MultilineResultScreen() {
  const router = useRouter();
  const isHandAI = isHandAIMode();
  const params = useLocalSearchParams();
  const trialId = params.trialId as string;

  if (__DEV__) {
    console.log('MOBILE_GEMINI_UI_BUILD=GEMINI_4B');
  }

  const [trial, setTrial] = useState<MultilineTrialResult | null>(() => {
    return trialId ? (OcrPilotService.getCachedTrial(trialId) || null) : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return trialId ? !OcrPilotService.getCachedTrial(trialId) : true;
  });
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [submittingLineId, setSubmittingLineId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchTrial = async () => {
      if (!trialId) {
        Alert.alert('Lỗi', 'Không tìm thấy mã bài nhận diện.', [
          { text: 'Quay lại', onPress: () => router.replace('/(tabs)' as any) },
        ]);
        return;
      }
      try {
        const res = await OcrPilotService.getMultilineTrial(trialId);
        if (!active) return;
        logFlowDomain('RESULT', 'HANDWRITING_TEXT');
        console.log('[OCR-PHYSICAL] Loaded trial:', {
          trialId: res.trialId,
          recognitionEngine: res.recognitionEngine,
          segmentationSource: res.segmentationSource,
          correctionSource: res.correctionSource,
          finalTextSource: res.finalTextSource,
          linesCount: res.lines?.length,
          requestId: res.requestId,
        });
        setTrial(res);
        if (isHandAI) {
          const analytics = handAiAnalyticsStore.computeTrialAnalytics(res, false);
          handAiAnalyticsStore.setCurrentTrialAnalytics(analytics);
        }
      } catch (e: any) {
        if (!active) return;
        Alert.alert('Lỗi', e?.message || 'Không thể tải kết quả nhận diện.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchTrial();

    return () => {
      active = false;
    };
  }, [trialId, router]);

  const advisorPending = isAdvisorPending(trial);

  // Section 7: Async background advisor polling
  // Polls every 1000ms while advisors are pending, stops when complete/failed or after 8 polls.
  // Safely merges suggestions without overwriting user selections or manual edits.
  useEffect(() => {
    let mounted = true;
    if (!trialId || !trial) return;
    if (!advisorPending) return;

    let pollCount = 0;
    const maxPolls = 8;
    const pollIntervalMs = 1000;

    const timer = setInterval(async () => {
      if (!mounted) return;
      pollCount++;
      if (pollCount > maxPolls) {
        clearInterval(timer);
        return;
      }

      try {
        const fresh = await OcrPilotService.getMultilineTrial(trialId);
        if (!mounted) return;

        setTrial((prev) => {
          if (!prev) return fresh;
          return mergeTrialWithAdvisorUpdate(prev, fresh, editingLineId);
        });

        if (!isAdvisorPending(fresh)) {
          clearInterval(timer);
        }
      } catch (e) {
        console.warn('[MULTILINE_ASYNC_POLL] Background advisor poll check error:', e);
        if (pollCount >= maxPolls) clearInterval(timer);
      }
    }, pollIntervalMs);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [trialId, trial, advisorPending, editingLineId]);

  const handleFeedback = async (
    line: MultilineLineResult,
    verdict: 'CORRECT' | 'CORRECTED' | 'SKIPPED',
    verifiedText?: string
  ) => {
    try {
      setSubmittingLineId(line.lineId);

      const targetText = verifiedText !== undefined
        ? verifiedText
        : (verdict === 'CORRECT' ? (line.finalText || line.rawOcrText || line.predictedText) : line.predictedText);

      // Immediate optimistic update of local state
      setTrial((prev) => {
        if (!prev) return prev;
        const updatedLines = prev.lines.map((l) => {
          if (l.lineId === line.lineId) {
            return {
              ...l,
              verdict,
              verifiedTextRaw: verifiedText !== undefined ? verifiedText : (verdict === 'CORRECT' ? (l.rawOcrText || l.predictedText) : l.verifiedTextRaw),
              finalText: targetText,
              predictedText: targetText,
            };
          }
          return l;
        });
        return { ...prev, lines: updatedLines };
      });

      const updatedLine = await OcrPilotService.submitLineFeedback(
        trialId,
        line.lineId,
        verdict,
        verifiedText
      );

      // Reconcile with server response
      setTrial((prev) => {
        if (!prev) return prev;
        const updatedLines = prev.lines.map((l) =>
          l.lineId === line.lineId
            ? {
                ...l,
                ...updatedLine,
                finalText: targetText,
                predictedText: targetText,
              }
            : l
        );
        return { ...prev, lines: updatedLines };
      });

      if (verdict === 'CORRECTED') {
        setEditingLineId(null);
        setEditText('');
      }
    } catch (e: any) {
      Alert.alert('Lỗi phản hồi', e?.message || 'Không thể lưu phản hồi.');
    } finally {
      setSubmittingLineId(null);
    }
  };

  const startEditLine = (line: MultilineLineResult) => {
    setEditingLineId(line.lineId);
    setEditText(line.verifiedTextRaw || line.finalText || line.predictedText || '');
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải kết quả các dòng...</Text>
      </View>
    );
  }

  if (!trial) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Không thể hiển thị kết quả bài nhận diện.</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => router.replace('/(tabs)' as any)}
          accessibilityRole="button"
          accessibilityLabel="Về trang chủ"
        >
          <Text style={styles.retryBtnText}>Về trang chủ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Current full merged text strictly matching resolved per-line selections
  const currentMergedText = trial.lines
    .map((l) => resolveLineDisplayState(l).currentText)
    .join('\n');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Sleek App Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)' as any)}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={isHandAI ? 'Back to Home' : 'Về trang chủ'}
        >
          <Ionicons name="home-outline" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isHandAI ? 'Recognition Result' : 'Kết quả nhận diện'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Modern Summary Banner */}
      <View style={styles.summaryCard}>
        <Ionicons name="sparkles" size={18} color="#2563EB" />
        <Text style={styles.summaryText}>
          {isHandAI
            ? `Recognized ${trial.lines.length} lines. Review raw OCR, verified AI suggestions, or manually edit.`
            : `Đã nhận diện ${trial.lines.length} dòng. Em có thể chọn gợi ý hoặc tự sửa từng dòng.`}
        </Text>
      </View>

      {/* Top Combined Text Card (Requirement D: Toàn bộ văn bản hiện tại (N dòng)) */}
      <View style={[styles.card, SHADOWS.small]}>
        <View style={styles.cardHeader}>
          <Ionicons name="document-text" size={18} color={COLORS.primary} />
          <Text style={styles.cardTitle}>
            {isHandAI
              ? `Full Transcription (${trial.lines.length} lines):`
              : `Toàn bộ văn bản hiện tại (${trial.lines.length} dòng):`}
          </Text>
        </View>
        <View style={styles.joinedTextBox}>
          <Text style={styles.joinedText}>
            {currentMergedText || (isHandAI ? '(No characters recognized yet)' : '(Chưa nhận diện được chữ nào)')}
          </Text>
        </View>
      </View>

      {/* Per-Line Feedback Section */}
      <View style={styles.sectionHeadingContainer}>
        <Text style={styles.sectionTitle}>
          {isHandAI ? 'Review & Transcribe Lines:' : 'Xác nhận & sửa từng dòng chữ:'}
        </Text>
        <Text style={styles.sectionSubtitle}>
          {isHandAI
            ? 'Verify individual line recognitions and AI arbitration reasons below:'
            : 'Em hãy kiểm tra từng dòng dưới đây và sửa lại nếu cần nhé:'}
        </Text>
      </View>

      {trial.lines.map((line) => {
        const isEditing = editingLineId === line.lineId;
        const isSubmitting = submittingLineId === line.lineId;

        let badgeBg = '#FEF3C7';
        let badgeColor = '#D97706';
        let badgeText = isHandAI ? 'Pending' : 'Chưa xác nhận';

        if (line.verdict === 'CORRECT') {
          badgeBg = '#DCFCE7';
          badgeColor = '#16A34A';
          badgeText = isHandAI ? 'Confirmed ✓' : 'Đúng ✓';
        } else if (line.verdict === 'CORRECTED') {
          badgeBg = '#DBEAFE';
          badgeColor = '#2563EB';
          badgeText = isHandAI ? 'Edited' : 'Đã chỉnh';
        } else if (line.verdict === 'SKIPPED') {
          badgeBg = '#F1F5F9';
          badgeColor = '#64748B';
          badgeText = isHandAI ? 'Skipped' : 'Đã bỏ qua';
        }

        const displayState = resolveLineDisplayState(line);
        const { ocrText, aiSuggestions, currentText, selectedSource, isAiConfirmed } = displayState;
        const rawText = line.rawOcrText || line.predictedText;
        const reviewStatus = getLineReviewStatus(line);
        const rawOcrConf = displayState.rawOcrConfidence ?? line.rawOcrConfidence ?? line.confidence;
        const rawOcrConfText = rawOcrConf != null ? `${(rawOcrConf * 100).toFixed(0)}%` : null;

        // Smart Suggestion Logic for HandAI (Phase 4):
        const firstCandidate = aiSuggestions[0];
        const normRaw = normalizeForComparison(ocrText);
        const hasCandidateText = Boolean(firstCandidate && firstCandidate.text && firstCandidate.text.trim().length > 0);
        const normCandidate = hasCandidateText ? normalizeForComparison(firstCandidate.text) : '';
        const isCandidateIdenticalToRaw = hasCandidateText && normCandidate === normRaw;
        const isCandidateDistinct = hasCandidateText && !isCandidateIdenticalToRaw;
        const hasAiConfirmedOcr = isAiConfirmed || isCandidateIdenticalToRaw;

        const sourceLabel =
          selectedSource === 'MANUAL_EDIT' || selectedSource === 'manual_edit'
            ? 'MANUAL'
            : selectedSource === 'SUGGESTION_1' || selectedSource === 'suggestion_1'
            ? 'AI'
            : 'OCR';

        // Required internal debug log (never toasted to student UI):
        console.log(
          `[LINE_RENDER_DEBUG] lineId=${line.lineId} lineOrder=${line.lineOrder} rawText="${rawText}" ` +
          `ocrText="${ocrText}" suggestions=[${aiSuggestions.map((s) => `"${s.text}"`).join(', ')}] ` +
          `selectedSource=${selectedSource} currentText="${currentText}" reviewStatus=${reviewStatus} isAiConfirmed=${isAiConfirmed}`
        );

        return (
          <View key={line.lineId} style={[styles.lineCard, SHADOWS.small]}>
            {/* Row Order, Confidence, and Verdict Badge */}
            <View style={styles.lineHeaderRow}>
              <View style={styles.lineOrderBadge}>
                <Text style={styles.lineOrderText}>
                  {isHandAI ? `LINE ${line.lineOrder}` : `Dòng ${line.lineOrder}`}
                </Text>
              </View>
              <View style={styles.lineHeaderRight}>
                {isHandAI && rawOcrConfText && (
                  <View style={styles.confidencePill}>
                    <Text style={styles.confidencePillText}>Confidence: {rawOcrConfText}</Text>
                  </View>
                )}
                <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                  <Text style={[styles.badgeLabel, { color: badgeColor }]}>{badgeText}</Text>
                </View>
              </View>
            </View>

            {isHandAI ? (
              /* ============================================================
                 HAND_AI RESEARCH DEMO: TRANSPARENT OCR & AI ARBITRATION CARD
                 ============================================================ */
              <View style={styles.researchLineCardContent}>
                {/* 1. MODEL OUTPUT (Neutral Gray) */}
                <View style={styles.researchOcrBlock}>
                  <View style={styles.researchFieldHeaderRow}>
                    <Text style={styles.researchOcrLabel}>Model Output</Text>
                    {hasAiConfirmedOcr && (
                      <View style={styles.aiConfirmedBadge}>
                        <Ionicons name="checkmark-circle" size={13} color="#166534" />
                        <Text style={styles.aiConfirmedBadgeText}>AI Validation Passed</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.researchOcrText}>
                    {ocrText ? `"${ocrText}"` : '(No character predicted)'}
                  </Text>
                </View>

                {/* 2. AI CORRECTION CANDIDATE (Soft Amber — Rendered ONLY if candidate text exists) */}
                {isCandidateDistinct && firstCandidate?.text && firstCandidate.text.trim().length > 0 ? (
                  <View style={styles.researchSuggBlock}>
                    <View style={styles.researchFieldHeaderRow}>
                      <Text style={styles.researchSuggLabel}>AI Correction Candidate</Text>
                    </View>
                    <Text style={styles.researchSuggText}>
                      "{firstCandidate.text}"
                    </Text>
                  </View>
                ) : null}

                {/* 3. CONFIRMED RESULT (Strong Blue) */}
                <View style={styles.researchResultBlock}>
                  <View style={styles.researchFieldHeaderRow}>
                    <Text style={styles.researchResultLabel}>Confirmed Result</Text>
                    <View style={styles.researchSourceChip}>
                      <Text style={styles.researchSourceChipText}>SOURCE: {sourceLabel}</Text>
                    </View>
                  </View>
                  <Text style={styles.researchResultText}>
                    {currentText ? `"${currentText}"` : '(Empty)'}
                  </Text>
                </View>

                {/* 4. DECISION REASON */}
                <View style={styles.researchReasonBlock}>
                  <Text style={styles.researchReasonLabel}>DECISION REASON:</Text>
                  <Text style={styles.researchReasonText}>
                    "{getDecisionExplanation(displayState, line, true)}"
                  </Text>
                </View>

                {/* Actions: [Keep Model Output] [Use AI Candidate] [Edit] */}
                {!isEditing && (
                  <View style={styles.researchActionRow}>
                    <TouchableOpacity
                      style={[styles.researchActionBtn, styles.researchKeepOcrBtn]}
                      onPress={() => handleFeedback(line, 'CORRECT', ocrText)}
                      accessibilityRole="button"
                      accessibilityLabel="Keep Model Output"
                    >
                      <Ionicons name="shield-checkmark-outline" size={15} color="#334155" />
                      <Text style={styles.researchKeepOcrBtnText}>Keep Model Output</Text>
                    </TouchableOpacity>

                    {isCandidateDistinct && firstCandidate?.text && firstCandidate.text.trim().length > 0 && (
                      <TouchableOpacity
                        style={[styles.researchActionBtn, styles.researchUseAiBtn]}
                        onPress={() => handleFeedback(line, 'CORRECTED', firstCandidate.text)}
                        accessibilityRole="button"
                        accessibilityLabel="Use AI Candidate"
                      >
                        <Ionicons name="sparkles" size={15} color="#FFFFFF" />
                        <Text style={styles.researchUseAiBtnText}>Use AI Candidate</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.researchActionBtn, styles.researchEditBtn]}
                      onPress={() => startEditLine(line)}
                      accessibilityRole="button"
                      accessibilityLabel="Manual Edit"
                    >
                      <Ionicons name="pencil" size={15} color="#1E40AF" />
                      <Text style={styles.researchEditBtnText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Inline Editing for HandAI */}
                {isEditing && (
                  <View style={styles.editForm}>
                    <Text style={styles.editFormLabel}>Manual edit line text:</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editText}
                      onChangeText={setEditText}
                      placeholder="Enter verified handwriting text..."
                      placeholderTextColor={COLORS.textMuted}
                      autoFocus
                    />
                    <View style={styles.editActionRow}>
                      <TouchableOpacity
                        style={styles.cancelEditBtn}
                        onPress={() => setEditingLineId(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel"
                      >
                        <Text style={styles.cancelEditBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.saveEditBtn, isSubmitting && { opacity: 0.6 }]}
                        disabled={isSubmitting}
                        onPress={() => handleFeedback(line, 'CORRECTED', editText)}
                        accessibilityRole="button"
                        accessibilityLabel="Save"
                      >
                        {isSubmitting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.saveEditBtnText}>Save</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              /* Original MathVision Kids Content */
              <>
                {/* Section A: Raw CRNN OCR (Immutable read engine) */}
                <View style={styles.sectionABox}>
                  <View style={styles.sectionSubHeader}>
                    <View style={styles.advisorTitleRow}>
                      <Text style={styles.sectionALabel}>OCR gốc</Text>
                    </View>
                    {line.rawOcrConfidence != null && (
                      <Text style={styles.confidenceBadge}>
                        Độ tin cậy: {(line.rawOcrConfidence * 100).toFixed(0)}%
                      </Text>
                    )}
                  </View>
                  <Text style={styles.sectionAText}>
                    {ocrText ? `"${ocrText}"` : '(Không nhận diện được ký tự nào)'}
                  </Text>
                </View>

                {/* Section B: Deduplicated Suggestions & Review Status */}
                {(() => {
                  const geminiView = buildAdvisorView(line, 'GEMINI');
                  return (
                    aiSuggestions.length === 0 ? (
                      reviewStatus === 'AI_CONFIRMED' ? (
                        <View style={styles.aiConfirmedRow}>
                          <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                          <Text style={styles.aiConfirmedText}>
                            AI xác nhận nội dung chính xác ✓
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.aiConfirmedRow}>
                          <Ionicons name="document-text-outline" size={16} color="#64748B" />
                          <Text style={[styles.aiConfirmedText, { color: '#64748B' }]}>
                            Bản hiện tại (Chưa thể kiểm tra thêm lúc này.)
                          </Text>
                        </View>
                      )
                    ) : (
                      aiSuggestions.map((sugg, idx) => (
                        <View
                          key={sugg.id}
                          style={idx === 0 ? styles.sectionBBox : styles.sectionGeminiBox}
                        >
                          <View style={styles.sectionSubHeader}>
                            <View style={styles.advisorTitleRow}>
                              {idx === 0 ? (
                                <Text style={styles.sectionBLabel}>Gợi ý 1</Text>
                              ) : (
                                <Text style={styles.sectionGeminiLabel}>Gợi ý 2</Text>
                              )}
                            </View>
                            {(sugg.decision === 'AUTO_APPLY' || (idx === 0 && line.correctionApplied)) && !sugg.isAiConfirmed && (
                              <View style={styles.autoApplyBadge}>
                                <Text style={styles.autoApplyBadgeText}>
                                  {sugg.badge || (line.decisionReason === 'MULTI_PROVIDER_CONSENSUS' ? 'Đề xuất tin cậy cao' : 'Gợi ý AI')}
                                </Text>
                              </View>
                            )}
                            {sugg.isAiConfirmed && (
                              <View style={styles.aiConfirmedBadge}>
                                <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                                <Text style={styles.aiConfirmedBadgeText}>AI xác nhận ✓</Text>
                              </View>
                            )}
                          </View>
                          <Text style={idx === 0 ? styles.sectionBText : styles.sectionGeminiText}>
                            {`"${sugg.text}"`}
                          </Text>
                          {/* Action buttons for suggestion */}
                          {sugg.isAiConfirmed ? (
                            <View style={styles.confirmedNoticeRow}>
                              <Ionicons name="checkmark-done" size={14} color="#16A34A" />
                              <Text style={styles.confirmedNoticeText}>AI đã kiểm tra và xác nhận nội dung chính xác</Text>
                            </View>
                          ) : (
                            line.verdict !== 'CORRECTED' && !isEditing && (
                              <View style={styles.suggestionActionRow}>
                                {idx === 0 ? (
                                  <TouchableOpacity
                                    style={styles.chooseGroqBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel="Chọn gợi ý 1"
                                    onPress={() => {
                                      handleFeedback(line, 'CORRECTED', sugg.text);
                                    }}
                                  >
                                    <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
                                    <Text style={styles.chooseGroqBtnText}>Dùng gợi ý 1</Text>
                                  </TouchableOpacity>
                                ) : (
                                  (geminiView.status === 'SUCCESS' || sugg.text) && (
                                    <TouchableOpacity
                                      style={styles.chooseGeminiBtn}
                                      accessibilityRole="button"
                                      accessibilityLabel="Chọn gợi ý 2"
                                      onPress={() => {
                                        handleFeedback(line, 'CORRECTED', geminiView.text);
                                      }}
                                    >
                                      <Ionicons name="sparkles" size={15} color="#FFFFFF" />
                                      <Text style={styles.chooseGeminiBtnText}>Dùng gợi ý 2</Text>
                                    </TouchableOpacity>
                                  )
                                )}
                              </View>
                            )
                          )}
                          {(sugg.decision === 'AUTO_APPLY' || line.correctionApplied) && line.verdict !== 'CORRECTED' && !isEditing && (
                            <View style={styles.autoApplyActionRow}>
                              <TouchableOpacity
                                style={styles.revertToRawBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Quay về OCR gốc"
                                onPress={() => handleFeedback(line, 'CORRECT', ocrText)}
                              >
                                <Text style={styles.revertToRawText}>Quay về OCR gốc</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ))
                    )
                  );
                })()}

                {/* Section C: Current Result strictly from resolveLineDisplayState */}
                <View style={styles.sectionCBox}>
                  <View style={styles.sectionCHeaderRow}>
                    <Text style={styles.sectionCLabel}>KẾT QUẢ HIỆN TẠI:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[
                        styles.sourceBadge,
                        (selectedSource === 'MANUAL_EDIT' || selectedSource === 'manual_edit') && styles.sourceBadgeManual,
                        (selectedSource.toLowerCase().startsWith('suggestion')) && styles.sourceBadgeSuggestion,
                        (selectedSource === 'OCR' || selectedSource === 'ocr') && styles.sourceBadgeOcr,
                      ]}>
                        <Text style={styles.sourceBadgeText}>
                          {selectedSource === 'MANUAL_EDIT' || selectedSource === 'manual_edit'
                            ? '✎ Đã tự sửa'
                            : selectedSource === 'SUGGESTION_1' || selectedSource === 'suggestion_1'
                            ? 'Gợi ý 1'
                            : selectedSource === 'SUGGESTION_2' || selectedSource === 'suggestion_2'
                            ? 'Gợi ý 2'
                            : 'OCR gốc'}
                        </Text>
                      </View>
                      {isAiConfirmed && (
                        <View style={styles.aiConfirmedBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                          <Text style={styles.aiConfirmedBadgeText}>AI xác nhận</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.sectionCText}>
                    {currentText ? `"${currentText}"` : '(Trống)'}
                  </Text>
                </View>

                {/* Inline Editing Form */}
                {isEditing ? (
                  <View style={styles.editForm}>
                    <Text style={styles.editFormLabel}>Tự sửa nội dung cho dòng này:</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editText}
                      onChangeText={setEditText}
                      placeholder="Nhập nội dung đúng..."
                      placeholderTextColor={COLORS.textMuted}
                      autoFocus
                    />
                    <View style={styles.editActionRow}>
                      <TouchableOpacity
                        style={styles.cancelEditBtn}
                        onPress={() => setEditingLineId(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Hủy chỉnh sửa"
                      >
                        <Text style={styles.cancelEditBtnText}>Hủy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.saveEditBtn, isSubmitting && { opacity: 0.6 }]}
                        disabled={isSubmitting}
                        onPress={() => handleFeedback(line, 'CORRECTED', editText)}
                        accessibilityRole="button"
                        accessibilityLabel="Lưu và xác nhận"
                      >
                        {isSubmitting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.saveEditBtnText}>Lưu & Xác nhận</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* Action Row */
                  <View style={styles.actionContainer}>
                    <View style={styles.feedbackRow}>
                      <TouchableOpacity
                        style={[
                          styles.fbBtn,
                          styles.fbCorrectBtn,
                          line.verdict === 'CORRECT' && styles.fbBtnActive,
                        ]}
                        disabled={isSubmitting}
                        onPress={() => handleFeedback(line, 'CORRECT')}
                        accessibilityRole="button"
                        accessibilityLabel="Xác nhận dòng này đúng"
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={line.verdict === 'CORRECT' ? '#FFFFFF' : '#16A34A'}
                        />
                        <Text
                          style={[
                            styles.fbBtnText,
                            { color: line.verdict === 'CORRECT' ? '#FFFFFF' : '#16A34A' },
                          ]}
                        >
                          Xác nhận dòng
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.fbBtn,
                          styles.fbEditBtn,
                          line.verdict === 'CORRECTED' && styles.fbBtnActiveBlue,
                        ]}
                        disabled={isSubmitting}
                        onPress={() => startEditLine(line)}
                        accessibilityRole="button"
                        accessibilityLabel="Tự sửa chữ của dòng này"
                      >
                        <Ionicons
                          name="pencil"
                          size={16}
                          color={line.verdict === 'CORRECTED' ? '#FFFFFF' : '#2563EB'}
                        />
                        <Text
                          style={[
                            styles.fbBtnText,
                            { color: line.verdict === 'CORRECTED' ? '#FFFFFF' : '#2563EB' },
                          ]}
                        >
                          Tự sửa
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.fbBtn, styles.fbSkipBtn]}
                        disabled={isSubmitting}
                        onPress={() => handleFeedback(line, 'CORRECT', ocrText)}
                        accessibilityRole="button"
                        accessibilityLabel="Giữ OCR gốc"
                      >
                        <Ionicons name="shield-checkmark-outline" size={15} color="#475569" />
                        <Text style={[styles.fbBtnText, { color: '#475569' }]}>Giữ OCR gốc</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        );
      })}

      {/* Confident Bottom Actions */}
      <View style={styles.bottomContainer}>
        {isHandAI && (
          <TouchableOpacity
            style={styles.trialAnalyticsBtn}
            onPress={async () => {
              if (trial) {
                await handAiAnalyticsStore.completeTrial(trial);
                router.push({
                  pathname: '/handai-trial-analytics' as any,
                  params: { trialId: trial.trialId },
                });
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="View Trial Analytics"
          >
            <Ionicons name="analytics" size={18} color="#FFFFFF" />
            <Text style={styles.trialAnalyticsBtnText}>View Trial Analytics</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={async () => {
            if (isHandAI && trial) {
              await handAiAnalyticsStore.completeTrial(trial);
            }
            Alert.alert(
              isHandAI ? 'Evaluation Complete' : 'Thành công',
              isHandAI
                ? 'All handwriting lines confirmed! View session analytics or finish.'
                : 'Đã xác nhận toàn bộ các dòng chữ!',
              isHandAI
                ? [
                    {
                      text: 'View Trial Analytics',
                      onPress: () =>
                        router.push({
                          pathname: '/handai-trial-analytics' as any,
                          params: { trialId: trial?.trialId },
                        }),
                    },
                    {
                      text: 'Done',
                      onPress: () => router.replace('/(tabs)' as any),
                    },
                  ]
                : [{ text: 'Xong', onPress: () => router.replace('/(tabs)' as any) }]
            );
          }}
          accessibilityRole="button"
          accessibilityLabel={isHandAI ? 'Confirm All' : 'Xác nhận toàn bộ'}
        >
          <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
          <Text style={styles.doneBtnText}>
            {isHandAI ? 'Confirm All' : 'Xác nhận toàn bộ'}
          </Text>
        </TouchableOpacity>

        {isHandAI && (
          <TouchableOpacity
            style={styles.analyticsBtn}
            onPress={() => router.push('/handai-analytics' as any)}
            accessibilityRole="button"
            accessibilityLabel="View Global Analytics"
          >
            <Ionicons name="stats-chart" size={18} color="#FFFFFF" />
            <Text style={styles.analyticsBtnText}>View Global Analytics</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.secondaryDoneBtn}
          onPress={() => router.replace('/(tabs)' as any)}
          accessibilityRole="button"
          accessibilityLabel={isHandAI ? 'Process Another Image' : 'Nhận diện ảnh khác'}
        >
          <Ionicons name="camera-outline" size={18} color={COLORS.primary} />
          <Text style={styles.secondaryDoneBtnText}>
            {isHandAI ? 'Process Another Image' : 'Nhận diện ảnh khác'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: SIZES.medium,
    paddingTop: 52,
    paddingBottom: 40,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: COLORS.errorText,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#1E40AF',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  joinedTextBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  joinedText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1E293B',
  },
  sectionHeadingContainer: {
    marginBottom: 12,
    marginLeft: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },

  /* Line Card - Gauth/Gauss-Inspired Soft Card */
  lineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  lineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  lineOrderBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  lineOrderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionSubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  /* Section A: OCR Gốc (Clean, Quiet Surface) */
  sectionABox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionALabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  confidenceBadge: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  sectionAText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },

  /* Section B: Deduplicated Suggestions */
  sectionBBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  sectionBLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  sectionBText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#78350F',
    marginBottom: 8,
  },
  sectionGeminiBox: {
    backgroundColor: '#FAF5FF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3E8FF',
  },
  sectionGeminiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
    letterSpacing: 0.5,
  },
  sectionGeminiText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#581C87',
    marginBottom: 6,
  },
  chooseGroqBtn: {
    backgroundColor: '#D97706',
    borderRadius: 10,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  chooseGroqBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chooseGeminiBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  chooseGeminiBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  advisorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiConfirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginVertical: 4,
    gap: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  aiConfirmedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803D',
  },
  providerOutageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginVertical: 4,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  providerOutageText: {
    fontSize: 13,
    color: '#64748B',
  },
  autoApplyBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  autoApplyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  suggestionActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  autoApplyActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  revertToRawBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  revertToRawText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },

  /* Section C: Current Result (Prominent & Clear) */
  sectionCBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
  },
  sectionCHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionCLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#DBEAFE',
  },
  sourceBadgeManual: {
    backgroundColor: '#EDE9FE',
  },
  sourceBadgeSuggestion: {
    backgroundColor: '#DCFCE7',
  },
  sourceBadgeOcr: {
    backgroundColor: '#F1F5F9',
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
  },
  sectionCText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A8A',
  },

  /* Inline Editing Form */
  editForm: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  editFormLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  editInput: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  editActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelEditBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  cancelEditBtnText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  saveEditBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  saveEditBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Action Row */
  actionContainer: {
    marginTop: 4,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  fbBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  fbCorrectBtn: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  fbEditBtn: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  fbSkipBtn: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  fbBtnActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  fbBtnActiveBlue: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  fbBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* Bottom Actions */
  bottomContainer: {
    marginTop: 8,
    marginBottom: 32,
    gap: 10,
  },
  trialAnalyticsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    ...SHADOWS.small,
  },
  trialAnalyticsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  analyticsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#123B7A',
    ...SHADOWS.small,
  },
  analyticsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    ...SHADOWS.small,
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  secondaryDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },

  /* Diagnostic / Preserved Tokens for Tests */
  providerChipGroq: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  providerChipGroqText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  providerChipGemini: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  providerChipGeminiText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6D28D9',
  },
  providerChipCrnn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  providerChipCrnnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  unavailableText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginVertical: 0,
  },
  agreementBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  agreementBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  aiConfirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
    gap: 4,
  },
  aiConfirmedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  confirmedNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 4,
  },
  confirmedNoticeText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '500',
  },
  // HandAI Research Demo V4 line card styles
  researchLineCardContent: {
    gap: 10,
    marginTop: 6,
  },
  confidencePill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  confidencePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  lineHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  researchFieldHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // 1. Raw OCR Block (Neutral Gray)
  researchOcrBlock: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  researchOcrLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  researchOcrText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  // 2. AI Suggestion Block (Soft Amber)
  researchSuggBlock: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  researchSuggLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  researchSuggText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#78350F',
  },
  // 3. Final Result Block (Strong Blue)
  researchResultBlock: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  researchResultLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  researchResultText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  // 4. Decision Reason Block (Small Explanation Block)
  researchReasonBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  researchReasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  researchReasonText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  // Legacy mappings for backwards-compatibility
  researchFieldGroup: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  researchFieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  researchFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  researchFieldText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  researchSourceChip: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  researchSourceChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  researchActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  researchActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  researchKeepOcrBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  researchKeepOcrBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  researchUseAiBtn: {
    backgroundColor: '#1E40AF',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  researchUseAiBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  researchEditBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flex: 0.7,
  },
  researchEditBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
  },
});
