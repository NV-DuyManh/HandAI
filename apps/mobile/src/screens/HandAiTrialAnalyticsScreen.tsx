import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ComparisonCard,
  ErrorInsightCard,
  MetricCard,
  PerformanceCard,
  ReportCard,
  SectionHeader,
  StatusBadge,
  type DetectedErrorItem,
} from '../components/report';
import { AppHeader } from '../components/ui/AppHeader';
import {
  handAiAnalyticsStore,
  type ErrorType,
  type LineMetric,
  type RecognitionSession,
} from '../services/analytics/handAiAnalyticsStore';
import { buildHandAiDashboardMetrics } from '../services/analytics/handAiDashboardMetrics';
import { formatMetricPercent, formatSeconds } from '../utils/metricFormat';

const PRIMARY_COLOR = '#1D4ED8';

const ERROR_LABELS: Record<ErrorType, string> = {
  NO_ERROR: 'No Error',
  MISSING_CHARACTER: 'Missing Character Error',
  EXTRA_CHARACTER: 'Extra Character Error',
  VIETNAMESE_TONE_ERROR: 'Vietnamese Tone Error',
  SIMILAR_CHARACTER_CONFUSION: 'Similar Character Confusion',
  WORD_SUBSTITUTION: 'Word Substitution',
  LOW_IMAGE_QUALITY: 'Image Quality Issue',
  SEGMENTATION_FAILURE: 'Segmentation Failure',
};

const ERROR_COLORS: Record<ErrorType, string> = {
  NO_ERROR: '#059669',
  MISSING_CHARACTER: '#DC2626',
  EXTRA_CHARACTER: '#DC2626',
  VIETNAMESE_TONE_ERROR: '#D97706',
  SIMILAR_CHARACTER_CONFUSION: '#7C3AED',
  WORD_SUBSTITUTION: '#7C3AED',
  LOW_IMAGE_QUALITY: '#64748B',
  SEGMENTATION_FAILURE: '#B91C1C',
};

const isVerifiedLine = (line: LineMetric): boolean =>
  line.evaluationStatus === 'EVALUATED' &&
  (line.groundTruthStatus === 'EXPLICIT' || line.groundTruthStatus === 'USER_CONFIRMED') &&
  line.groundTruth.trim().length > 0;

const getRawText = (line: LineMetric): string =>
  (line.ocrOutput || line.modelOutput || line.ocrText || '').trim();

const getSuggestedText = (line: LineMetric): string =>
  (line.aiCandidate || line.aiSuggestion || '').trim();

const getFinalText = (line: LineMetric): string =>
  (line.finalResult || line.finalText || line.text || '').trim();

const optionalPercent = (value: number | null): string =>
  value === null ? '—' : formatMetricPercent(value);

const signedPercent = (value: number | null): string =>
  value === null ? '—' : formatMetricPercent(value, { withSign: true });

function buildDetectedErrors(session: RecognitionSession): DetectedErrorItem[] {
  const measuredLines = (session.lineMetrics || []).filter(isVerifiedLine);
  const lineErrors = measuredLines
    .filter((line) => line.errorAnalysis && line.errorAnalysis.errorType !== 'NO_ERROR')
    .map((line, index) => {
      const analysis = line.errorAnalysis!;
      const pair = analysis.characterPairs?.[0];
      return {
        id: `${line.lineId}-${index}`,
        errorType: ERROR_LABELS[analysis.errorType],
        originalText: getRawText(line) || undefined,
        suggestedText: getFinalText(line) || getSuggestedText(line) || undefined,
        characterSnippet: pair
          ? `${pair.wrongCharacter} → ${pair.correctCharacter}`
          : undefined,
        explanation: analysis.examples?.filter(Boolean).join(' · ') || undefined,
        color: ERROR_COLORS[analysis.errorType],
      };
    });

  if (lineErrors.length > 0) return lineErrors;

  return (session.errorRecords || []).map((error, index) => ({
    id: error.id || `${error.lineId}-${index}`,
    errorType: ERROR_LABELS[error.errorType],
    originalText: error.wrongText,
    suggestedText: error.groundTruthText,
    characterSnippet:
      error.wrongCharacter && error.correctCharacter
        ? `${error.wrongCharacter} → ${error.correctCharacter}`
        : undefined,
    color: ERROR_COLORS[error.errorType],
  }));
}

function DataUnavailable({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.unavailableBox}>
      <Ionicons name="information-circle-outline" size={18} color="#64748B" />
      <Text style={styles.unavailableText}>{children}</Text>
    </View>
  );
}

function PipelineStep({
  label,
  title,
  value,
  tone,
}: {
  label: string;
  title: string;
  value: string;
  tone: 'raw' | 'ai' | 'final' | 'reference';
}) {
  const palette = {
    raw: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', badge: '#EFF6FF', badgeText: '#1D4ED8' },
    ai: { bg: '#FAF5FF', border: '#DDD6FE', text: '#6D28D9', badge: '#F5F3FF', badgeText: '#6D28D9' },
    final: { bg: '#F0FDF4', border: '#A7F3D0', text: '#047857', badge: '#ECFDF5', badgeText: '#047857' },
    reference: { bg: '#F8FAFC', border: '#CBD5E1', text: '#334155', badge: '#F1F5F9', badgeText: '#334155' },
  }[tone];

  return (
    <View style={styles.pipelineStep}>
      <View style={styles.pipelineHeader}>
        <View style={[styles.pipelineBadge, { backgroundColor: palette.badge, borderColor: palette.border }]}>
          <Text style={[styles.pipelineBadgeText, { color: palette.badgeText }]}>{label}</Text>
        </View>
        <Text style={styles.pipelineTitle}>{title}</Text>
      </View>
      <View style={[styles.pipelineValueBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <Text style={[styles.pipelineValue, { color: palette.text }]}>{value}</Text>
      </View>
    </View>
  );
}

export default function HandAiTrialAnalyticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ trialId?: string; sessionId?: string }>();
  const activeId = params.trialId || params.sessionId;
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<RecognitionSession | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await handAiAnalyticsStore.init();
        const liveSessions = handAiAnalyticsStore
          .getSessions()
          .filter(
            (item) =>
              item.status === 'COMPLETED' &&
              item.isSampleData !== true &&
              item.totalLines > 0
          );
        const matched = activeId
          ? liveSessions.find((item) => item.sessionId === activeId)
          : liveSessions[0];

        if (active) {
          setSession(matched || null);
          setImageFailed(false);
        }
      } catch (error) {
        console.warn('[HandAI Trial Detail] Failed to load stored session:', error);
        if (active) setSession(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [activeId]);

  const metrics = useMemo(
    () => buildHandAiDashboardMetrics(session ? [session] : []),
    [session]
  );

  const verifiedLines = useMemo(
    () => (session?.lineMetrics || []).filter(isVerifiedLine),
    [session]
  );

  const previewLine = useMemo(() => {
    const lines = session?.lineMetrics || [];
    return (
      lines.find((line) => {
        const raw = getRawText(line);
        const suggested = getSuggestedText(line);
        const finalText = getFinalText(line);
        return raw.length > 0 && (suggested !== raw || finalText !== raw);
      }) || lines.find((line) => getRawText(line).length > 0) || null
    );
  }, [session]);

  const detectedErrors = useMemo(
    () => (session ? buildDetectedErrors(session) : []),
    [session]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader title="Recognition Detail" subtitle="Stored session evidence" showBack />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading stored recognition data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader title="Recognition Detail" subtitle="Stored session evidence" showBack />
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No live session data</Text>
          <Text style={styles.emptySubtitle}>
            This entry has no stored non-sample recognition result. Run a new recognition or choose a live entry from History.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)' as never)}
            accessibilityRole="button"
            accessibilityLabel="Return to scanner"
          >
            <Text style={styles.primaryButtonText}>Scan New Image</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const imageUri = session.imageUri || session.imageThumbnailUri || session.thumbnailUri;
  const rawText = previewLine ? getRawText(previewLine) : '';
  const suggestedText = previewLine ? getSuggestedText(previewLine) : '';
  const finalText = previewLine ? getFinalText(previewLine) : '';
  const hasSuggestion = suggestedText.length > 0 && suggestedText !== rawText;
  const hasFinal = finalText.length > 0;
  const hasVerifiedReference = previewLine ? isVerifiedLine(previewLine) : false;
  const errorAnalysisAvailable =
    verifiedLines.some((line) => Boolean(line.errorAnalysis)) ||
    (session.errorRecords?.length || 0) > 0;
  const timestamp = new Date(session.timestamp);
  const validTimestamp = Number.isFinite(timestamp.getTime());
  const recordedFramework = [session.ocrEngine, session.aiEngine].filter(Boolean).join(' + ');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Recognition Detail"
        subtitle={session.formattedSessionId || 'Stored live session'}
        showBack
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, isWide && styles.contentWide]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mainWrapper, isWide && styles.mainWrapperWide]}>
          <ReportCard style={styles.card} testID="original-image-preview-section">
            <View style={styles.titleRow}>
              <View style={styles.titleWithIcon}>
                <Ionicons name="image-outline" size={19} color={PRIMARY_COLOR} />
                <Text style={styles.cardTitle}>Recognition Input Image</Text>
              </View>
              <StatusBadge label="Stored Session" variant="blue" />
            </View>

            {imageUri && !imageFailed ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.originalImage}
                resizeMode="contain"
                onError={() => setImageFailed(true)}
                accessibilityLabel="Input image used for this recognition session"
              />
            ) : (
              <DataUnavailable>
                The input image was not retained for this session. No replacement preview is generated.
              </DataUnavailable>
            )}

            <View style={styles.metaPanel}>
              <View style={styles.metaHeadingRow}>
                <Text style={styles.metaHeading}>Session Overview</Text>
                <StatusBadge label="Live Data" variant="green" showDot />
              </View>
              <View style={styles.grid}>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>RECOGNITION ENTRY</Text>
                  <Text style={styles.value} numberOfLines={1}>
                    {session.formattedSessionId || session.sessionId}
                  </Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>DURATION</Text>
                  <Text style={styles.value}>
                    {formatSeconds(session.processingTimeSeconds, '—')}
                  </Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>IMAGE INFO</Text>
                  <Text style={styles.value}>{session.imageResolution || 'Not recorded'}</Text>
                </View>
                <View style={[styles.gridItem, styles.gridItemFull]}>
                  <Text style={styles.label}>MODEL USED</Text>
                  <Text style={styles.value}>{session.modelVersion || 'Not recorded'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.scopePanel} testID="evaluation-scope-section">
              <View style={styles.metaHeadingRow}>
                <Text style={[styles.metaHeading, { color: '#6D28D9' }]}>Evaluation Scope</Text>
                <StatusBadge label="Single Stored Session" variant="purple" />
              </View>
              <View style={styles.grid}>
                <View style={[styles.gridItem, styles.scopeItem]}>
                  <Text style={[styles.label, styles.scopeLabel]}>PROCESSED LINES</Text>
                  <Text style={styles.value}>{session.totalLines}</Text>
                </View>
                <View style={[styles.gridItem, styles.scopeItem]}>
                  <Text style={[styles.label, styles.scopeLabel]}>VERIFIED REFERENCE LINES</Text>
                  <Text style={styles.value}>{metrics.evaluatedLines}</Text>
                </View>
                <View style={[styles.gridItem, styles.gridItemFull, styles.scopeItem]}>
                  <Text style={[styles.label, styles.scopeLabel]}>EVALUATION BASIS</Text>
                  <Text style={styles.value}>
                    {metrics.hasEvaluatedLines
                      ? 'Stored explicit or user-confirmed reference text'
                      : 'No verified reference text stored'}
                  </Text>
                </View>
              </View>
            </View>
          </ReportCard>

          <ReportCard testID="recognition-pipeline-section">
            <SectionHeader
              label="RECORDED OUTPUT"
              title="Recognition Transformation"
              description="Text below is copied from one stored line in this recognition session."
            />

            {previewLine && rawText ? (
              <View style={styles.pipeline}>
                <PipelineStep label="STEP 1" title="Raw OCR output" value={rawText} tone="raw" />
                {hasSuggestion ? (
                  <>
                    <Ionicons name="arrow-down" size={17} color="#94A3B8" style={styles.arrow} />
                    <PipelineStep label="STEP 2" title="Stored AI suggestion" value={suggestedText} tone="ai" />
                  </>
                ) : null}
                {hasFinal ? (
                  <>
                    <Ionicons name="arrow-down" size={17} color="#94A3B8" style={styles.arrow} />
                    <PipelineStep
                      label={hasSuggestion ? 'STEP 3' : 'STEP 2'}
                      title="Selected final result"
                      value={finalText}
                      tone="final"
                    />
                  </>
                ) : null}
                {hasVerifiedReference ? (
                  <>
                    <Ionicons name="arrow-down" size={17} color="#94A3B8" style={styles.arrow} />
                    <PipelineStep
                      label="REFERENCE"
                      title={
                        previewLine.groundTruthStatus === 'EXPLICIT'
                          ? 'Explicit reference text'
                          : 'User-confirmed reference text'
                      }
                      value={previewLine.groundTruth}
                      tone="reference"
                    />
                  </>
                ) : (
                  <DataUnavailable>
                    This line has no verified reference, so accuracy claims are not calculated from it.
                  </DataUnavailable>
                )}
              </View>
            ) : (
              <DataUnavailable>No stored line-level text is available for this session.</DataUnavailable>
            )}

            {metrics.hasEvaluatedLines ? (
              <ComparisonCard
                rawBaselineLabel="RAW OCR EXACT-MATCH"
                rawBaselineValue={optionalPercent(metrics.rawAccuracy)}
                aiContributionLabel="FINAL WORKFLOW CHANGE"
                aiContributionValue={signedPercent(metrics.aiGain)}
                verifiedResultLabel="FINAL EXACT-MATCH"
                verifiedResultValue={optionalPercent(metrics.finalAccuracy)}
                verifiedBadge={`${metrics.evaluatedLines} verified line${metrics.evaluatedLines === 1 ? '' : 's'}`}
                gainBadge={signedPercent(metrics.aiGain)}
                note="Computed only from stored lines with explicit or user-confirmed reference text. The final result may include AI assistance or manual review."
                beforeTitle="Raw OCR"
                beforeValue={optionalPercent(metrics.rawAccuracy)}
                afterTitle="Selected final result"
                afterValue={optionalPercent(metrics.finalAccuracy)}
              />
            ) : (
              <DataUnavailable>
                No verified before-and-after comparison is available for this session.
              </DataUnavailable>
            )}
          </ReportCard>

          <ReportCard testID="performance-metrics-section">
            <SectionHeader
              label="MEASURED PERFORMANCE"
              title="Session Metrics"
              description="Metrics are recalculated from the stored line results and verified reference text."
              rightElement={
                <StatusBadge
                  label={metrics.hasEvaluatedLines ? 'Verified Lines' : 'Awaiting Verification'}
                  variant={metrics.hasEvaluatedLines ? 'green' : 'neutral'}
                />
              }
            />

            <PerformanceCard
              value={optionalPercent(metrics.finalAccuracy)}
              title="Final Exact-Match Accuracy"
              description={
                metrics.hasEvaluatedLines
                  ? `Exact matches across ${metrics.evaluatedLines} verified line${metrics.evaluatedLines === 1 ? '' : 's'}.`
                  : 'Unavailable until reference text is explicitly provided or confirmed.'
              }
              categoryTag="SESSION RESULT"
              badgeLabel={metrics.hasEvaluatedLines ? 'Calculated' : 'Unavailable'}
              badgeVariant={metrics.hasEvaluatedLines ? 'green' : 'neutral'}
            />

            <View style={styles.metricsGrid}>
              <MetricCard
                value={optionalPercent(metrics.rawAccuracy)}
                title="Raw Line Accuracy"
                explanation="Raw OCR exact matches on verified lines"
                color="blue"
                icon="scan-outline"
                categoryTag="RAW OCR"
                style={styles.metricCard}
              />
              <MetricCard
                value={optionalPercent(metrics.finalAccuracy)}
                title="Final Line Accuracy"
                explanation="Selected final text exact matches on verified lines"
                color="green"
                icon="checkmark-circle-outline"
                categoryTag="FINAL"
                style={styles.metricCard}
              />
              <MetricCard
                value={optionalPercent(metrics.characterAccuracy)}
                title="Raw Character Accuracy"
                explanation="100 − CER, calculated against stored reference text"
                color="blue"
                icon="text-outline"
                categoryTag="CHARACTER"
                style={styles.metricCard}
              />
              <MetricCard
                value={optionalPercent(metrics.wordAccuracy)}
                title="Raw Word Accuracy"
                explanation="100 − WER, calculated against stored reference text"
                color="orange"
                icon="document-text-outline"
                categoryTag="WORD"
                style={styles.metricCard}
              />
              <MetricCard
                value={optionalPercent(metrics.averageConfidence)}
                title="Average Confidence"
                explanation="Mean stored model confidence on verified lines"
                color="purple"
                icon="speedometer-outline"
                categoryTag="CONFIDENCE"
                style={styles.metricCard}
              />
              <MetricCard
                value={formatSeconds(metrics.averageLatencySeconds, '—')}
                title="Processing Time"
                explanation="Recorded duration for this recognition session"
                color="blue"
                icon="timer-outline"
                categoryTag="LATENCY"
                style={styles.metricCard}
              />
            </View>

            <View style={styles.countStrip}>
              <View style={styles.countItem}>
                <Text style={styles.countLabel}>Raw correct</Text>
                <Text style={styles.countValue}>{metrics.rawCorrectLines}</Text>
              </View>
              <View style={styles.countDivider} />
              <View style={styles.countItem}>
                <Text style={styles.countLabel}>AI-assisted</Text>
                <Text style={styles.countValue}>{metrics.aiAssistedLines}</Text>
              </View>
              <View style={styles.countDivider} />
              <View style={styles.countItem}>
                <Text style={styles.countLabel}>Manual edits</Text>
                <Text style={styles.countValue}>{metrics.manualEditedLines}</Text>
              </View>
            </View>
          </ReportCard>

          <ReportCard testID="error-insights-section">
            <SectionHeader
              label="RECORDED ERROR EVIDENCE"
              title="Recognition Error Insights"
              description="Only error records produced from verified lines in this session are shown."
              rightElement={
                <StatusBadge
                  label={errorAnalysisAvailable ? `${detectedErrors.length} Recorded` : 'Unavailable'}
                  variant={detectedErrors.length > 0 ? 'orange' : 'neutral'}
                />
              }
            />

            {errorAnalysisAvailable ? (
              <ErrorInsightCard
                title="Session Error Records"
                subtitle="Derived from this session's stored line analysis"
                errors={detectedErrors}
              />
            ) : (
              <DataUnavailable>
                No line-level error analysis was stored for this session. Error categories are not inferred.
              </DataUnavailable>
            )}
          </ReportCard>

          <ReportCard style={styles.card} testID="technical-info-section">
            <View style={styles.titleRow}>
              <View style={styles.titleWithIcon}>
                <Ionicons name="hardware-chip-outline" size={19} color="#6D28D9" />
                <View>
                  <Text style={styles.cardTitle}>Technical Information</Text>
                  <Text style={styles.cardSubtitle}>Metadata stored with this session</Text>
                </View>
              </View>
              <StatusBadge label="Recorded Metadata" variant="purple" />
            </View>

            <View style={styles.techTable}>
              {[
                ['Model version', session.modelVersion || 'Not recorded'],
                ['Dataset version', session.datasetVersion || 'Not recorded'],
                ['Timestamp', validTimestamp ? timestamp.toLocaleString('vi-VN') : 'Not recorded'],
                [
                  'Evaluation method',
                  metrics.hasEvaluatedLines
                    ? 'Stored reference comparison'
                    : 'No verified reference comparison',
                ],
                ['Evaluation unit', 'Handwriting lines'],
                ['Recognition engines', recordedFramework || 'Not recorded'],
                ['Experiment ID', session.experimentId || 'Not recorded'],
              ].map(([key, value], index, rows) => (
                <View
                  key={key}
                  style={[styles.techRow, index === rows.length - 1 && styles.techRowLast]}
                >
                  <Text style={styles.techKey}>{key}</Text>
                  <Text style={styles.techValue}>{value}</Text>
                </View>
              ))}
            </View>
          </ReportCard>

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push('/evaluation-history' as never)}
            accessibilityRole="button"
            accessibilityLabel="View recognition history"
          >
            <Ionicons name="time-outline" size={17} color="#475569" />
            <Text style={styles.historyButtonText}>View Recognition History</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48, alignItems: 'center' },
  contentWide: { paddingHorizontal: 24 },
  mainWrapper: { width: '100%', maxWidth: 430 },
  mainWrapperWide: { maxWidth: 680 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748B' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 19, fontWeight: '700', color: '#0F172A', marginTop: 14, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, lineHeight: 20, color: '#64748B', textAlign: 'center', marginBottom: 22 },
  primaryButton: { backgroundColor: PRIMARY_COLOR, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  card: { padding: 16, marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 13 },
  titleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cardSubtitle: { fontSize: 11, color: '#64748B', marginTop: 1 },
  originalImage: { width: '100%', height: 220, borderRadius: 14, backgroundColor: '#F1F5F9', marginBottom: 13 },
  unavailableBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 13, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', marginVertical: 8 },
  unavailableText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#475569' },
  metaPanel: { backgroundColor: '#F8FAFC', borderRadius: 13, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, marginBottom: 10 },
  scopePanel: { backgroundColor: '#FAF5FF', borderRadius: 13, borderWidth: 1, borderColor: '#DDD6FE', padding: 12 },
  metaHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 },
  metaHeading: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: { width: '48.5%', flexGrow: 1, backgroundColor: '#FFFFFF', borderRadius: 9, borderWidth: 1, borderColor: '#E2E8F0', padding: 9 },
  gridItemFull: { width: '100%' },
  scopeItem: { borderColor: '#E9D5FF' },
  label: { fontSize: 10, fontWeight: '700', color: '#64748B', marginBottom: 3 },
  scopeLabel: { color: '#7C3AED' },
  value: { fontSize: 12, lineHeight: 17, fontWeight: '700', color: '#1E293B' },
  pipeline: { marginTop: 4, marginBottom: 12 },
  pipelineStep: { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 12 },
  pipelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  pipelineBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pipelineBadgeText: { fontSize: 10, fontWeight: '800' },
  pipelineTitle: { flex: 1, textAlign: 'right', fontSize: 11, fontWeight: '700', color: '#475569' },
  pipelineValueBox: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9 },
  pipelineValue: { fontSize: 14, lineHeight: 20, fontFamily: 'monospace', fontWeight: '600' },
  arrow: { alignSelf: 'center', marginVertical: 5 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  metricCard: { width: '48.5%', flexGrow: 1, marginBottom: 0 },
  countStrip: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 11, marginTop: 12 },
  countItem: { flex: 1, alignItems: 'center', paddingHorizontal: 5 },
  countLabel: { fontSize: 10, color: '#64748B', textAlign: 'center' },
  countValue: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 3 },
  countDivider: { width: 1, backgroundColor: '#E2E8F0' },
  techTable: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12 },
  techRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  techRowLast: { borderBottomWidth: 0 },
  techKey: { width: '38%', fontSize: 12, fontWeight: '600', color: '#475569' },
  techValue: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700', color: '#1E293B', textAlign: 'right' },
  historyButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 11, marginTop: 4 },
  historyButtonText: { fontSize: 13, fontWeight: '700', color: '#475569' },
});
