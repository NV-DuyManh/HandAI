import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/ui/AppHeader';
import {
  MetricCard,
  ReportCard,
  SectionHeader,
  StatusBadge,
} from '../components/report';
import { handAiAnalyticsStore } from '../services/analytics/handAiAnalyticsStore';
import { buildHandAiDashboardMetrics } from '../services/analytics/handAiDashboardMetrics';
import { formatMetricPercent, formatSeconds } from '../utils/metricFormat';

const formatOptionalPercent = (value: number | null): string =>
  value === null ? '—' : formatMetricPercent(value);

// -------------------------------------------------------------
// SEMANTIC ACADEMIC DESIGN TOKENS (APPLE HIG + DEEPMIND)
// -------------------------------------------------------------
export const REPORT_THEME = {
  // Semantic Colors
  blue: '#2563EB',
  blueDark: '#1D4ED8',
  blueSurface: '#EFF6FF',
  blueBorder: '#BFDBFE',

  emerald: '#059669',
  emeraldDark: '#047857',
  emeraldSurface: '#ECFDF5',
  emeraldBorder: '#A7F3D0',

  purple: '#7C3AED',
  purpleDark: '#6D28D9',
  purpleSurface: '#F5F3FF',
  purpleBorder: '#DDD6FE',

  amber: '#D97706',
  amberDark: '#B45309',
  amberSurface: '#FFFBEB',
  amberBorder: '#FDE68A',

  red: '#DC2626',
  redDark: '#B91C1C',
  redSurface: '#FEF2F2',
  redBorder: '#FECACA',

  // Canvas & Surfaces
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  cardBorder: '#E2E8F0',

  // Typography
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',

  divider: '#F1F5F9',
};

export default function HandAiAnalyticsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();

  const isWide = width >= 768;

  const [dashboardMetrics, setDashboardMetrics] = useState(() =>
    buildHandAiDashboardMetrics([])
  );

  const loadDashboardData = useCallback(async () => {
    await handAiAnalyticsStore.init();
    setDashboardMetrics(buildHandAiDashboardMetrics(handAiAnalyticsStore.getSessions()));
  }, []);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (active) setDashboardMetrics(buildHandAiDashboardMetrics(handAiAnalyticsStore.getSessions()));
    };
    const unsubscribe = handAiAnalyticsStore.subscribe(update);
    void handAiAnalyticsStore.init().then(update);
    return () => { active = false; unsubscribe(); };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDashboardData();
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboardData]);

  const referenceSession = dashboardMetrics.sessions.find((session) =>
    session.lineMetrics?.some((line) => line.status !== 'Detection Failed'
      && (!line.groundTruth?.trim() || line.evaluationStatus !== 'EVALUATED'))
  ) || dashboardMetrics.sessions[0];


  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader title="Recognition Summary" showBack />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={[styles.mainWrapper, isWide && styles.mainWrapperWide]}>
          
          <ReportCard testID="performance-evaluation-section">
            <SectionHeader label="PAIRED EVALUATION" title="OCR vs AI Assistance"
              description="Compare OCR and recorded AI responses with the correct text read from the source image. Both columns use the same lines."
              rightElement={<StatusBadge label={dashboardMetrics.comparisonLines
                ? `${dashboardMetrics.comparisonLines} Paired Lines`
                : dashboardMetrics.hasEvaluatedLines ? 'AI response needed' : 'Not evaluated yet'} variant={dashboardMetrics.comparisonLines ? 'green' : 'neutral'} />} />
            {!dashboardMetrics.hasEvaluatedLines ? <View style={styles.referencePrompt} testID="reference-setup-prompt">
              <Text style={styles.referencePromptTitle}>{dashboardMetrics.hasLiveSessions ? 'Your recognition results are saved' : 'No recognition results yet'}</Text>
              <Text style={styles.referencePromptText}>{dashboardMetrics.hasLiveSessions
                ? `${dashboardMetrics.totalSessions} sessions · ${dashboardMetrics.totalImages} saved images · ${dashboardMetrics.totalLines} recognized lines · ${dashboardMetrics.confidenceLineCount} recorded OCR scores · ${dashboardMetrics.aiResponseLines} recorded AI responses.`
                : 'Recognize an image to record OCR output, AI responses and model scores.'}</Text>
              <Text style={styles.referencePromptText}>Review the current final text. Keep it if correct or edit only the wrong lines; the app will calculate accuracy from the reviewed results.</Text>
              <TouchableOpacity style={styles.referenceButton}
                accessibilityRole="button" accessibilityLabel={referenceSession ? 'Review final results from saved recognition' : 'Recognize a new image'}
                onPress={() => referenceSession
                  ? router.push({ pathname: '/handai-trial-analytics' as never, params: { trialId: referenceSession.sessionId, reviewReferences: '1' } })
                  : router.push('/(tabs)' as never)}>
                <Text style={styles.referenceButtonText}>{referenceSession ? 'Review final results' : 'Recognize an image'}</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View> : null}
            <View style={styles.supportingMetricsGrid}>
              <MetricCard value={dashboardMetrics.hasEvaluatedLines
                ? formatOptionalPercent(dashboardMetrics.comparisonLines ? dashboardMetrics.rawComparisonAccuracy : dashboardMetrics.rawAccuracy)
                : `${dashboardMetrics.totalLines}`}
                title={dashboardMetrics.hasEvaluatedLines ? 'Our OCR · CRNN' : 'OCR lines recorded'} color="blue" icon="scan-outline" categoryTag="BEFORE AI"
                explanation={dashboardMetrics.hasEvaluatedLines && dashboardMetrics.comparisonLines
                  ? `${dashboardMetrics.rawComparisonCorrectLines}/${dashboardMetrics.comparisonLines} paired reviewed lines matched`
                  : dashboardMetrics.hasEvaluatedLines
                    ? `${dashboardMetrics.rawCorrectLines}/${dashboardMetrics.evaluatedLines} reviewed lines matched · OCR baseline`
                    : `${dashboardMetrics.confidenceLineCount} lines include a real recorded OCR score`}
                style={styles.supportingColCard} testID="paired-raw-accuracy" />
              <MetricCard value={dashboardMetrics.hasEvaluatedLines
                ? formatOptionalPercent(dashboardMetrics.aiAccuracy)
                : `${dashboardMetrics.aiResponseLines}`}
                title={dashboardMetrics.hasEvaluatedLines ? 'After AI Assistance' : 'AI responses recorded'} color="green" icon="sparkles-outline" categoryTag="AFTER AI"
                explanation={dashboardMetrics.comparisonLines
                  ? `${dashboardMetrics.aiCorrectLines}/${dashboardMetrics.comparisonLines} reviewed lines matched · no manual edits`
                  : dashboardMetrics.hasEvaluatedLines ? 'No recorded AI response on reviewed lines' : `${dashboardMetrics.aiAssistedLines} AI selections · ${dashboardMetrics.manualEditedLines} manual edits`}
                style={styles.supportingColCard} testID="paired-ai-accuracy" />
            </View>
            <Text style={styles.noDataText}>
              {dashboardMetrics.comparisonLines > 0
                ? `${dashboardMetrics.comparisonLines} paired lines from ${dashboardMetrics.comparedImages} saved images across ${dashboardMetrics.comparedSessions} sessions. AI change: ${dashboardMetrics.aiGain! > 0 ? '+' : ''}${dashboardMetrics.aiGain} percentage points.`
                : dashboardMetrics.hasEvaluatedLines
                  ? 'OCR measurements are available. The AI column needs a recorded AI response on the same reviewed lines.'
                  : 'Activity above is available immediately. Accuracy appears after you review the final text.'}
            </Text>
            {dashboardMetrics.hasEvaluatedLines ? <View style={styles.evalGrid}>
              <Text style={styles.noDataText}>{dashboardMetrics.evaluatedLines} reviewed final lines. Raw OCR {formatOptionalPercent(dashboardMetrics.rawAccuracy)}. The reviewed final text is the evaluation target, so it is not reported as a separate accuracy claim.</Text>
              <Text style={styles.noDataText}>Raw CER {formatOptionalPercent(dashboardMetrics.cer)} · raw WER {formatOptionalPercent(dashboardMetrics.wer)}. These are local results, not overall model accuracy.</Text>
            </View> : <View testID="accuracy-awaiting-reference"><Text style={styles.noDataTitle}>Final text review needed for accuracy</Text></View>}
          </ReportCard>

          <ReportCard testID="dataset-statistics-section" delayMs={150}>
            <SectionHeader
              label="DATA EVIDENCE"
              title="Live Evaluation Overview"
              description="Counts and metrics from completed recognition sessions stored on this device."
              rightElement={
                <View style={styles.datasetBadgesGroup}>
                  <StatusBadge
                    label={dashboardMetrics.hasLiveSessions ? 'Live Sessions' : 'No Live Sessions'}
                    variant={dashboardMetrics.hasLiveSessions ? 'green' : 'neutral'}
                    showDot={dashboardMetrics.hasLiveSessions}
                  />
                  <StatusBadge label="Sample Data Excluded" variant="blue" />
                </View>
              }
            />

            <View style={styles.datasetInfoContainer}>
              <Text style={styles.datasetNameHeading}>On-device recognition history</Text>
              <Text style={styles.datasetTotalText}>
                {dashboardMetrics.totalImages} saved images · {dashboardMetrics.totalLines} processed lines · {dashboardMetrics.totalSessions} completed sessions
              </Text>

              {/* 2 Blocks: processed lines vs user-reviewed final text */}
              <View style={styles.datasetSplitCardsRow}>
                <View style={styles.corpusCard}>
                  <Text style={styles.corpusCardLabel}>Processed Lines</Text>
                  <Text style={styles.corpusCardNumber}>{dashboardMetrics.totalLines}</Text>
                  <Text style={styles.corpusCardSub}>from real completed sessions</Text>
                </View>

                <View style={[styles.corpusCard, styles.corpusCardBenchmark]}>
                  <Text style={[styles.corpusCardLabel, { color: REPORT_THEME.emeraldDark }]}>
                    Reviewed Lines
                  </Text>
                  <Text style={[styles.corpusCardNumber, { color: REPORT_THEME.emeraldDark }]}>
                    {dashboardMetrics.evaluatedLines}
                  </Text>
                  <Text style={[styles.corpusCardSub, { color: '#166534' }]}>
                    with user-reviewed final text
                  </Text>
                </View>
              </View>

              {/* Session Benchmark / Recorded Activity Sub-Table */}
              <View style={styles.evalSummaryContainer}>
                <View style={styles.evalSummaryHeaderRow}>
                  <Text style={styles.evalSummaryTitle}>Recorded Activity</Text>
                  <Text style={styles.evalBatchTag}>{dashboardMetrics.evaluatedLines} reviewed lines</Text>
                </View>

                <View style={styles.evalGrid}>
                  <View style={styles.evalRow}>
                    <Text style={styles.evalLabel}>Total lines</Text>
                    <Text style={styles.evalValue}>{dashboardMetrics.totalLines} lines</Text>
                  </View>
                  <View style={styles.evalRow}>
                    <Text style={styles.evalLabel}>Latency</Text>
                    <Text style={styles.evalValue}>
                      {dashboardMetrics.averageLatencySeconds === null
                        ? '—'
                        : `${formatSeconds(dashboardMetrics.averageLatencySeconds, '—')} / session`}
                    </Text>
                  </View>
                  <View style={[styles.evalRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.evalLabel}>Mean OCR score (uncalibrated)</Text>
                    <Text style={[styles.evalValue, { color: REPORT_THEME.blueDark }]}>
                      {formatOptionalPercent(dashboardMetrics.averageConfidence)}
                    </Text>
                  </View>
                </View>
              </View>

            </View>
          </ReportCard>

          <ReportCard>
            <Text style={styles.noDataText}>{dashboardMetrics.confidenceLineCount}/{dashboardMetrics.totalLines} lines have a recorded OCR score with a known source. Older untraceable scores are excluded. Confidence is not accuracy.</Text>
            <TouchableOpacity style={styles.viewFullArchiveBtn} onPress={() => router.push('/evaluation-history' as never)}
              accessibilityRole="button" accessibilityLabel="Open recognition history">
              <Text style={styles.viewFullArchiveBtnText}>Open Recognition History</Text>
              <Ionicons name="arrow-forward" size={16} color="#1D4ED8" />
            </TouchableOpacity>
          </ReportCard>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// MOBILE FIRST STYLESHEET (APPLE HIG + DEEPMIND SYSTEM)
// -------------------------------------------------------------
const styles = StyleSheet.create({
  referencePrompt: {
    backgroundColor: REPORT_THEME.blueSurface, borderColor: REPORT_THEME.blueBorder,
    borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16, gap: 10,
  },
  referencePromptTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: REPORT_THEME.textPrimary },
  referencePromptText: { fontSize: 14, lineHeight: 21, color: REPORT_THEME.textSecondary },
  referenceButton: {
    minHeight: 48, backgroundColor: REPORT_THEME.blueDark, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  referenceButtonText: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '700', color: '#FFFFFF' },
  safeArea: {
    flex: 1,
    backgroundColor: REPORT_THEME.bg,
  },
  container: {
    flex: 1,
    backgroundColor: REPORT_THEME.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  scrollContentWide: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  mainWrapper: {
    width: '100%',
    maxWidth: 430, // Locked strictly to true mobile (iPhone Pro Max / Pixel)
    alignSelf: 'center',
  },
  mainWrapperWide: {
    maxWidth: 430,
  },

  // Supporting metrics row (2 columns layout)
  supportingMetricsGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  supportingColCard: {
    width: '48.2%',
    minWidth: 140,
  },
  supportingSpanCard: {
    width: '100%',
    marginTop: 2,
  },

  // Dataset Section
  datasetBadgesGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  datasetInfoContainer: {
    marginTop: 2,
  },
  datasetNameHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: REPORT_THEME.textPrimary,
    marginBottom: 2,
  },
  datasetTotalText: {
    fontSize: 12,
    color: REPORT_THEME.textMuted,
    marginBottom: 12,
  },
  datasetSplitCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  corpusCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  corpusCardBenchmark: {
    borderColor: REPORT_THEME.emeraldBorder,
    backgroundColor: '#F0FDF4',
  },
  corpusCardLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: REPORT_THEME.textMuted,
    marginBottom: 3,
  },
  corpusCardNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: REPORT_THEME.textPrimary,
    letterSpacing: -0.4,
  },
  corpusCardSub: {
    fontSize: 10,
    color: REPORT_THEME.textMuted,
    marginTop: 2,
  },

  // Evaluation summary inside dataset
  evalSummaryContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: REPORT_THEME.divider,
  },
  evalSummaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  evalSummaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: REPORT_THEME.textPrimary,
  },
  evalBatchTag: {
    fontSize: 11,
    fontWeight: '600',
    color: REPORT_THEME.textMuted,
  },
  evalGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  evalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: REPORT_THEME.divider,
  },
  evalLabel: {
    fontSize: 12,
    color: REPORT_THEME.textSecondary,
    fontWeight: '500',
  },
  evalValue: {
    fontSize: 12,
    fontWeight: '700',
    color: REPORT_THEME.textPrimary,
  },

  // Evaluation History List
  historyList: {
    marginTop: 4,
  },
  viewFullArchiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 10,
    marginTop: 6,
  },
  viewFullArchiveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  noDataBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    paddingHorizontal: 18,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: REPORT_THEME.cardBorder,
  },
  noDataTitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '800',
    color: REPORT_THEME.textPrimary,
    textAlign: 'center',
  },
  noDataText: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: REPORT_THEME.textMuted,
    textAlign: 'center',
  },
});
