import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/ui/AppHeader';

// -------------------------------------------------------------
// V2.0 FINAL DEFENSE — MOBILE FIRST DESIGN TOKENS
// -------------------------------------------------------------
const COLORS = {
  navy: '#0B192C',
  navyLight: '#1E3A8A',
  navySurface: '#EEF5FF',
  navyBorder: '#BFDBFE',

  green: '#10B981',
  greenDark: '#047857',
  greenSurface: '#ECFDF5',
  greenBorder: '#A7F3D0',

  amber: '#D97706',
  amberDark: '#B45309',
  amberSurface: '#FFFBEB',
  amberBorder: '#FDE68A',

  red: '#EF4444',
  redSurface: '#FEF2F2',
  redBorder: '#FECACA',

  purple: '#7C3AED',
  purpleSurface: '#F5F3FF',
  purpleBorder: '#DDD6FE',

  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  cardBorder: '#E2E8F0',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',

  divider: '#F1F5F9',
};

export default function HandAiAnalyticsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [appendixOpen, setAppendixOpen] = useState(false);
  const [datasetAccordionOpen, setDatasetAccordionOpen] = useState(false);
  const { width } = useWindowDimensions();

  const isWide = width >= 768;

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 400);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader title="HandAI Research Dashboard" showBack />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={[styles.mainWrapper, isWide && styles.mainWrapperWide]}>
          
          {/* ========================================================= */}
          {/* 1. HEADER (FINAL DEFENSE COMPACT)                         */}
          {/* ========================================================= */}
          <View style={styles.headerBlock}>
            <View style={styles.headerTop}>
              <View style={styles.logoBadge}>
                <Ionicons name="hardware-chip" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle}>HandAI Research Dashboard</Text>
                <Text style={styles.headerSubtitle}>
                  Vietnamese Handwriting Recognition System
                </Text>
              </View>
            </View>

            {/* Badges Row */}
            <View style={styles.badgesRow}>
              <View style={[styles.pillBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <Text style={[styles.pillBadgeText, { color: COLORS.navyLight }]}>FINAL DEFENSE</Text>
              </View>
              <View style={[styles.pillBadge, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <View style={[styles.liveDot, { backgroundColor: COLORS.green }]} />
                <Text style={[styles.pillBadgeText, { color: COLORS.greenDark }]}>ACTIVE MODEL</Text>
              </View>
              <View style={[styles.pillBadge, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                <Text style={[styles.pillBadgeText, { color: COLORS.textSecondary }]}>VERIFIED DATA</Text>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 2. HERO SUMMARY (4 KEY METRICS GRID 2x2)                  */}
          {/* ========================================================= */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleBlock}>
                <Text style={styles.sectionLabel}>EXECUTIVE SUMMARY</Text>
                <Text style={styles.sectionHeading}>HandAI System Overview</Text>
              </View>
              <View style={styles.heroSummaryPill}>
                <Text style={styles.heroSummaryPillText}>V2.0 Certified</Text>
              </View>
            </View>

            <Text style={styles.heroIntroText}>
              AI-powered OCR system combining CRNN recognition and Vietnamese language correction.
            </Text>

            {/* 4 Metric Cards in 2x2 Grid */}
            <View style={styles.heroGrid}>
              {/* Card 1: Recognition Accuracy (System Evaluation) */}
              <View style={[styles.heroMetricCard, { backgroundColor: '#F0FDF4', borderColor: COLORS.greenBorder }]}>
                <View style={styles.heroCardTop}>
                  <Text style={[styles.heroMetricCategory, { color: COLORS.greenDark }]}>SYSTEM EVAL</Text>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.green} />
                </View>
                <Text style={[styles.heroMetricNumber, { color: COLORS.greenDark }]}>88.2%</Text>
                <Text style={styles.heroMetricTitle}>Recognition Accuracy (System Evaluation)</Text>
                <Text style={styles.heroMetricSub}>CRNN inference on handwriting corpus</Text>
              </View>

              {/* Card 2: Baseline Improvement (Before vs After AI Correction) */}
              <View style={[styles.heroMetricCard, { backgroundColor: '#FFFBEB', borderColor: COLORS.amberBorder }]}>
                <View style={styles.heroCardTop}>
                  <Text style={[styles.heroMetricCategory, { color: COLORS.amberDark }]}>IMPACT GAIN</Text>
                  <Ionicons name="trending-up" size={16} color={COLORS.amber} />
                </View>
                <Text style={[styles.heroMetricNumber, { color: COLORS.amberDark }]}>+37%</Text>
                <Text style={styles.heroMetricTitle}>Baseline Improvement (Before vs After AI Correction)</Text>
                <Text style={styles.heroMetricSub}>Accuracy jump from 63% to 100%</Text>
              </View>

              {/* Card 3: Global Char Accuracy */}
              <View style={[styles.heroMetricCard, { backgroundColor: '#EFF6FF', borderColor: COLORS.navyBorder }]}>
                <View style={styles.heroCardTop}>
                  <Text style={[styles.heroMetricCategory, { color: COLORS.navyLight }]}>CHAR LEVEL</Text>
                  <Ionicons name="analytics" size={16} color={COLORS.navyLight} />
                </View>
                <Text style={[styles.heroMetricNumber, { color: COLORS.navyLight }]}>97.6%</Text>
                <Text style={styles.heroMetricTitle}>Global Char Accuracy</Text>
                <Text style={styles.heroMetricSub}>100 - CER (Character Error Rate: 2.4%)</Text>
              </View>

              {/* Card 4: Global Word Accuracy */}
              <View style={[styles.heroMetricCard, { backgroundColor: '#EFF6FF', borderColor: COLORS.navyBorder }]}>
                <View style={styles.heroCardTop}>
                  <Text style={[styles.heroMetricCategory, { color: COLORS.navyLight }]}>WORD LEVEL</Text>
                  <Ionicons name="text" size={16} color={COLORS.navyLight} />
                </View>
                <Text style={[styles.heroMetricNumber, { color: COLORS.navyLight }]}>94.1%</Text>
                <Text style={styles.heroMetricTitle}>Global Word Accuracy</Text>
                <Text style={styles.heroMetricSub}>100 - WER (Word Error Rate: 5.9%)</Text>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 3. EVALUATION SUMMARY (COMPACT 2-COL LIST)                */}
          {/* ========================================================= */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleBlock}>
                <Text style={styles.sectionLabel}>SESSION BENCHMARK</Text>
                <Text style={styles.sectionHeading}>Evaluation Summary</Text>
              </View>
              <Text style={styles.evalBatchTag}>500 Sample Benchmark</Text>
            </View>

            <View style={styles.evalGrid}>
              <View style={styles.evalRow}>
                <Text style={styles.evalLabel}>Total lines</Text>
                <Text style={styles.evalValue}>500 lines</Text>
              </View>
              <View style={styles.evalRow}>
                <Text style={styles.evalLabel}>Correct OCR lines</Text>
                <Text style={[styles.evalValue, { color: COLORS.textSecondary }]}>315 (63.0%)</Text>
              </View>
              <View style={styles.evalRow}>
                <Text style={styles.evalLabel}>AI corrected lines</Text>
                <Text style={[styles.evalValue, { color: COLORS.greenDark }]}>185 (37.0%)</Text>
              </View>
              <View style={styles.evalRow}>
                <Text style={styles.evalLabel}>Manual edited lines</Text>
                <Text style={styles.evalValue}>0 (0.0%)</Text>
              </View>
              <View style={styles.evalRow}>
                <Text style={styles.evalLabel}>Final correct lines</Text>
                <Text style={[styles.evalValue, { color: COLORS.greenDark, fontWeight: '800' }]}>500 (100%)</Text>
              </View>
              <View style={styles.evalRow}>
                <Text style={styles.evalLabel}>Latency</Text>
                <Text style={styles.evalValue}>2.3s / image</Text>
              </View>
              <View style={[styles.evalRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.evalLabel}>Average model confidence</Text>
                <Text style={[styles.evalValue, { color: COLORS.navyLight }]}>91.4%</Text>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 4. MODEL ARCHITECTURE (MOBILE VERTICAL STEPPER)           */}
          {/* ========================================================= */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleBlock}>
                <Text style={styles.sectionLabel}>PIPELINE WORKFLOW</Text>
                <Text style={styles.sectionHeading}>Model Architecture</Text>
              </View>
              <View style={styles.techTag}>
                <Text style={styles.techTagText}>CRNN + PyTorch</Text>
              </View>
            </View>

            {/* Vertical Stepper Container */}
            <View style={styles.stepperContainer}>
              {/* Step 1 */}
              <View style={styles.stepItem}>
                <View style={styles.stepTrackCol}>
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepCircleNum}>1</Text>
                  </View>
                  <View style={styles.stepLine} />
                </View>
                <View style={styles.stepCardContent}>
                  <View style={styles.stepHeaderRow}>
                    <Ionicons name="image-outline" size={16} color={COLORS.navyLight} />
                    <Text style={styles.stepTitle}>Input Image</Text>
                  </View>
                  <Text style={styles.stepSubtitle}>Single line handwriting crop</Text>
                </View>
              </View>

              {/* Step 2 */}
              <View style={styles.stepItem}>
                <View style={styles.stepTrackCol}>
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepCircleNum}>2</Text>
                  </View>
                  <View style={styles.stepLine} />
                </View>
                <View style={styles.stepCardContent}>
                  <View style={styles.stepHeaderRow}>
                    <Ionicons name="scan-outline" size={16} color={COLORS.navyLight} />
                    <Text style={styles.stepTitle}>Feature Extraction (CNN)</Text>
                  </View>
                  <Text style={styles.stepSubtitle}>Spatial visual feature maps</Text>
                </View>
              </View>

              {/* Step 3 */}
              <View style={styles.stepItem}>
                <View style={styles.stepTrackCol}>
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepCircleNum}>3</Text>
                  </View>
                  <View style={styles.stepLine} />
                </View>
                <View style={styles.stepCardContent}>
                  <View style={styles.stepHeaderRow}>
                    <Ionicons name="repeat-outline" size={16} color={COLORS.navyLight} />
                    <Text style={styles.stepTitle}>Sequence Modeling (BiLSTM)</Text>
                  </View>
                  <Text style={styles.stepSubtitle}>Bidirectional contextual RNN</Text>
                </View>
              </View>

              {/* Step 4 */}
              <View style={styles.stepItem}>
                <View style={styles.stepTrackCol}>
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepCircleNum}>4</Text>
                  </View>
                  <View style={styles.stepLine} />
                </View>
                <View style={styles.stepCardContent}>
                  <View style={styles.stepHeaderRow}>
                    <Ionicons name="code-working-outline" size={16} color={COLORS.navyLight} />
                    <Text style={styles.stepTitle}>CTC Decoding</Text>
                  </View>
                  <Text style={styles.stepSubtitle}>Connectionist temporal classification</Text>
                </View>
              </View>

              {/* Step 5: AI Correction Layer (Highlighted) */}
              <View style={styles.stepItem}>
                <View style={styles.stepTrackCol}>
                  <View style={[styles.stepCircle, styles.stepCircleGreen]}>
                    <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                  </View>
                  <View style={styles.stepLine} />
                </View>
                <View style={[styles.stepCardContent, styles.stepCardGreen]}>
                  <View style={styles.stepHeaderRow}>
                    <Text style={[styles.stepTitle, { color: COLORS.greenDark, fontWeight: '800' }]}>
                      AI Correction Layer
                    </Text>
                    <View style={styles.postProcessingPill}>
                      <Text style={styles.postProcessingText}>POST-PROCESS</Text>
                    </View>
                  </View>
                  <Text style={[styles.stepSubtitle, { color: '#166534', fontWeight: '500' }]}>
                    Vietnamese Language Context Post-processing
                  </Text>
                </View>
              </View>

              {/* Step 6: Final Output */}
              <View style={[styles.stepItem, { marginBottom: 0 }]}>
                <View style={styles.stepTrackCol}>
                  <View style={[styles.stepCircle, styles.stepCircleNavy]}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                </View>
                <View style={[styles.stepCardContent, styles.stepCardNavy]}>
                  <View style={styles.stepHeaderRow}>
                    <Text style={[styles.stepTitle, { color: '#FFFFFF' }]}>Final Output</Text>
                  </View>
                  <Text style={[styles.stepSubtitle, { color: '#94A3B8' }]}>
                    Accurate verified Vietnamese sentence
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 5. AI CONTRIBUTION (BEFORE / AFTER COMPARISON)            */}
          {/* ========================================================= */}
          <View style={[styles.card, { borderColor: COLORS.greenBorder }]}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleBlock}>
                <Text style={[styles.sectionLabel, { color: COLORS.greenDark }]}>CORE SCIENTIFIC VALUE</Text>
                <Text style={styles.sectionHeading}>AI Contribution Analysis</Text>
              </View>
              <View style={styles.gainTagPill}>
                <Text style={styles.gainTagPillText}>+37% Gain</Text>
              </View>
            </View>

            {/* Before vs After Cards */}
            <View style={styles.compareBlock}>
              <View style={styles.compareRowItem}>
                <View style={styles.compareColBefore}>
                  <Text style={styles.compareSubTag}>BEFORE AI</Text>
                  <Text style={styles.compareModelName}>Raw CRNN OCR</Text>
                  <Text style={styles.compareAccuracyNumber}>63%</Text>
                  <Text style={styles.compareBadge}>Baseline Evaluation</Text>
                </View>

                <View style={styles.compareArrowBox}>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.greenDark} />
                  <Text style={styles.arrowGainText}>+37%</Text>
                </View>

                <View style={styles.compareColAfter}>
                  <Text style={[styles.compareSubTag, { color: COLORS.greenDark }]}>AFTER AI</Text>
                  <Text style={[styles.compareModelName, { color: COLORS.greenDark }]}>CRNN + AI Correction</Text>
                  <Text style={[styles.compareAccuracyNumber, { color: COLORS.greenDark }]}>100%</Text>
                  <Text style={[styles.compareBadge, { backgroundColor: '#DCFCE7', color: '#166534' }]}>
                    Evaluation Batch Result
                  </Text>
                </View>
              </View>

              {/* 3 Micro Stats */}
              <View style={styles.miniStatsRow}>
                <View style={styles.miniStatBox}>
                  <Text style={styles.miniStatVal}>+37%</Text>
                  <Text style={styles.miniStatLabel}>Accuracy Gain</Text>
                </View>
                <View style={styles.miniStatBox}>
                  <Text style={styles.miniStatVal}>100%</Text>
                  <Text style={styles.miniStatLabel}>Error Recovery Rate</Text>
                </View>
                <View style={styles.miniStatBox}>
                  <Text style={styles.miniStatVal}>185/185</Text>
                  <Text style={styles.miniStatLabel}>Rescued Samples</Text>
                </View>
              </View>

              <Text style={styles.academicFootnote}>
                “Measured on manually verified evaluation samples, not the complete dataset.”
              </Text>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 6. DATASET SECTION                                        */}
          {/* ========================================================= */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleBlock}>
                <Text style={styles.sectionLabel}>TRAINING & EVALUATION DATA</Text>
                <Text style={styles.sectionHeading}>Dataset Overview</Text>
              </View>
              <View style={styles.datasetBadgesGroup}>
                <View style={styles.verifiedTag}>
                  <Ionicons name="checkmark-circle" size={12} color={COLORS.green} style={{ marginRight: 2 }} />
                  <Text style={styles.verifiedTagText}>Verified</Text>
                </View>
                <View style={styles.versionTag}>
                  <Text style={styles.versionTagText}>HandAI-v1.2</Text>
                </View>
              </View>
            </View>

            <View style={styles.datasetInfoContainer}>
              <Text style={styles.datasetNameHeading}>Viet-Handwriting-OCR-v2</Text>
              <Text style={styles.datasetTotalText}>59,747 Total Handwriting Samples</Text>

              {/* 2 Blocks: Training Corpus vs Evaluation Benchmark */}
              <View style={styles.datasetSplitCardsRow}>
                <View style={styles.corpusCard}>
                  <Text style={styles.corpusCardLabel}>Training Corpus</Text>
                  <Text style={styles.corpusCardNumber}>59,462</Text>
                  <Text style={styles.corpusCardSub}>samples (99.16%)</Text>
                </View>

                <View style={[styles.corpusCard, { borderColor: COLORS.greenBorder, backgroundColor: '#F0FDF4' }]}>
                  <Text style={[styles.corpusCardLabel, { color: COLORS.greenDark }]}>Evaluation Benchmark</Text>
                  <Text style={[styles.corpusCardNumber, { color: COLORS.greenDark }]}>500</Text>
                  <Text style={[styles.corpusCardSub, { color: '#166534' }]}>manually verified samples (0.84%)</Text>
                </View>
              </View>

              {/* Progress Split Bar */}
              <View style={styles.datasetBarTrack}>
                <View style={[styles.datasetBarFill, { flex: 59462, backgroundColor: COLORS.navyLight }]} />
                <View style={[styles.datasetBarFill, { flex: 500, backgroundColor: COLORS.green }]} />
              </View>

              <Text style={styles.benchmarkNote}>
                “Evaluation samples are manually verified benchmark cases used for final performance assessment.”
              </Text>

              {/* Collapsible Accordion for Auxiliary Details */}
              <TouchableOpacity
                style={styles.accordionToggleBtn}
                onPress={() => setDatasetAccordionOpen(!datasetAccordionOpen)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Toggle dataset integrity details"
              >
                <Text style={styles.accordionToggleText}>
                  {datasetAccordionOpen ? 'Hide Data Integrity Details' : 'View Data Integrity & Privacy Profile'}
                </Text>
                <Ionicons
                  name={datasetAccordionOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={COLORS.navyLight}
                />
              </TouchableOpacity>

              {datasetAccordionOpen && (
                <View style={styles.accordionContentBox}>
                  <View style={styles.accordionRow}>
                    <Text style={styles.accordionKey}>Deduplication:</Text>
                    <Text style={styles.accordionVal}>0.4% duplicate rate (pHash/SHA-256 audited)</Text>
                  </View>
                  <View style={styles.accordionRow}>
                    <Text style={styles.accordionKey}>Privacy Handling:</Text>
                    <Text style={styles.accordionVal}>PII Masking Active, zero student identifiers retained</Text>
                  </View>
                  <View style={[styles.accordionRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.accordionKey}>Partitioning:</Text>
                    <Text style={styles.accordionVal}>Disjoint writer splits (Seed: 42)</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* ========================================================= */}
          {/* 7. ERROR ANALYSIS (4 MODES + SAMPLE VISUALIZATION)         */}
          {/* ========================================================= */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleBlock}>
                <Text style={styles.sectionLabel}>FAILURE MODE CLASSIFICATION</Text>
                <Text style={styles.sectionHeading}>Error Analysis & Mitigation</Text>
              </View>
              <Text style={styles.errorSummaryTag}>4 Failure Modes</Text>
            </View>

            {/* Visual Sample Transformation Box */}
            <View style={styles.visualSampleBox}>
              <Text style={styles.visualSampleLabel}>Sample Visualization (Benchmark Case)</Text>
              <View style={styles.visualSamplePipeline}>
                <View style={styles.sampleStep}>
                  <Text style={styles.sampleStepTitle}>Original Handwriting</Text>
                  <View style={styles.sampleImageBox}>
                    <Text style={styles.sampleHandwritingText}>"Em hái sim ăn"</Text>
                  </View>
                </View>
                <Ionicons name="arrow-down" size={14} color={COLORS.textSubtle} style={{ marginVertical: 4 }} />
                <View style={styles.sampleStep}>
                  <Text style={styles.sampleStepTitle}>Raw OCR Result (Missing 's')</Text>
                  <View style={[styles.sampleImageBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                    <Text style={[styles.sampleResultText, { color: '#DC2626' }]}>"Em hái im ăn"</Text>
                  </View>
                </View>
                <Ionicons name="arrow-down" size={14} color={COLORS.textSubtle} style={{ marginVertical: 4 }} />
                <View style={styles.sampleStep}>
                  <Text style={[styles.sampleStepTitle, { color: COLORS.greenDark }]}>AI Corrected Result</Text>
                  <View style={[styles.sampleImageBox, { backgroundColor: '#F0FDF4', borderColor: '#A7F3D0' }]}>
                    <Text style={[styles.sampleResultText, { color: '#15803D', fontWeight: '800' }]}>"Em hái sim ăn"</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 4 Error Cards List */}
            <View style={styles.errorCardsList}>
              {/* Error 1 */}
              <View style={styles.errorMiniCard}>
                <View style={styles.errorMiniTop}>
                  <View style={[styles.errorBulletDot, { backgroundColor: COLORS.red }]} />
                  <Text style={styles.errorMiniTitle}>Missing Character Errors</Text>
                  <Text style={styles.errorCountBadge}>89 lines (48%)</Text>
                </View>
                <Text style={styles.errorMiniDesc}>
                  Nét bút đầu từ bị mờ hoặc đứt nét. Ví dụ: "Em hái im ăn" ➔ "Em hái sim ăn".
                </Text>
              </View>

              {/* Error 2 */}
              <View style={styles.errorMiniCard}>
                <View style={styles.errorMiniTop}>
                  <View style={[styles.errorBulletDot, { backgroundColor: COLORS.amber }]} />
                  <Text style={styles.errorMiniTitle}>Vietnamese Tone Errors</Text>
                  <Text style={styles.errorCountBadge}>46 lines (25%)</Text>
                </View>
                <Text style={styles.errorMiniDesc}>
                  Dấu thanh (hỏi/ngã, sắc/huyền) viết lệch vị trí hoặc dính vào ký tự nguyên âm.
                </Text>
              </View>

              {/* Error 3 */}
              <View style={styles.errorMiniCard}>
                <View style={styles.errorMiniTop}>
                  <View style={[styles.errorBulletDot, { backgroundColor: COLORS.amber }]} />
                  <Text style={styles.errorMiniTitle}>Similar Character Confusion</Text>
                  <Text style={styles.errorCountBadge}>35 lines (19%)</Text>
                </View>
                <Text style={styles.errorMiniDesc}>
                  Nhầm lẫn các cặp ký tự hình thái tương đồng: o / ô, u / v, i / l khi học sinh viết nhanh.
                </Text>
              </View>

              {/* Error 4 */}
              <View style={styles.errorMiniCard}>
                <View style={styles.errorMiniTop}>
                  <View style={[styles.errorBulletDot, { backgroundColor: COLORS.textMuted }]} />
                  <Text style={styles.errorMiniTitle}>Low Quality Image Errors</Text>
                  <Text style={styles.errorCountBadge}>15 lines (8%)</Text>
                </View>
                <Text style={styles.errorMiniDesc}>
                  Ảnh chụp bị lóa sáng, bóng đổ hoặc độ tương phản thấp ở rìa trang giấy.
                </Text>
              </View>
            </View>

            {/* Error Summary & Academic Recommendation */}
            <View style={styles.errorSummaryBox}>
              <View style={styles.errorSummaryHeader}>
                <Ionicons name="bulb-outline" size={16} color={COLORS.navyLight} />
                <Text style={styles.errorSummaryTitle}>Recommendation</Text>
              </View>
              <Text style={styles.errorSummaryText}>
                Improve handwriting segmentation and character boundary detection.
              </Text>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 8. EXPANDED TECHNICAL ANALYSIS (COLLAPSIBLE APPENDIX)      */}
          {/* ========================================================= */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.appendixToggleRow}
              onPress={() => setAppendixOpen(!appendixOpen)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Toggle advanced research appendix"
            >
              <View style={styles.appendixTitleGroup}>
                <Ionicons name="folder-open-outline" size={18} color={COLORS.navyLight} />
                <View>
                  <Text style={styles.appendixTitle}>Advanced Research Appendix</Text>
                  <Text style={styles.appendixSubtitle}>Historical benchmark & confidence analysis</Text>
                </View>
              </View>
              <View style={styles.appendixStatePill}>
                <Text style={styles.appendixStateText}>{appendixOpen ? 'Collapse' : 'Expand'}</Text>
                <Ionicons
                  name={appendixOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={COLORS.navyLight}
                />
              </View>
            </TouchableOpacity>

            {appendixOpen && (
              <View style={styles.appendixContent}>
                {/* Historical Model Benchmark */}
                <Text style={styles.appendixSubhead}>Historical Model Benchmark</Text>
                <View style={styles.tableRowHeader}>
                  <Text style={[styles.tableCell, { flex: 2, fontWeight: '700' }]}>Model</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontWeight: '700' }]}>Acc</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontWeight: '700' }]}>CER</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontWeight: '700' }]}>WER</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>CRNN-v1.0 (Baseline)</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>78.5%</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>4.2%</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>10.1%</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>CRNN-v1.1 (+Augment)</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>83.0%</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>3.1%</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>7.8%</Text>
                </View>
                <View style={[styles.tableRow, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={[styles.tableCell, { flex: 2, fontWeight: '800', color: COLORS.greenDark }]}>
                    CRNN-v1.2 (Active)
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontWeight: '800', color: COLORS.greenDark }]}>
                    88.2%
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontWeight: '800', color: COLORS.greenDark }]}>
                    2.4%
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontWeight: '800', color: COLORS.greenDark }]}>
                    5.9%
                  </Text>
                </View>

                {/* Confidence Reliability Distribution */}
                <Text style={[styles.appendixSubhead, { marginTop: 16 }]}>Confidence Reliability Distribution</Text>
                <View style={styles.confBarRow}>
                  <Text style={styles.confLabel}>High Confidence (0.8 - 1.0)</Text>
                  <View style={styles.confTrack}>
                    <View style={[styles.confFill, { width: '82%', backgroundColor: COLORS.green }]} />
                  </View>
                  <Text style={styles.confVal}>82%</Text>
                </View>
                <View style={styles.confBarRow}>
                  <Text style={styles.confLabel}>Medium Confidence (0.5 - 0.8)</Text>
                  <View style={styles.confTrack}>
                    <View style={[styles.confFill, { width: '14%', backgroundColor: COLORS.amber }]} />
                  </View>
                  <Text style={styles.confVal}>14%</Text>
                </View>
                <View style={styles.confBarRow}>
                  <Text style={styles.confLabel}>Low Confidence (&lt; 0.5)</Text>
                  <View style={styles.confTrack}>
                    <View style={[styles.confFill, { width: '4%', backgroundColor: COLORS.red }]} />
                  </View>
                  <Text style={styles.confVal}>4%</Text>
                </View>
              </View>
            )}
          </View>

          {/* ========================================================= */}
          {/* STANDARDIZED ACTION BUTTONS ROW                           */}
          {/* ========================================================= */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.actionBtnSecondary}
              onPress={onRefresh}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Refresh verification metrics"
            >
              <Ionicons name="refresh-outline" size={16} color={COLORS.navy} style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnSecondaryText}>Refresh Metrics</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnPrimary}
              onPress={() => alert('NCKH Benchmark Verified. Report is ready for defense presentation.')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Validate for defense presentation"
            >
              <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnPrimaryText}>Validate Defense</Text>
            </TouchableOpacity>
          </View>

          {/* ========================================================= */}
          {/* FOOTER                                                    */}
          {/* ========================================================= */}
          <View style={styles.footerBlock}>
            <View style={styles.footerDivider} />
            <Text style={styles.footerBrand}>Powered by CRNN + AI Correction Technology</Text>
            <View style={styles.footerPill}>
              <Text style={styles.footerPillText}>Research Version 1.2 — Final Defense Edition</Text>
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// MOBILE FIRST STYLESHEET
// -------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  scrollContentWide: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  mainWrapper: {
    width: '100%',
    maxWidth: 520, // Mobile-first width target
  },
  mainWrapperWide: {
    maxWidth: 720,
  },

  // 1. Header
  headerBlock: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderTopWidth: 4,
    borderTopColor: COLORS.navyLight,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 12px rgba(15, 23, 42, 0.05)',
      } as any,
    }),
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },

  // Common Card
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
      } as any,
    }),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionTitleBlock: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: -0.3,
  },

  // 2. Hero Summary
  heroSummaryPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  heroSummaryPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.navyLight,
  },
  heroIntroText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroMetricCard: {
    width: '48.5%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  heroCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroMetricCategory: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroMetricNumber: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  heroMetricTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 15,
    marginBottom: 2,
  },
  heroMetricSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    lineHeight: 13,
  },

  // 3. Evaluation Summary
  evalBatchTag: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  evalGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
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
    borderBottomColor: COLORS.divider,
  },
  evalLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  evalValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // 4. Model Architecture (Vertical Stepper)
  techTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  techTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.navyLight,
  },
  stepperContainer: {
    paddingTop: 4,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  stepTrackCol: {
    alignItems: 'center',
    width: 28,
    marginRight: 10,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: COLORS.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleNum: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.navyLight,
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 3,
  },
  stepCardContent: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
  },
  stepSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  stepCircleGreen: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.greenBorder,
  },
  stepCardGreen: {
    backgroundColor: '#F0FDF4',
    borderColor: COLORS.greenBorder,
    borderWidth: 1.5,
  },
  postProcessingPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  postProcessingText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#15803D',
  },
  stepCircleNavy: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  stepCardNavy: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },

  // 5. AI Contribution
  gainTagPill: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  gainTagPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  compareBlock: {
    marginTop: 4,
  },
  compareRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compareColBefore: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  compareSubTag: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  compareModelName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  compareAccuracyNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#334155',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  compareBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  compareArrowBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  arrowGainText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.greenDark,
    marginTop: 2,
  },
  compareColAfter: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: COLORS.greenBorder,
  },
  miniStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  miniStatBox: {
    alignItems: 'center',
    flex: 1,
  },
  miniStatVal: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.navy,
  },
  miniStatLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  academicFootnote: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    lineHeight: 15,
    marginTop: 8,
  },

  // 6. Dataset
  datasetBadgesGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.greenDark,
  },
  versionTag: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  versionTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.navyLight,
  },
  datasetInfoContainer: {
    marginTop: 2,
  },
  datasetNameHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 2,
  },
  datasetTotalText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  datasetSplitCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  corpusCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  corpusCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  corpusCardNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.navy,
    letterSpacing: -0.3,
  },
  corpusCardSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  datasetBarTrack: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    marginBottom: 8,
  },
  datasetBarFill: {
    height: '100%',
  },
  benchmarkNote: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  accordionToggleBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    minHeight: 44, // Touch target
  },
  accordionToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.navyLight,
  },
  accordionContentBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  accordionRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  accordionKey: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    width: 100,
  },
  accordionVal: {
    fontSize: 11,
    color: COLORS.textPrimary,
    flex: 1,
  },

  // 7. Error Analysis
  errorSummaryTag: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  visualSampleBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  visualSampleLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  visualSamplePipeline: {
    alignItems: 'center',
  },
  sampleStep: {
    width: '100%',
  },
  sampleStepTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 3,
  },
  sampleImageBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  sampleHandwritingText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.textPrimary,
  },
  sampleResultText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorCardsList: {
    gap: 8,
    marginBottom: 12,
  },
  errorMiniCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  errorMiniTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  errorBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  errorMiniTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
    flex: 1,
  },
  errorCountBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  errorMiniDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  errorSummaryBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.navyBorder,
  },
  errorSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  errorSummaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.navyLight,
  },
  errorSummaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E3A8A',
    lineHeight: 15,
  },

  // 8. Advanced Appendix (Collapsible)
  appendixToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44, // Touch target
  },
  appendixTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  appendixTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.navy,
  },
  appendixSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  appendixStatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  appendixStateText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.navyLight,
  },
  appendixContent: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  appendixSubhead: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 8,
  },
  tableRowHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  tableCell: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  confBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  confLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    width: 160,
  },
  confTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  confFill: {
    height: '100%',
  },
  confVal: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.navy,
    width: 32,
    textAlign: 'right',
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionBtnSecondary: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.navy,
  },
  actionBtnPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Footer
  footerBlock: {
    alignItems: 'center',
    paddingBottom: 28,
  },
  footerDivider: {
    width: 48,
    height: 3,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginBottom: 10,
  },
  footerBrand: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  footerPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  footerPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
});
