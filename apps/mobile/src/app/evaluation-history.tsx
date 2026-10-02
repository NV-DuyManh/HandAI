import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet,
  Text, View, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/ui/AppHeader';
import { HistoryCard, ReportCard, SectionHeader, StatusBadge } from '../components/report';
import { handAiAnalyticsStore, type RecognitionSession } from '../services/analytics/handAiAnalyticsStore';
import { buildHandAiDashboardMetrics } from '../services/analytics/handAiDashboardMetrics';

export default function EvaluationHistoryScreen() {
  const router = useRouter();
  const isWide = useWindowDimensions().width >= 768;
  const [sessions, setSessions] = useState<RecognitionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const readSessions = useCallback(() => {
    const history = handAiAnalyticsStore.getSessions()
      .filter((session) => session.isSampleData !== true)
      .sort((a, b) => b.timestamp - a.timestamp);
    setSessions(history);
    setSelectedIds((ids) => ids.filter((id) => history.some((session) => session.sessionId === id)));
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      await handAiAnalyticsStore.init();
      const removed = await handAiAnalyticsStore.cleanupIncompleteSessions();
      readSessions();
      setError('');
      if (removed > 0) setNotice(`${removed} incomplete ${removed === 1 ? 'record was' : 'records were'} removed because the image or OCR result was unavailable.`);
    } catch (e) {
      console.warn('[EvaluationHistory] Failed to load history:', e);
      setError('History could not be loaded. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, [readSessions]);

  useEffect(() => {
    const unsubscribe = handAiAnalyticsStore.subscribe(readSessions);
    void Promise.resolve().then(loadSessions);
    return unsubscribe;
  }, [loadSessions, readSessions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((selected) => selected !== id) : [...ids, id]);
  };

  const deleteHistory = async (all: boolean) => {
    setDeleting(true);
    setError('');
    try {
      if (all) await handAiAnalyticsStore.clearAllSessions();
      else await handAiAnalyticsStore.deleteSessions(selectedIds);
      readSessions();
      setNotice(all ? 'All recognition history was deleted. The report has been updated.' : `${selectedIds.length} selected ${selectedIds.length === 1 ? 'attempt was' : 'attempts were'} deleted. The report has been updated.`);
      setSelectedIds([]);
      setSelecting(false);
    } catch (e) {
      console.warn('[EvaluationHistory] Failed to delete history:', e);
      setError('History could not be deleted. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = (all: boolean) => {
    const title = all ? 'Delete all history?' : `Delete ${selectedIds.length} selected attempts?`;
    const message = 'Saved images and recognition results will be removed from this history. The report will be recalculated using the remaining attempts. This cannot be undone.';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) void deleteHistory(all);
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: all ? 'Delete all' : 'Delete selected', style: 'destructive', onPress: () => { void deleteHistory(all); } },
    ]);
  };

  const metrics = buildHandAiDashboardMetrics(sessions);
  const allSelected = sessions.length > 0 && selectedIds.length === sessions.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader title="Recognition History" subtitle="Saved images and recognition results" showBack />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, isWide && styles.contentWide]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={[styles.mainWrapper, isWide && styles.mainWrapperWide]}>
          <ReportCard style={styles.headerCard} accentTopColor="#1D4ED8" accentTopWidth={3.5}>
            <View style={styles.headerRow}>
              <View style={styles.headerIconBox}>
                <Ionicons name="time-outline" size={22} color="#1D4ED8" accessible={false} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Recognition History</Text>
                <Text style={styles.headerSub}>Open an attempt to review its input image and every saved line.</Text>
              </View>
            </View>
            <View style={styles.kpiRow}>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiLabel}>Saved attempts</Text>
                <Text style={styles.kpiValue}>{sessions.length}</Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiLabel}>Processed lines</Text>
                <Text style={styles.kpiValue}>{metrics.totalLines}</Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiLabel}>Reference lines</Text>
                <Text style={styles.kpiValue}>{metrics.evaluatedLines}</Text>
              </View>
            </View>
          </ReportCard>

          {notice ? <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionButton, (sessions.length === 0 || deleting) && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel={selecting ? 'Cancel selection' : 'Select recognition attempts'}
              accessibilityState={{ disabled: sessions.length === 0 || deleting }}
              disabled={sessions.length === 0 || deleting}
              onPress={() => { setSelecting(!selecting); setSelectedIds([]); }}
            >
              <Ionicons name="checkbox-outline" size={18} color="#1D4ED8" accessible={false} />
              <Text style={styles.actionText}>{selecting ? 'Cancel selection' : 'Select attempts'}</Text>
            </Pressable>
            <Pressable
              testID="history-delete-all"
              style={[styles.actionButton, (sessions.length === 0 || deleting) && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Delete all recognition history"
              accessibilityState={{ disabled: sessions.length === 0 || deleting }}
              disabled={sessions.length === 0 || deleting}
              onPress={() => confirmDelete(true)}
            >
              <Ionicons name="trash-outline" size={18} color="#B91C1C" accessible={false} />
              <Text style={styles.destructiveText}>Delete all history</Text>
            </Pressable>
          </View>

          {selecting ? (
            <View style={styles.selectionBar}>
              <Pressable
                style={styles.selectionButton}
                accessibilityRole="checkbox"
                aria-checked={allSelected}
                accessibilityLabel="Select all recognition attempts"
                accessibilityState={{ checked: allSelected, disabled: deleting }}
                disabled={deleting}
                onPress={() => setSelectedIds(allSelected ? [] : sessions.map((session) => session.sessionId))}
              >
                <Ionicons name={allSelected ? 'checkbox' : 'square-outline'} size={22} color="#1D4ED8" accessible={false} />
                <Text style={styles.actionText}>{selectedIds.length} selected</Text>
              </Pressable>
              <Pressable
                testID="history-delete-selected"
                style={[styles.selectionButton, (selectedIds.length === 0 || deleting) && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${selectedIds.length} selected attempts`}
                accessibilityState={{ disabled: selectedIds.length === 0 || deleting }}
                disabled={selectedIds.length === 0 || deleting}
                onPress={() => confirmDelete(false)}
              >
                <Text style={styles.destructiveText}>{deleting ? 'Deleting…' : 'Delete selected'}</Text>
              </Pressable>
            </View>
          ) : null}

          <ReportCard testID="history-page-sessions-card">
            <SectionHeader
              label="SAVED RECOGNITION ATTEMPTS"
              title="Previous results"
              description="OCR scores are model scores before calibration. Accuracy is measured separately against reference text."
              rightElement={<StatusBadge label={`${sessions.length} saved`} variant="blue" />}
            />
            {sessions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={32} color="#64748B" accessible={false} />
                <Text style={styles.emptyTitle}>{loading ? 'Loading history…' : 'No saved recognition attempts'}</Text>
                <Text style={styles.emptyText}>Completed recognitions with an available image and OCR result will appear here.</Text>
              </View>
            ) : sessions.map((session, index) => {
              const firstLine = session.lineMetrics?.[0];
              const sessionMetrics = buildHandAiDashboardMetrics([session]);
              const selected = selectedIds.includes(session.sessionId);
              const rawPreview = session.rawOcrPreview || session.rawOcrText || firstLine?.ocrOutput || firstLine?.modelOutput || firstLine?.ocrText || '';
              const aiPreview = session.aiSuggestionPreview || firstLine?.aiCandidate || firstLine?.aiSuggestion || '';
              const finalPreview = firstLine?.finalResult || firstLine?.finalText || session.detectedText || session.verifiedResultPreview || '';
              return (
                <View key={session.sessionId} style={styles.historyEntry}>
                  <View style={styles.historyRow}>
                    {selecting ? (
                      <Pressable
                        testID={`history-select-${session.sessionId}`}
                        style={styles.checkbox}
                        accessibilityRole="checkbox"
                        aria-checked={selected}
                        accessibilityLabel={`Select ${session.formattedSessionId || `attempt ${index + 1}`}`}
                        accessibilityState={{ checked: selected, disabled: deleting }}
                        disabled={deleting}
                        onPress={() => toggleSelection(session.sessionId)}
                      >
                        <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={24} color="#1D4ED8" accessible={false} />
                      </Pressable>
                    ) : null}
                    <HistoryCard
                      testID={`history-card-${session.sessionId}`}
                      style={styles.historyCard}
                      sessionId={session.formattedSessionId || `Recognition #${String(index + 1).padStart(3, '0')}`}
                      timestamp={session.timestamp}
                      imageThumbnailUri={session.imageUri || session.imageThumbnailUri || session.thumbnailUri}
                      detectedText={session.detectedText || finalPreview || rawPreview}
                      rawOcrPreview={rawPreview}
                      aiSuggestionPreview={aiPreview}
                      verifiedResultPreview={finalPreview}
                      sampleCount={`${session.totalLines} lines`}
                      duration={session.processingTimeSeconds}
                      rawOcrAccuracy={sessionMetrics.rawAccuracy ?? undefined}
                      aiImprovement={sessionMetrics.aiGain ?? undefined}
                      onPress={() => {
                        if (selecting) toggleSelection(session.sessionId);
                        else router.push({ pathname: '/handai-trial-analytics' as never, params: { trialId: session.sessionId } });
                      }}
                    />
                  </View>
                  {sessionMetrics.averageConfidence !== null ? (
                    <Text style={styles.scoreNote}>
                      OCR score (uncalibrated): {sessionMetrics.averageConfidence}% · {sessionMetrics.confidenceLineCount} scored lines
                    </Text>
                  ) : <Text style={styles.scoreNote}>No verifiable OCR score was stored for this attempt.</Text>}
                </View>
              );
            })}
          </ReportCard>
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
  headerCard: { padding: 16, marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  headerSub: { fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 18 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12 },
  kpiItem: { flex: 1, minWidth: 80 },
  kpiLabel: { fontSize: 11, color: '#475569', marginBottom: 4 },
  kpiValue: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  actionButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1' },
  actionText: { fontSize: 13, fontWeight: '600', color: '#1D4ED8' },
  destructiveText: { fontSize: 13, fontWeight: '600', color: '#B91C1C' },
  disabled: { opacity: 0.45 },
  selectionBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EFF6FF', borderRadius: 12, marginBottom: 12, paddingHorizontal: 8 },
  selectionButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  notice: { fontSize: 13, lineHeight: 18, color: '#166534', marginBottom: 12 },
  error: { fontSize: 13, lineHeight: 18, color: '#B91C1C', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 12, gap: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 19, color: '#475569', textAlign: 'center' },
  historyEntry: { marginTop: 12 },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start' },
  checkbox: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  historyCard: { flex: 1, marginBottom: 0 },
  scoreNote: { fontSize: 12, lineHeight: 18, color: '#475569', marginTop: 6, marginBottom: 4 },
});
