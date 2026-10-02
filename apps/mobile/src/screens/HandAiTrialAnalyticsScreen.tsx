import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
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
  MetricCard,
  ReportCard,
  SectionHeader,
  StatusBadge,
} from '../components/report';
import { AppHeader } from '../components/ui/AppHeader';
import {
  handAiAnalyticsStore,
  type RecognitionSession,
} from '../services/analytics/handAiAnalyticsStore';
import { buildHandAiDashboardMetrics } from '../services/analytics/handAiDashboardMetrics';
import { formatMetricPercent, formatSeconds } from '../utils/metricFormat';
import { StoredLineReview } from '../components/report/StoredLineReview';

const PRIMARY_COLOR = '#1D4ED8';

const optionalPercent = (value: number | null): string =>
  value === null ? 'Not recorded' : formatMetricPercent(value);

function DataUnavailable({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.unavailableBox}>
      <Ionicons name="information-circle-outline" size={18} color="#64748B" />
      <Text style={styles.unavailableText}>{children}</Text>
    </View>
  );
}

export default function HandAiTrialAnalyticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ trialId?: string; sessionId?: string; reviewReferences?: string }>();
  const activeId = params.trialId || params.sessionId;
  const referenceMode = params.reviewReferences === '1';
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<RecognitionSession | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
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
    };
    void loadSession();
    const unsubscribe = handAiAnalyticsStore.subscribe(() => { void loadSession(); });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [activeId]);

  const metrics = useMemo(
    () => buildHandAiDashboardMetrics(session ? [session] : []),
    [session]
  );

  const confirmAllCurrentText = async () => {
    if (!session) return;
    setConfirmingAll(true);
    setReviewMessage('');
    try {
      const count = await handAiAnalyticsStore.confirmAllFinalTexts(session.sessionId);
      setReviewMessage(count ? `${count} final lines confirmed.` : 'All available final lines are already reviewed.');
    } catch {
      setReviewMessage('Could not confirm the final lines. Please try again.');
    } finally { setConfirmingAll(false); }
  };

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
  const pendingReviewCount = (session.lineMetrics || []).filter((line) =>
    line.groundTruthStatus !== 'EXPLICIT' && Boolean((line.finalResult || line.finalText || line.text || '').trim())
  ).length;
  const reviewCard = (
    <ReportCard testID="stored-recognition-review">
      <SectionHeader label={referenceMode ? 'FINAL REVIEW' : 'SAVED RECOGNITION'}
        title={referenceMode ? 'Confirm Final Results' : 'Review All Lines'}
        description={referenceMode
          ? 'The final result is already filled in. Keep correct lines, edit only wrong lines, then confirm to calculate reviewed accuracy.'
          : 'Raw OCR, stored AI candidates and your selected text from this session.'} />
      <Text style={styles.unavailableText}>{referenceMode
        ? `${metrics.evaluatedLines}/${metrics.totalLines} final lines reviewed · ${pendingReviewCount} still need confirmation. Saved reviews and scores apply to this device.`
        : `${session.lineMetrics?.length || 0}/${metrics.totalLines} line records stored. Missing historical details are not reconstructed.`}</Text>
      {referenceMode && pendingReviewCount > 0 ? <View style={styles.confirmAllBox}>
        <Text style={styles.confirmAllTitle}>Everything below already looks correct?</Text>
        <Text style={styles.confirmAllText}>Check the source image once, then confirm all current final text in one step. You can still edit individual lines afterward.</Text>
        <TouchableOpacity style={[styles.confirmAllButton, confirmingAll && styles.buttonDisabled]}
          accessibilityRole="button" accessibilityLabel="Confirm all current final text as correct"
          disabled={confirmingAll} onPress={confirmAllCurrentText}>
          <Ionicons name="checkmark-done-outline" size={18} color="#FFFFFF" />
          <Text style={styles.confirmAllButtonText}>{confirmingAll ? 'Confirming…' : `Confirm ${pendingReviewCount} current lines`}</Text>
        </TouchableOpacity>
      </View> : null}
      {reviewMessage ? <Text accessibilityLiveRegion="polite" style={styles.reviewMessage}>{reviewMessage}</Text> : null}
      {!referenceMode ? <Text style={styles.cardTitle}>{(session.lineMetrics || []).map((line) => line.finalResult || line.finalText || line.text || '').filter(Boolean).join('\n')}</Text> : null}
      {(session.lineMetrics || []).map((line) => <StoredLineReview key={line.lineId} line={line} sessionId={session.sessionId} />)}
    </ReportCard>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title={referenceMode ? 'Review Final Results' : 'Recognition Detail'}
        subtitle={session.formattedSessionId || 'Stored live session'}
        showBack
      />

      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, isWide && styles.contentWide]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
                style={[styles.originalImage, referenceMode && styles.referenceImage]}
                resizeMode="contain"
                onError={() => setImageFailed(true)}
                accessibilityLabel="Input image used for this recognition session"
              />
            ) : (
              <DataUnavailable>
                The input image was not retained for this session. No replacement preview is generated.
              </DataUnavailable>
            )}

            {referenceMode ? <Text style={styles.referenceInstructions}>
              Compare the filled final text with this image. Confirm correct lines and edit only the lines that are wrong.
            </Text> : <>
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
                  <Text style={[styles.label, styles.scopeLabel]}>REVIEWED FINAL LINES</Text>
                  <Text style={styles.value}>{metrics.evaluatedLines}</Text>
                </View>
                <View style={[styles.gridItem, styles.gridItemFull, styles.scopeItem]}>
                  <Text style={[styles.label, styles.scopeLabel]}>EVALUATION BASIS</Text>
                  <Text style={styles.value}>
                    {metrics.hasEvaluatedLines
                      ? 'User-reviewed final text'
                      : 'Final text has not been reviewed'}
                  </Text>
                </View>
              </View>
            </View>
            </>}
          </ReportCard>

          {referenceMode ? reviewCard : null}
          <ReportCard testID="performance-metrics-section">
            <SectionHeader
              label="MEASURED PERFORMANCE"
              title="Session Metrics"
              description="Activity and model scores are always shown. Accuracy uses final text that you reviewed against the image."
              rightElement={
                <StatusBadge
                  label={metrics.hasEvaluatedLines ? 'Reviewed Lines' : 'Review Needed'}
                  variant={metrics.hasEvaluatedLines ? 'green' : 'neutral'}
                />
              }
            />

            <View style={styles.metricsGrid}>
              {metrics.hasEvaluatedLines ? <>
              <MetricCard
                value={optionalPercent(metrics.rawAccuracy)}
                title="Raw Line Accuracy"
                explanation="Raw OCR exact matches against reviewed final text"
                color="blue"
                icon="scan-outline"
                categoryTag="RAW OCR"
                style={styles.metricCard}
              />
              <MetricCard
                value={optionalPercent(metrics.aiAccuracy)}
                title="AI-Assisted Line Accuracy"
                explanation={metrics.comparisonLines
                  ? `${metrics.aiCorrectLines}/${metrics.comparisonLines} recorded AI responses matched reviewed final text`
                  : 'No recorded AI response is available on reviewed lines'}
                color="green"
                icon="checkmark-circle-outline"
                categoryTag="AFTER AI"
                style={styles.metricCard}
              />
              <MetricCard
                value={optionalPercent(metrics.cer)}
                title="Raw Character Error Rate"
                explanation="Character edits divided by reference characters"
                color="blue"
                icon="text-outline"
                categoryTag="CHARACTER"
                style={styles.metricCard}
              />
              <MetricCard
                value={optionalPercent(metrics.wer)}
                title="Raw Word Error Rate"
                explanation="Word edits divided by reference words"
                color="orange"
                icon="document-text-outline"
                categoryTag="WORD"
                style={styles.metricCard}
              />
              </> : null}
              <MetricCard
                value={optionalPercent(metrics.averageConfidence)}
                title="Mean OCR Score"
                explanation={`${metrics.confidenceLineCount}/${metrics.totalLines} recorded scores · uncalibrated, not accuracy`}
                color="purple"
                icon="speedometer-outline"
                categoryTag="CONFIDENCE"
                style={styles.metricCard}
              />
              <MetricCard
                value={formatSeconds(metrics.averageLatencySeconds, 'Not recorded')}
                title="Processing Time"
                explanation="Recorded recognition request duration including image preparation and transfer"
                color="blue"
                icon="timer-outline"
                categoryTag="LATENCY"
                style={styles.metricCard}
              />
            </View>

            {!metrics.hasEvaluatedLines ? (
              <DataUnavailable>
                OCR activity and scores are recorded above. Review the filled final text against the image to calculate accuracy; no retyping is required for correct lines.
              </DataUnavailable>
            ) : null}

            <View style={styles.countStrip}>
              <View style={styles.countItem}>
                <Text style={styles.countLabel}>Processed lines</Text>
                <Text style={styles.countValue}>{metrics.totalLines}</Text>
              </View>
              <View style={styles.countDivider} />
              <View style={styles.countItem}>
                <Text style={styles.countLabel}>AI text changes</Text>
                <Text style={styles.countValue}>{metrics.aiAssistedLines}</Text>
              </View>
              <View style={styles.countDivider} />
              <View style={styles.countItem}>
                <Text style={styles.countLabel}>Manual edits</Text>
                <Text style={styles.countValue}>{metrics.manualEditedLines}</Text>
              </View>
            </View>
          </ReportCard>

          {!referenceMode ? reviewCard : null}

          {referenceMode ? <TouchableOpacity style={styles.primaryButton} accessibilityRole="button" accessibilityLabel="View updated recognition summary"
            onPress={() => router.push('/handai-analytics' as never)}>
            <Text style={styles.primaryButtonText}>View Updated Summary</Text>
          </TouchableOpacity> : null}

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
      </KeyboardAvoidingView>
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
  originalImage: { width: '100%', height: 220, borderRadius: 14, backgroundColor: '#F1F5F9', marginBottom: 13 },
  referenceImage: { height: 320 },
  referenceInstructions: { fontSize: 14, lineHeight: 21, color: '#334155' },
  confirmAllBox: { marginTop: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#ECFDF5', gap: 7 },
  confirmAllTitle: { color: '#065F46', fontSize: 14, fontWeight: '800' },
  confirmAllText: { color: '#166534', fontSize: 12, lineHeight: 18 },
  confirmAllButton: { minHeight: 48, borderRadius: 10, backgroundColor: '#047857', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  confirmAllButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
  reviewMessage: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: '#F1F5F9', color: '#334155', fontSize: 12, lineHeight: 18, fontWeight: '600' },
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
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  metricCard: { width: '48.5%', flexGrow: 1, marginBottom: 0 },
  countStrip: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 11, marginTop: 12 },
  countItem: { flex: 1, alignItems: 'center', paddingHorizontal: 5 },
  countLabel: { fontSize: 10, color: '#64748B', textAlign: 'center' },
  countValue: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 3 },
  countDivider: { width: 1, backgroundColor: '#E2E8F0' },
  historyButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 11, marginTop: 4 },
  historyButtonText: { fontSize: 13, fontWeight: '700', color: '#475569' },
});
