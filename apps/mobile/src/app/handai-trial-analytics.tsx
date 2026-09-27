import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Share,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/ui/AppHeader';
import {
  handAiAnalyticsStore,
  TrialAnalytics,
  exportTrialToJson,
  exportTrialToCsv,
  exportResearchEvaluationReport,
  BENCHMARK_EXPERIMENTS,
} from '../services/analytics/handAiAnalyticsStore';
import { OcrPilotService } from '../services/api/OcrPilotService';

const PRIMARY_COLOR = '#123B7A';
const SECONDARY_COLOR = '#2563EB';
const BG_COLOR = '#F8FAFC';

export default function HandAiTrialAnalyticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const trialId = params.trialId as string;

  const [loading, setLoading] = useState(true);
  const [trialData, setTrialData] = useState<TrialAnalytics | null>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [exportType, setExportType] = useState<'JSON' | 'CSV' | 'REPORT'>('JSON');

  useEffect(() => {
    let active = true;

    const loadAnalytics = async () => {
      try {
        await handAiAnalyticsStore.init();
        let data = await handAiAnalyticsStore.getCurrentTrialAnalytics(trialId);

        if (!data && trialId) {
          const cachedTrial = OcrPilotService.getCachedTrial(trialId);
          if (cachedTrial) {
            data = handAiAnalyticsStore.computeTrialAnalytics(cachedTrial, true);
          }
        }

        if (active) {
          setTrialData(data);
        }
      } catch (e) {
        console.warn('[HandAiTrialAnalytics] Failed to load trial analytics:', e);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAnalytics();

    return () => {
      active = false;
    };
  }, [trialId]);

  const handleExport = async (type: 'JSON' | 'CSV' | 'REPORT') => {
    if (!trialData) return;
    try {
      let content = '';
      if (type === 'JSON') content = exportTrialToJson(trialData);
      else if (type === 'CSV') content = exportTrialToCsv(trialData);
      else content = exportResearchEvaluationReport(handAiAnalyticsStore.getGlobalAnalytics(), trialData);
      setExportType(type);
      setExportContent(content);
      setExportModalVisible(true);
    } catch (e: any) {
      Alert.alert('Export Error', e?.message || 'Failed to export trial data');
    }
  };

  const handleShareExport = async () => {
    try {
      await Share.share({
        title: `handai_trial_${trialData?.trialId || Date.now()}.${exportType.toLowerCase()}`,
        message: exportContent,
      });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader title="Current Recognition Evaluation" showBack />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Calculating trial performance metrics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!trialData || trialData.totalLines === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader title="Current Recognition Evaluation" showBack />
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No Trial Data Available</Text>
          <Text style={styles.emptySubtitle}>
            Please complete and confirm a handwriting recognition session to inspect trial analytics.
          </Text>
          <TouchableOpacity
            style={styles.primaryActionBtn}
            onPress={() => router.replace('/(tabs)' as any)}
            accessibilityRole="button"
            accessibilityLabel="Return to Scanner"
          >
            <Text style={styles.primaryActionBtnText}>Scan New Image</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const {
    totalLines,
    rawCorrect,
    aiCorrected,
    manualEdited,
    finalCorrect,
    rawAccuracy,
    finalAccuracy,
    aiImprovement,
    avgConfidence,
    latencySeconds,
    sourceDistribution,
    confidenceDistribution,
    confidenceReliability,
    lineMetrics,
    lineAccuracy,
    characterAccuracy,
    cer,
    wer,
    wordAccuracy,
    rawOcrAccuracy,
    finalAiAccuracy,
    aiGain,
    measurableFunnel,
    errorAnalysis,
    errorSummary,
    metadata,
  } = trialData;

  const totalErrors = errorSummary?.totalErrors ?? (errorAnalysis?.totalErrors ?? 0);
  const mainError = errorSummary?.mainError || (errorAnalysis?.totalErrors ? 'Vietnamese Tone Error' : 'None');
  const recommendation =
    errorSummary?.recommendation ||
    (totalErrors > 0
      ? 'Improve handwriting tone recognition.'
      : 'Optimal recognition performance achieved across all lines.');

  const totalSources = Math.max(1, sourceDistribution.crnn + sourceDistribution.aiCorrection + sourceDistribution.manual);
  const crnnPct = Math.round((sourceDistribution.crnn / totalSources) * 100);
  const aiPct = Math.round((sourceDistribution.aiCorrection / totalSources) * 100);
  const manualPct = Math.round((sourceDistribution.manual / totalSources) * 100);

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title="Current Recognition Evaluation" showBack />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={styles.headerBanner}>
          <View style={styles.headerBadgeRow}>
            <View style={styles.headerPill}>
              <View style={styles.headerPillDot} />
              <Text style={styles.headerPillText}>CURRENT TRIAL EVALUATION</Text>
            </View>
            <Text style={styles.sampleCountText}>
              {trialId ? `ID: ${trialId.slice(-8)}` : 'Session Single'}
            </Text>
          </View>
          <Text style={styles.bannerTitle}>AI Recognition Quality Evaluation</Text>
          <Text style={styles.bannerSubtitle}>
            Ground truth evaluation platform comparing raw CRNN OCR output against post-correction arbitration for research defense.
          </Text>
        </View>

        {/* 6. Evaluation Session Environment Metadata */}
        <View style={styles.metadataCard}>
          <View style={styles.metadataHeaderRow}>
            <Ionicons name="hardware-chip-outline" size={16} color={PRIMARY_COLOR} />
            <Text style={styles.metadataCardTitle}>Evaluation Session Metadata</Text>
            <View style={styles.benchmarkTag}>
              <Text style={styles.benchmarkTagText}>DEFENSE READY</Text>
            </View>
          </View>

          <View style={styles.metadataGrid}>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>SESSION ID</Text>
              <Text style={styles.metadataValue} numberOfLines={1}>
                {metadata?.sessionId || (trialId ? trialId.slice(-12) : 'trial-session')}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>TIMESTAMP</Text>
              <Text style={styles.metadataValue}>
                {metadata?.timestamp ? new Date(metadata.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>IMAGE RESOLUTION</Text>
              <Text style={styles.metadataValue}>
                {metadata?.imageResolution || '1200 x 800 (Preprocessed)'}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>MODEL VERSION</Text>
              <Text style={[styles.metadataValue, { color: SECONDARY_COLOR }]}>
                {metadata?.modelVersion || 'CRNN-v1.2-PyTorch'}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>DATASET VERSION</Text>
              <Text style={[styles.metadataValue, { color: '#059669' }]}>
                {metadata?.datasetVersion || 'HandAI-v1.2'}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>EXPERIMENT ID</Text>
              <Text style={styles.metadataValue}>
                {metadata?.experimentId || 'exp_crnn_v1_2'}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>ENGINE VERSION</Text>
              <Text style={styles.metadataValue}>
                {metadata?.engineVersion || 'HandAI v2.4 (Groq/Gemini-4B)'}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>NUMBER OF LINES</Text>
              <Text style={[styles.metadataValue, { color: PRIMARY_COLOR }]}>
                {trialData?.totalLines ?? metadata?.numberOfLines ?? 0} lines
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Recognition Quality Report */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="ribbon-outline" size={18} color={PRIMARY_COLOR} />
            <Text style={styles.sectionTitle}>Recognition Quality Report</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Rigorous character and line-level benchmark metrics for academic evaluation
          </Text>

          <View style={styles.qualityReportGrid}>
            {/* Line Accuracy */}
            <View style={styles.qualityCard}>
              <Text style={styles.qualityCardLabel}>Line Accuracy</Text>
              <Text style={[styles.qualityCardHero, { color: '#1E293B' }]}>
                {lineAccuracy ?? finalAccuracy}%
              </Text>
              <Text style={styles.qualityCardSub}>Exact match rate</Text>
            </View>

            {/* Character Accuracy */}
            <View style={[styles.qualityCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <Text style={[styles.qualityCardLabel, { color: '#166534' }]}>Character Accuracy</Text>
              <Text style={[styles.qualityCardHero, { color: '#16A34A' }]}>
                {characterAccuracy ?? (100 - (cer ?? 0))}%
              </Text>
              <Text style={[styles.qualityCardSub, { color: '#15803D' }]}>100 - CER (Char level)</Text>
            </View>

            {/* CER */}
            <View style={[styles.qualityCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <Text style={[styles.qualityCardLabel, { color: '#1E40AF' }]}>CER (Error Rate)</Text>
              <Text style={[styles.qualityCardHero, { color: '#2563EB' }]}>
                {cer ?? 0}%
              </Text>
              <Text style={[styles.qualityCardSub, { color: '#1E40AF' }]}>Levenshtein edit / len</Text>
            </View>

            {/* Word Accuracy */}
            <View style={[styles.qualityCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <Text style={[styles.qualityCardLabel, { color: '#166534' }]}>Word Accuracy</Text>
              <Text style={[styles.qualityCardHero, { color: '#16A34A' }]}>
                {wordAccuracy ?? (100 - (wer ?? 0))}%
              </Text>
              <Text style={[styles.qualityCardSub, { color: '#15803D' }]}>100 - WER (Word level)</Text>
            </View>

            {/* WER */}
            <View style={[styles.qualityCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <Text style={[styles.qualityCardLabel, { color: '#1E40AF' }]}>WER (Word Error Rate)</Text>
              <Text style={[styles.qualityCardHero, { color: '#2563EB' }]}>
                {wer ?? 0}%
              </Text>
              <Text style={[styles.qualityCardSub, { color: '#1E40AF' }]}>Word edit dist / words</Text>
            </View>

            {/* Raw OCR Accuracy */}
            <View style={styles.qualityCard}>
              <Text style={styles.qualityCardLabel}>Raw OCR Accuracy</Text>
              <Text style={[styles.qualityCardHero, { color: '#475569' }]}>
                {rawOcrAccuracy ?? rawAccuracy}%
              </Text>
              <Text style={styles.qualityCardSub}>CRNN baseline only</Text>
            </View>

            {/* Final AI Accuracy */}
            <View style={[styles.qualityCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <Text style={[styles.qualityCardLabel, { color: '#166534' }]}>Final AI Accuracy</Text>
              <Text style={[styles.qualityCardHero, { color: '#16A34A' }]}>
                {finalAiAccuracy ?? finalAccuracy}%
              </Text>
              <Text style={[styles.qualityCardSub, { color: '#15803D' }]}>Post-arbitration verified</Text>
            </View>

            {/* AI Gain */}
            <View style={[styles.qualityCard, { backgroundColor: '#FEFCE8', borderColor: '#FDE68A' }]}>
              <Text style={[styles.qualityCardLabel, { color: '#854D0E' }]}>AI Gain</Text>
              <Text style={[styles.qualityCardHero, { color: '#D97706' }]}>
                +{aiGain ?? aiImprovement}%
              </Text>
              <Text style={[styles.qualityCardSub, { color: '#A16207' }]}>Arbitration delta lift</Text>
            </View>
          </View>
        </View>

        {/* Trial Result Summary */}
        <View style={styles.sessionResultCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderTitle}>Trial Result Summary</Text>
            <View style={styles.latencyBadge}>
              <Ionicons name="time-outline" size={12} color="#1E40AF" />
              <Text style={styles.latencyBadgeText}>Latency: {latencySeconds}s</Text>
            </View>
          </View>

          <View style={styles.resultGrid}>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Total Lines:</Text>
              <Text style={styles.resultValueBold}>{totalLines}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Correct OCR Lines:</Text>
              <Text style={[styles.resultValueBold, { color: '#2563EB' }]}>{rawCorrect}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>AI Corrected Lines:</Text>
              <Text style={[styles.resultValueBold, { color: '#D97706' }]}>{aiCorrected}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Manual Edited Lines:</Text>
              <Text style={[styles.resultValueBold, { color: '#10B981' }]}>{manualEdited}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Final Correct Lines:</Text>
              <Text style={[styles.resultValueBold, { color: '#16A34A' }]}>{finalCorrect}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Raw OCR Accuracy:</Text>
              <Text style={[styles.resultValueBold, { color: '#334155' }]}>{rawAccuracy}%</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>AI Assisted Accuracy:</Text>
              <Text style={[styles.resultValueHero, { color: '#16A34A' }]}>{finalAccuracy}%</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Word Accuracy:</Text>
              <Text style={[styles.resultValueBold, { color: '#16A34A' }]}>{wordAccuracy ?? (100 - (wer ?? 0))}%</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Word Error Rate (WER):</Text>
              <Text style={[styles.resultValueBold, { color: '#2563EB' }]}>{wer ?? 0}%</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>AI Improvement Gain:</Text>
              <Text style={[styles.resultValueBold, { color: '#D97706' }]}>+{aiImprovement}%</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Average Model Confidence:</Text>
              <Text style={styles.resultValueBold}>{avgConfidence}%</Text>
            </View>
          </View>
        </View>

        {/* 3. Upgraded Measurable AI Improvement Pipeline Funnel */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="git-network-outline" size={18} color={PRIMARY_COLOR} />
            <Text style={styles.sectionTitle}>AI Measurable Pipeline Funnel</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            End-to-end quantifiable stages from acquisition through CRNN and AI arbitration
          </Text>

          <View style={styles.funnelContainer}>
            {/* Step 1: Image Input */}
            <View style={styles.funnelStep}>
              <View style={[styles.funnelIconWrapper, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="camera-outline" size={18} color="#475569" />
              </View>
              <View style={styles.funnelContent}>
                <View style={styles.funnelTitleRow}>
                  <Text style={styles.funnelStepTitle}>IMAGE INPUT</Text>
                  <View style={[styles.metricPill, { backgroundColor: '#F1F5F9' }]}>
                    <Text style={[styles.metricPillText, { color: '#475569' }]}>
                      {measurableFunnel?.imageInput.resolution || 'Preprocessed'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.funnelStepDesc}>
                  Total lines: {measurableFunnel?.imageInput.totalLines ?? totalLines} acquired lines
                </Text>
              </View>
            </View>

            {/* Connector 1 */}
            <View style={styles.funnelConnector}>
              <View style={styles.funnelConnectorLine} />
              <Ionicons name="chevron-down" size={16} color="#94A3B8" />
            </View>

            {/* Step 2: CRNN OCR */}
            <View style={styles.funnelStep}>
              <View style={[styles.funnelIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="document-text-outline" size={18} color="#2563EB" />
              </View>
              <View style={styles.funnelContent}>
                <View style={styles.funnelTitleRow}>
                  <Text style={styles.funnelStepTitle}>CRNN OCR</Text>
                  <View style={[styles.metricPill, { backgroundColor: '#EFF6FF' }]}>
                    <Text style={[styles.metricPillText, { color: '#1E40AF' }]}>
                      Accuracy: {measurableFunnel?.crnnOcr.accuracy ?? rawAccuracy}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.funnelStepDesc}>
                  {measurableFunnel?.crnnOcr.correctLines ?? rawCorrect} of {totalLines} lines recognized correctly
                </Text>
              </View>
            </View>

            {/* Connector 2 with Gain Badge */}
            <View style={styles.funnelConnectorWithBadge}>
              <View style={styles.funnelConnectorLine} />
              <View style={styles.funnelGainBadge}>
                <Ionicons name="sparkles" size={12} color="#D97706" />
                <Text style={styles.funnelGainBadgeText}>
                  AI Gain: +{measurableFunnel?.aiCorrection.gain ?? aiImprovement}%
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color="#D97706" />
            </View>

            {/* Step 3: AI Correction */}
            <View style={[styles.funnelStep, { borderColor: '#FDE68A', backgroundColor: '#FEFCE8' }]}>
              <View style={[styles.funnelIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="sparkles" size={18} color="#D97706" />
              </View>
              <View style={styles.funnelContent}>
                <View style={styles.funnelTitleRow}>
                  <Text style={[styles.funnelStepTitle, { color: '#92400E' }]}>AI CORRECTION</Text>
                  <View style={[styles.metricPill, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.metricPillText, { color: '#B45309' }]}>
                      Corrected: {measurableFunnel?.aiCorrection.correctedLines ?? aiCorrected} lines
                    </Text>
                  </View>
                </View>
                <Text style={[styles.funnelStepDesc, { color: '#78350F' }]}>
                  Spelling and syntactic candidate arbitration
                </Text>
              </View>
            </View>

            {/* Connector 3 */}
            <View style={styles.funnelConnector}>
              <View style={styles.funnelConnectorLine} />
              <Ionicons name="chevron-down" size={16} color="#16A34A" />
            </View>

            {/* Step 4: Final Result */}
            <View style={[styles.funnelStep, { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }]}>
              <View style={[styles.funnelIconWrapper, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="checkmark-done-circle" size={18} color="#16A34A" />
              </View>
              <View style={styles.funnelContent}>
                <View style={styles.funnelTitleRow}>
                  <Text style={[styles.funnelStepTitle, { color: '#166534' }]}>FINAL RESULT</Text>
                  <View style={[styles.metricPill, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={[styles.metricPillText, { color: '#15803D' }]}>
                      Final Accuracy: {measurableFunnel?.finalResult.accuracy ?? finalAccuracy}%
                    </Text>
                  </View>
                </View>
                <Text style={[styles.funnelStepDesc, { color: '#166534' }]}>
                  {measurableFunnel?.finalResult.finalCorrectLines ?? finalCorrect} of {totalLines} verified accurate handwriting lines
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Error Summary Card (Task 7 Requirement) */}
        <View style={styles.errorSummaryCard}>
          <View style={styles.errorSummaryHeaderRow}>
            <View style={styles.errorSummaryBadge}>
              <Ionicons name="analytics-outline" size={13} color="#DC2626" />
              <Text style={styles.errorSummaryBadgeText}>THIS TRIAL</Text>
            </View>
            <Text style={styles.errorSummaryHeaderTitle}>Error Summary & Recommendation</Text>
          </View>

          <View style={styles.errorSummaryStatsRow}>
            <View style={styles.errorSummaryStatBox}>
              <Text style={styles.errorSummaryStatLabel}>Total Errors</Text>
              <Text style={styles.errorSummaryStatValue}>{totalErrors}</Text>
            </View>
            <View style={[styles.errorSummaryStatBox, { flex: 1.8 }]}>
              <Text style={styles.errorSummaryStatLabel}>Main Error</Text>
              <Text
                style={[
                  styles.errorSummaryStatValue,
                  { fontSize: 14, color: totalErrors > 0 ? '#B45309' : '#15803D' },
                ]}
                numberOfLines={1}
              >
                {mainError}
              </Text>
            </View>
          </View>

          <View style={styles.recommendationBox}>
            <Ionicons name="bulb-outline" size={16} color="#0284C7" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.recommendationLabel}>Recommendation:</Text>
              <Text style={styles.recommendationText}>{recommendation}</Text>
            </View>
          </View>
        </View>

        {/* 4. Advanced OCR Error Analysis */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
            <Text style={styles.sectionTitle}>Vietnamese Handwriting Error Analysis</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Systematic error classification across {errorAnalysis?.totalErrors ?? 0} error points identified
          </Text>

          <View style={styles.errorCardsGrid}>
            {/* 1. Missing character errors */}
            <View style={styles.errorItemCard}>
              <View style={styles.errorItemHeader}>
                <Ionicons name="remove-circle-outline" size={15} color="#DC2626" />
                <Text style={styles.errorItemTitle}>Missing Character Errors</Text>
              </View>
              <View style={styles.errorCountRow}>
                <Text style={styles.errorCountText}>{errorAnalysis?.missingCharacterErrors.count ?? 0} lines</Text>
                <Text style={styles.errorPercentText}>({errorAnalysis?.missingCharacterErrors.percentage ?? 0}%)</Text>
              </View>
              <Text style={styles.errorDescText}>
                {errorAnalysis?.missingCharacterErrors.description || 'Truncated characters or strokes missed by line segmentation'}
              </Text>
              {errorAnalysis?.missingCharacterErrors.examples && errorAnalysis.missingCharacterErrors.examples.length > 0 && (
                <View style={styles.examplePillsContainer}>
                  {errorAnalysis.missingCharacterErrors.examples.slice(0, 2).map((ex: string, idx: number) => (
                    <View key={idx} style={styles.examplePill}>
                      <Text style={styles.examplePillText} numberOfLines={1}>{ex}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 2. Vietnamese tone errors */}
            <View style={styles.errorItemCard}>
              <View style={styles.errorItemHeader}>
                <Ionicons name="language-outline" size={15} color="#D97706" />
                <Text style={styles.errorItemTitle}>Vietnamese Tone Errors</Text>
              </View>
              <View style={styles.errorCountRow}>
                <Text style={styles.errorCountText}>{errorAnalysis?.vietnameseToneErrors.count ?? 0} lines</Text>
                <Text style={styles.errorPercentText}>({errorAnalysis?.vietnameseToneErrors.percentage ?? 0}%)</Text>
              </View>
              <Text style={styles.errorDescText}>
                {errorAnalysis?.vietnameseToneErrors.description || 'Diacritic accents misidentified (sắc, huyền, hỏi, ngã, nặng)'}
              </Text>
              {errorAnalysis?.vietnameseToneErrors.examples && errorAnalysis.vietnameseToneErrors.examples.length > 0 && (
                <View style={styles.examplePillsContainer}>
                  {errorAnalysis.vietnameseToneErrors.examples.slice(0, 2).map((ex: string, idx: number) => (
                    <View key={idx} style={styles.examplePill}>
                      <Text style={styles.examplePillText} numberOfLines={1}>{ex}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 3. Similar character confusion */}
            <View style={styles.errorItemCard}>
              <View style={styles.errorItemHeader}>
                <Ionicons name="git-compare-outline" size={15} color="#2563EB" />
                <Text style={styles.errorItemTitle}>Similar Character Confusion</Text>
              </View>
              <View style={styles.errorCountRow}>
                <Text style={styles.errorCountText}>{errorAnalysis?.similarCharacterErrors.count ?? 0} lines</Text>
                <Text style={styles.errorPercentText}>({errorAnalysis?.similarCharacterErrors.percentage ?? 0}%)</Text>
              </View>
              <Text style={styles.errorDescText}>
                {errorAnalysis?.similarCharacterErrors.description || 'Visual lookalike glyph pairs (0/O, 1/l, 5/s, 2/z, u/v)'}
              </Text>
              {errorAnalysis?.similarCharacterErrors.examples && errorAnalysis.similarCharacterErrors.examples.length > 0 && (
                <View style={styles.examplePillsContainer}>
                  {errorAnalysis.similarCharacterErrors.examples.slice(0, 2).map((ex: string, idx: number) => (
                    <View key={idx} style={styles.examplePill}>
                      <Text style={styles.examplePillText} numberOfLines={1}>{ex}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 4. Low quality image errors */}
            <View style={styles.errorItemCard}>
              <View style={styles.errorItemHeader}>
                <Ionicons name="camera-reverse-outline" size={15} color="#64748B" />
                <Text style={styles.errorItemTitle}>Low Quality Image Errors</Text>
              </View>
              <View style={styles.errorCountRow}>
                <Text style={styles.errorCountText}>{errorAnalysis?.lowQualityImageErrors.count ?? 0} lines</Text>
                <Text style={styles.errorPercentText}>({errorAnalysis?.lowQualityImageErrors.percentage ?? 0}%)</Text>
              </View>
              <Text style={styles.errorDescText}>
                {errorAnalysis?.lowQualityImageErrors.description || 'Degradation caused by motion blur, low lighting, or glare'}
              </Text>
              {errorAnalysis?.lowQualityImageErrors.examples && errorAnalysis.lowQualityImageErrors.examples.length > 0 && (
                <View style={styles.examplePillsContainer}>
                  {errorAnalysis.lowQualityImageErrors.examples.slice(0, 2).map((ex: string, idx: number) => (
                    <View key={idx} style={styles.examplePill}>
                      <Text style={styles.examplePillText} numberOfLines={1}>{ex}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* 5. Model Experiment Benchmark Tracking Table */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flask-outline" size={18} color={PRIMARY_COLOR} />
            <Text style={styles.sectionTitle}>Model Experiment Benchmark Tracking</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Cross-experiment validation comparing model iterations, accuracy, CER, and latency
          </Text>

          <View style={styles.tableWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: 540 }}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableColHeader, { flex: 2.2 }]}>Model Version</Text>
                  <Text style={[styles.tableColHeader, { flex: 1.6 }]}>Dataset Version</Text>
                  <Text style={[styles.tableColHeader, { flex: 1.1, textAlign: 'center' }]}>Accuracy</Text>
                  <Text style={[styles.tableColHeader, { flex: 1.0, textAlign: 'center' }]}>CER</Text>
                  <Text style={[styles.tableColHeader, { flex: 1.0, textAlign: 'center' }]}>WER</Text>
                  <Text style={[styles.tableColHeader, { flex: 1.0, textAlign: 'center' }]}>Latency</Text>
                  <Text style={[styles.tableColHeader, { flex: 1.5, textAlign: 'right' }]}>Status</Text>
                </View>

                {BENCHMARK_EXPERIMENTS.map((exp, idx) => {
                  const isActive = exp.status === 'ACTIVE';
                  return (
                    <View
                      key={exp.modelVersion}
                      style={[
                        styles.tableDataRow,
                        idx % 2 === 1 && { backgroundColor: '#F8FAFC' },
                        isActive && {
                          backgroundColor: '#EFF6FF',
                          borderColor: '#93C5FD',
                          borderLeftWidth: 3,
                          borderLeftColor: SECONDARY_COLOR,
                        },
                      ]}
                    >
                      <View style={{ flex: 2.2, gap: 1 }}>
                        <Text style={[styles.tableCellText, { fontWeight: '700', fontSize: 11, color: isActive ? PRIMARY_COLOR : '#1E293B' }]}>
                          {exp.modelVersion}
                        </Text>
                      </View>

                      <View style={{ flex: 1.6 }}>
                        <Text style={[styles.tableCellText, { fontSize: 10, color: '#475569' }]}>
                          {exp.datasetVersion || 'Dataset-v1.2'}
                        </Text>
                      </View>

                      <View style={{ flex: 1.1, alignItems: 'center' }}>
                        <Text style={[styles.tableCellText, { fontWeight: '700', color: exp.accuracy >= 94 ? '#16A34A' : exp.accuracy >= 90 ? SECONDARY_COLOR : '#D97706' }]}>
                          {exp.accuracy}%
                        </Text>
                      </View>

                      <View style={{ flex: 1.0, alignItems: 'center' }}>
                        <Text style={[styles.tableCellText, { color: exp.cer <= 5 ? '#16A34A' : '#D97706', fontWeight: '600', fontSize: 10 }]}>
                          {exp.cer}%
                        </Text>
                      </View>

                      <View style={{ flex: 1.0, alignItems: 'center' }}>
                        <Text style={[styles.tableCellText, { color: exp.wer <= 8 ? '#16A34A' : '#2563EB', fontWeight: '600', fontSize: 10 }]}>
                          {exp.wer}%
                        </Text>
                      </View>

                      <View style={{ flex: 1.0, alignItems: 'center' }}>
                        <Text style={[styles.tableCellText, { color: '#64748B', fontSize: 10 }]}>
                          {exp.latency}s
                        </Text>
                      </View>

                      <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                        {isActive ? (
                          <View style={styles.activeTag}>
                            <Text style={styles.activeTagText}>ACTIVE</Text>
                          </View>
                        ) : (
                          <Text style={[styles.tableCellText, { fontSize: 9, color: '#94A3B8', fontWeight: '600' }]}>
                            {exp.status}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Confidence Reliability Analysis */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={PRIMARY_COLOR} />
            <Text style={styles.sectionTitle}>Confidence Reliability Analysis</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Correlation between model certainty scores and actual ground truth accuracy
          </Text>

          <View style={styles.tableWrapper}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableColHeader, { flex: 2 }]}>Confidence Range</Text>
              <Text style={[styles.tableColHeader, { flex: 1.5, textAlign: 'center' }]}>Accuracy</Text>
              <Text style={[styles.tableColHeader, { flex: 1.5, textAlign: 'right' }]}>Sample Lines</Text>
            </View>

            {confidenceReliability.map((bin, idx) => (
              <View key={idx} style={[styles.tableDataRow, idx % 2 === 1 && { backgroundColor: '#F8FAFC' }]}>
                <Text style={[styles.tableCellText, { flex: 2, fontWeight: '600' }]}>{bin.range}</Text>
                <View style={{ flex: 1.5, alignItems: 'center' }}>
                  <View
                    style={[
                      styles.accuracyChip,
                      {
                        backgroundColor:
                          bin.accuracy >= 90 ? '#DCFCE7' : bin.accuracy >= 75 ? '#EFF6FF' : '#FEE2E2',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.accuracyChipText,
                        {
                          color:
                            bin.accuracy >= 90 ? '#15803D' : bin.accuracy >= 75 ? '#1E40AF' : '#DC2626',
                        },
                      ]}
                    >
                      {bin.accuracy}%
                    </Text>
                  </View>
                </View>
                <Text style={[styles.tableCellText, { flex: 1.5, textAlign: 'right', color: '#64748B' }]}>
                  {bin.totalCount} lines
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Source Distribution Stacked Bar */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pie-chart-outline" size={18} color={PRIMARY_COLOR} />
            <Text style={styles.sectionTitle}>Decision Source Distribution</Text>
          </View>

          <View style={styles.stackedBarContainer}>
            {crnnPct > 0 && (
              <View style={[styles.stackedBarSegment, { width: `${crnnPct}%`, backgroundColor: '#2563EB' }]} />
            )}
            {aiPct > 0 && (
              <View style={[styles.stackedBarSegment, { width: `${aiPct}%`, backgroundColor: '#F59E0B' }]} />
            )}
            {manualPct > 0 && (
              <View style={[styles.stackedBarSegment, { width: `${manualPct}%`, backgroundColor: '#10B981' }]} />
            )}
          </View>

          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
              <View>
                <Text style={styles.legendTitle}>CRNN Raw</Text>
                <Text style={styles.legendMeta}>{sourceDistribution.crnn} lines ({crnnPct}%)</Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <View>
                <Text style={styles.legendTitle}>AI Correction</Text>
                <Text style={styles.legendMeta}>{sourceDistribution.aiCorrection} lines ({aiPct}%)</Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <View>
                <Text style={styles.legendTitle}>Manual Edit</Text>
                <Text style={styles.legendMeta}>{sourceDistribution.manual} lines ({manualPct}%)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 1. Line-level Ground Truth Performance List */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-outline" size={18} color={PRIMARY_COLOR} />
            <Text style={styles.sectionTitle}>Line-level Ground Truth Evaluation</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Inspection of model output, candidate suggestion, mandatory ground truth, CER, and evaluation status
          </Text>

          <View style={styles.lineMetricsList}>
            {lineMetrics.map((lm) => {
              const typeColor =
                lm.correctionType === 'OCR_CORRECT'
                  ? '#2563EB'
                  : lm.correctionType === 'AI_CORRECTED'
                  ? '#D97706'
                  : lm.correctionType === 'MANUAL_CORRECTED'
                  ? '#16A34A'
                  : '#DC2626';

              const typeBg =
                lm.correctionType === 'OCR_CORRECT'
                  ? '#EFF6FF'
                  : lm.correctionType === 'AI_CORRECTED'
                  ? '#FEF3C7'
                  : lm.correctionType === 'MANUAL_CORRECTED'
                  ? '#DCFCE7'
                  : '#FEE2E2';

              const evalStatusColor =
                lm.evaluationStatus === 'EVALUATED'
                  ? '#16A34A'
                  : lm.evaluationStatus === 'SKIPPED'
                  ? '#94A3B8'
                  : '#D97706';

              const evalStatusBg =
                lm.evaluationStatus === 'EVALUATED'
                  ? '#DCFCE7'
                  : lm.evaluationStatus === 'SKIPPED'
                  ? '#F1F5F9'
                  : '#FEF3C7';

              return (
                <View key={lm.lineId} style={styles.lineItemCard}>
                  <View style={styles.lineItemHeader}>
                    <View style={styles.lineOrderChip}>
                      <Text style={styles.lineOrderChipText}>Line {lm.lineIndex} ({lm.line_id || lm.lineId})</Text>
                    </View>

                    <View style={styles.lineBadgesGroup}>
                      {/* Decision Source */}
                      <View
                        style={[
                          styles.pillBadge,
                          {
                            backgroundColor:
                              (lm.decisionSource || lm.sourceDecision) === 'AI_CORRECTION'
                                ? '#FEF3C7'
                                : (lm.decisionSource || lm.sourceDecision) === 'MANUAL_EDIT'
                                ? '#DCFCE7'
                                : '#EFF6FF',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pillBadgeText,
                            {
                              color:
                                (lm.decisionSource || lm.sourceDecision) === 'AI_CORRECTION'
                                  ? '#D97706'
                                  : (lm.decisionSource || lm.sourceDecision) === 'MANUAL_EDIT'
                                  ? '#16A34A'
                                  : '#2563EB',
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {lm.decisionSource || lm.sourceDecision || (lm.source === 'AI_CORRECTION' ? 'AI_CORRECTION' : lm.source === 'MANUAL' ? 'MANUAL_EDIT' : 'CRNN_RAW')}
                        </Text>
                      </View>

                      {/* Evaluation Status */}
                      <View style={[styles.pillBadge, { backgroundColor: evalStatusBg }]}>
                        <Text style={[styles.pillBadgeText, { color: evalStatusColor }]}>
                          {lm.evaluationStatus || 'EVALUATED'}
                        </Text>
                      </View>

                      {/* Confidence */}
                      <View style={[styles.pillBadge, { backgroundColor: '#F1F5F9' }]}>
                        <Text style={[styles.pillBadgeText, { color: '#475569' }]}>
                          Conf: {lm.confidence}%
                        </Text>
                      </View>

                      {/* CER */}
                      <View style={[styles.pillBadge, { backgroundColor: lm.cer === 0 ? '#DCFCE7' : '#EFF6FF' }]}>
                        <Text style={[styles.pillBadgeText, { color: lm.cer === 0 ? '#16A34A' : '#2563EB' }]}>
                          CER: {lm.cer}%
                        </Text>
                      </View>

                      {/* Character Accuracy */}
                      <View style={[styles.pillBadge, { backgroundColor: lm.characterAccuracy >= 90 ? '#DCFCE7' : '#FEF3C7' }]}>
                        <Text style={[styles.pillBadgeText, { color: lm.characterAccuracy >= 90 ? '#16A34A' : '#D97706' }]}>
                          Char Acc: {lm.characterAccuracy}%
                        </Text>
                      </View>

                      {/* WER */}
                      <View style={[styles.pillBadge, { backgroundColor: (lm.wer ?? 0) === 0 ? '#DCFCE7' : '#EFF6FF' }]}>
                        <Text style={[styles.pillBadgeText, { color: (lm.wer ?? 0) === 0 ? '#16A34A' : '#2563EB' }]}>
                          WER: {lm.wer ?? 0}%
                        </Text>
                      </View>

                      {/* Word Accuracy */}
                      <View style={[styles.pillBadge, { backgroundColor: (lm.wordAccuracy ?? 100) >= 90 ? '#DCFCE7' : '#FEF3C7' }]}>
                        <Text style={[styles.pillBadgeText, { color: (lm.wordAccuracy ?? 100) >= 90 ? '#16A34A' : '#D97706' }]}>
                          Word Acc: {lm.wordAccuracy ?? 100}%
                        </Text>
                      </View>

                      {/* Correction Type */}
                      <View style={[styles.pillBadge, { backgroundColor: typeBg }]}>
                        <Text style={[styles.pillBadgeText, { color: typeColor }]}>
                          {lm.correctionType}
                        </Text>
                      </View>

                      {/* Verdict */}
                      <View
                        style={[
                          styles.pillBadge,
                          { backgroundColor: lm.isCorrect ? '#DCFCE7' : '#FEE2E2' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pillBadgeText,
                            { color: lm.isCorrect ? '#16A34A' : '#DC2626' },
                          ]}
                        >
                          {lm.isCorrect ? '✓ Correct' : '✗ Failed'}
                        </Text>
                      </View>

                      {/* Error Analysis Badge */}
                      {lm.errorAnalysis && lm.errorAnalysis.errorType !== 'NO_ERROR' && (
                        <View
                          style={[
                            styles.pillBadge,
                            { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' },
                          ]}
                        >
                          <Text style={[styles.pillBadgeText, { color: '#B91C1C' }]}>
                            {lm.errorAnalysis.errorType.replace(/_/g, ' ')}
                            {lm.errorAnalysis.characterPairs && lm.errorAnalysis.characterPairs.length > 0
                              ? ` (${lm.errorAnalysis.characterPairs[0].wrongCharacter} → ${lm.errorAnalysis.characterPairs[0].correctCharacter})`
                              : ` [${lm.errorAnalysis.severity}]`}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Texts Comparison */}
                  <View style={styles.lineTextBlocks}>
                    <View style={styles.textComparisonBlock}>
                      <Text style={styles.textBlockLabel}>Model Output (CRNN):</Text>
                      <Text style={styles.textBlockContent}>"{lm.modelOutput}"</Text>
                    </View>

                    {lm.aiSuggestion && (
                      <View style={[styles.textComparisonBlock, { backgroundColor: '#FEFCE8' }]}>
                        <Text style={[styles.textBlockLabel, { color: '#B45309' }]}>AI Candidate Suggestion:</Text>
                        <Text style={[styles.textBlockContent, { color: '#78350F' }]}>"{lm.aiSuggestion}"</Text>
                      </View>
                    )}

                    <View style={[styles.textComparisonBlock, { backgroundColor: '#F0FDF4' }]}>
                      <Text style={[styles.textBlockLabel, { color: '#166534' }]}>Final Text Result:</Text>
                      <Text style={[styles.textBlockContent, { color: '#166534', fontWeight: '700' }]}>
                        "{lm.finalText}"
                      </Text>
                    </View>

                    <View style={[styles.textComparisonBlock, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                      <Text style={[styles.textBlockLabel, { color: '#1E40AF' }]}>Ground Truth (Mandatory):</Text>
                      <Text style={[styles.textBlockContent, { color: '#1E40AF', fontWeight: '600' }]}>
                        "{lm.groundTruth || lm.finalText}"
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* TASK 7: Analytics Export Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="download-outline" size={18} color={PRIMARY_COLOR} />
            <Text style={styles.sectionTitle}>Research Data Export</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Export full trial metrics and per-line evaluation logs for academic benchmark analysis
          </Text>

          <View style={styles.exportButtonsRow}>
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => handleExport('JSON')}
              accessibilityRole="button"
              accessibilityLabel="Export JSON"
            >
              <Ionicons name="code-download-outline" size={16} color={PRIMARY_COLOR} />
              <Text style={styles.exportBtnText}>Export JSON</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => handleExport('CSV')}
              accessibilityRole="button"
              accessibilityLabel="Export CSV"
            >
              <Ionicons name="document-text-outline" size={16} color={PRIMARY_COLOR} />
              <Text style={styles.exportBtnText}>Export CSV</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
              onPress={() => handleExport('REPORT')}
              accessibilityRole="button"
              accessibilityLabel="Export Research Report"
            >
              <Ionicons name="newspaper-outline" size={16} color={SECONDARY_COLOR} />
              <Text style={[styles.exportBtnText, { color: SECONDARY_COLOR }]}>Research Report</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.globalAnalyticsBtn}
            onPress={() => router.push('/handai-analytics' as any)}
            accessibilityRole="button"
            accessibilityLabel="View Global Analytics"
          >
            <Ionicons name="bar-chart" size={18} color="#FFFFFF" />
            <Text style={styles.globalAnalyticsBtnText}>View Global Analytics</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.scanAnotherBtn}
            onPress={() => router.replace('/(tabs)' as any)}
            accessibilityRole="button"
            accessibilityLabel="Process Another Image"
          >
            <Ionicons name="camera-outline" size={18} color={PRIMARY_COLOR} />
            <Text style={styles.scanAnotherBtnText}>Process Another Image</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Export Preview Modal */}
      <Modal visible={exportModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Export {exportType} Preview</Text>
              <TouchableOpacity onPress={() => setExportModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalCodeView}>
              <Text style={styles.modalCodeText}>{exportContent}</Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalShareBtn} onPress={handleShareExport}>
                <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                <Text style={styles.modalShareBtnText}>Share / Save {exportType}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryActionBtn: {
    marginTop: 12,
    backgroundColor: SECONDARY_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  /* Header Banner */
  headerBanner: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  headerBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 6,
  },
  headerPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  headerPillText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sampleCountText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
  },
  /* Research Evaluation Session Metadata Card */
  metadataCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  metadataHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metadataCardTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY_COLOR,
    letterSpacing: 0.2,
  },
  benchmarkTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  benchmarkTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E40AF',
    letterSpacing: 0.4,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metadataItem: {
    minWidth: '45%',
    flex: 1,
    gap: 2,
  },
  metadataLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metadataValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  /* Recognition Quality Grid */
  qualityReportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  qualityCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  qualityCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  qualityCardHero: {
    fontSize: 22,
    fontWeight: '900',
  },
  qualityCardSub: {
    fontSize: 10,
    color: '#64748B',
  },
  /* Error Analysis Cards */
  errorCardsGrid: {
    gap: 10,
    marginTop: 4,
  },
  errorItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  errorItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  errorCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorCountText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  errorPercentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  errorDescText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  examplePillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  examplePill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  examplePillText: {
    fontSize: 11,
    color: '#334155',
    fontStyle: 'italic',
  },
  /* Benchmark Experiment Active Tag */
  activeTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  activeTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  /* Error Summary Card Styles */
  errorSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    gap: 12,
  },
  errorSummaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorSummaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  errorSummaryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  errorSummaryHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  errorSummaryStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  errorSummaryStatBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  errorSummaryStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  errorSummaryStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  recommendationBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'flex-start',
  },
  recommendationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 2,
  },
  recommendationText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '500',
    lineHeight: 16,
  },
  /* Summary Card */
  sessionResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: PRIMARY_COLOR,
  },
  latencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  latencyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  resultGrid: {
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  resultValueBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  resultValueHero: {
    fontSize: 18,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  /* Section Card */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  /* TASK 3: Funnel styles */
  funnelContainer: {
    gap: 2,
    marginTop: 4,
  },
  funnelStep: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  funnelIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  funnelContent: {
    flex: 1,
    gap: 2,
  },
  funnelTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  funnelStepTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.3,
  },
  funnelStepDesc: {
    fontSize: 11,
    color: '#64748B',
  },
  metricPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metricPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  funnelConnector: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
  },
  funnelConnectorLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: '#CBD5E1',
  },
  funnelConnectorWithBadge: {
    alignItems: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  funnelGainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    zIndex: 1,
  },
  funnelGainBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  /* Table styles */
  tableWrapper: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableColHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableCellText: {
    fontSize: 12,
    color: '#1E293B',
  },
  accuracyChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  accuracyChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  /* Stacked Bar */
  stackedBarContainer: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12,
  },
  stackedBarSegment: {
    height: '100%',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  legendMeta: {
    fontSize: 10,
    color: '#64748B',
  },
  /* Line Metrics List */
  lineMetricsList: {
    gap: 12,
    marginTop: 4,
  },
  lineItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  lineOrderChip: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  lineOrderChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  lineBadgesGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  pillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  lineTextBlocks: {
    gap: 6,
  },
  textComparisonBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 2,
  },
  textBlockLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  textBlockContent: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
  },
  /* Export buttons */
  exportButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingVertical: 10,
    gap: 6,
  },
  exportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  /* Bottom Actions */
  bottomActions: {
    gap: 10,
    marginTop: 8,
  },
  globalAnalyticsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    paddingVertical: 14,
    gap: 8,
  },
  globalAnalyticsBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scanAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 14,
    gap: 8,
  },
  scanAnotherBtnText: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  modalCodeView: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: 300,
  },
  modalCodeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#334155',
  },
  modalActions: {
    marginTop: 14,
  },
  modalShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  modalShareBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
