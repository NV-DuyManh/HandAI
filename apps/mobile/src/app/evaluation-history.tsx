import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/ui/AppHeader';
import {
  ReportCard,
  SectionHeader,
  StatusBadge,
  HistoryCard,
} from '../components/report';
import { handAiAnalyticsStore } from '../services/analytics/handAiAnalyticsStore';
import { buildHandAiDashboardMetrics } from '../services/analytics/handAiDashboardMetrics';

export default function EvaluationHistoryScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  const [sessions, setSessions] = useState<any[]>([]);

  const loadSessions = async () => {
    try {
      await handAiAnalyticsStore.init();
      const activeSessions = handAiAnalyticsStore
        .getSessions()
        .filter((session) => session.status === 'COMPLETED' && session.isSampleData !== true);
      setSessions(
          activeSessions.map((s, idx) => {
            const firstLine = s.lineMetrics?.[0];
            const sessionMetrics = buildHandAiDashboardMetrics([s]);
            const rawPreview = s.rawOcrPreview || firstLine?.ocrOutput || firstLine?.ocrText;
            const aiPreview = s.aiSuggestionPreview || firstLine?.aiCandidate || firstLine?.aiSuggestion;
            const finalPreview = s.verifiedResultPreview || firstLine?.finalText || '';
            const detected = s.detectedText || firstLine?.finalText || aiPreview || rawPreview;

            return {
              sessionId: s.sessionId,
              formattedSessionId: s.formattedSessionId || `Recognition #${String(idx + 1).padStart(3, '0')}`,
              date: new Date(s.timestamp).toLocaleDateString('vi-VN'),
              time: new Date(s.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
              sampleCount: `${s.totalLines} lines recognized`,
              modelVersion: s.modelVersion || '',
              rawOcrAccuracy: sessionMetrics.rawAccuracy ?? undefined,
              aiImprovement: sessionMetrics.aiGain ?? undefined,
              duration: s.processingTimeSeconds != null ? `${s.processingTimeSeconds}s` : '',
              status: (s.status || 'COMPLETED') as string,
              rawOcrPreview: rawPreview || '',
              aiSuggestionPreview: aiPreview || '',
              verifiedResultPreview: finalPreview,
              detectedText: detected || '',
              confidence: sessionMetrics.averageConfidence ?? undefined,
              isSampleData: s.isSampleData ?? false,
              imageThumbnailUri: s.imageThumbnailUri || s.thumbnailUri || s.imageUri || undefined,
            };
          })
        );
    } catch (e) {
      console.warn('[EvaluationHistory] Failed to load sessions:', e);
    }
  };

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    loadSessions();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const filteredSessions = sessions.filter((s) => {
    if (selectedFilter === 'ALL') return true;
    return s.modelVersion.includes(selectedFilter);
  });
  const modelFilters = Array.from(new Set(
    sessions.map((session) => session.modelVersion).filter(Boolean)
  ));
  const durationValues = sessions
    .map((session) => Number.parseFloat(session.duration))
    .filter((value) => Number.isFinite(value));
  const confidenceValues = sessions
    .map((session) => session.confidence)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader title="Recognition History" subtitle="Previous handwriting recognition attempts" showBack />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, isWide && styles.contentWide]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={[styles.mainWrapper, isWide && styles.mainWrapperWide]}>

          {/* Header Card */}
          <ReportCard style={styles.headerCard} accentTopColor="#1D4ED8" accentTopWidth={3.5}>
            <View style={styles.headerRow}>
              <View style={styles.headerIconBox}>
                <Ionicons name="time-outline" size={20} color="#1D4ED8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Recognition History Archive</Text>
                <Text style={styles.headerSub}>
                  Review previous image recognition attempts and post-processing results
                </Text>
              </View>
              <StatusBadge label="History Log" variant="blue" />
            </View>

            {/* Quick KPI Strip — computed from session data */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiLabel}>Total Attempts</Text>
                <Text style={styles.kpiVal}>{sessions.length} attempts</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiItem}>
                <Text style={styles.kpiLabel}>Avg Duration</Text>
                <Text style={styles.kpiVal}>
                  {durationValues.length > 0
                    ? `${(durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length).toFixed(1)}s`
                    : '—'}
                </Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiItem}>
                <Text style={[styles.kpiLabel, { color: '#047857' }]}>Mean Confidence</Text>
                <Text style={[styles.kpiVal, { color: '#059669', fontWeight: '800' }]}>
                  {confidenceValues.length > 0
                    ? `${(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(1)}%`
                    : '—'}
                </Text>
              </View>
            </View>
          </ReportCard>

          {/* Filter Pills */}
          <View style={styles.filtersRow}>
            <TouchableOpacity
              style={[styles.filterChip, selectedFilter === 'ALL' && styles.filterChipActive]}
              onPress={() => setSelectedFilter('ALL')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Show all attempts"
            >
              <Text style={[styles.filterChipText, selectedFilter === 'ALL' && styles.filterChipTextActive]}>
                All Attempts ({sessions.length})
              </Text>
            </TouchableOpacity>

            {modelFilters.map((modelVersion) => (
              <TouchableOpacity
                key={modelVersion}
                style={[styles.filterChip, selectedFilter === modelVersion && styles.filterChipActive]}
                onPress={() => setSelectedFilter(modelVersion)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${modelVersion}`}
              >
                <Text style={[styles.filterChipText, selectedFilter === modelVersion && styles.filterChipTextActive]}>
                  {modelVersion}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sessions List */}
          <ReportCard testID="history-page-sessions-card">
            <SectionHeader
              label="RECOGNITION ATTEMPTS"
              title="Recognition History"
              description="Tap any card to open full Recognition Detail page with image preview and error analysis."
              rightElement={<StatusBadge label={`${filteredSessions.length} Available`} variant="green" />}
            />

            <View style={styles.sessionList}>
              {filteredSessions.map((session) => (
                <HistoryCard
                  key={session.sessionId}
                  sessionId={session.formattedSessionId}
                  date={session.date}
                  time={session.time}
                  imageThumbnailUri={session.imageThumbnailUri}
                  detectedText={session.detectedText}
                  rawOcrPreview={session.rawOcrPreview}
                  aiSuggestionPreview={session.aiSuggestionPreview}
                  verifiedResultPreview={session.verifiedResultPreview}
                  sampleCount={session.sampleCount}
                  modelVersion={session.modelVersion}
                  rawOcrAccuracy={session.rawOcrAccuracy}
                  aiImprovement={session.aiImprovement}
                  duration={session.duration}
                  status={session.status}
                  confidence={session.confidence}
                  isSampleData={session.isSampleData}
                  onPress={() =>
                    router.push({
                      pathname: '/handai-trial-analytics' as any,
                      params: { trialId: session.sessionId },
                    })
                  }
                />
              ))}
            </View>
          </ReportCard>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 48,
    alignItems: 'center',
  },
  contentWide: {
    paddingHorizontal: 24,
  },
  mainWrapper: {
    width: '100%',
    maxWidth: 430,
  },
  mainWrapperWide: {
    maxWidth: 680,
  },
  headerCard: {
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  kpiItem: {
    flex: 1,
    alignItems: 'center',
  },
  kpiDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sessionList: {
    marginTop: 8,
  },
});
