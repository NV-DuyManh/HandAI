import React from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ComparisonStat {
  label: string;
  value: string;
  color?: string;
}

export interface ComparisonCardProps {
  // New scientific impact props
  rawBaselineLabel?: string;
  rawBaselineValue?: string;
  rawOcrLabel?: string;
  rawOcrValue?: string;
  aiContributionLabel?: string;
  aiContributionValue?: string;
  aiImprovementLabel?: string;
  aiImprovementValue?: string;
  verifiedResultLabel?: string;
  verifiedResultValue?: string;
  verifiedOutcomeLabel?: string;
  verifiedOutcomeValue?: string;
  verifiedBadge?: string;
  note?: string;
  gainUnit?: 'percent' | 'percentagePoints';
  contributionDescription?: string;
  formulaContributionLabel?: string;
  formulaResultLabel?: string;

  // Backward compatibility props
  beforeTag?: string;
  beforeTitle?: string;
  beforeValue?: string;
  beforeBadge?: string;
  afterTag?: string;
  afterTitle?: string;
  afterValue?: string;
  afterBadge?: string;
  gainBadge?: string;
  microStats?: ComparisonStat[];
  footnote?: string;
  style?: ViewStyle;
  testID?: string;
}

/**
 * ComparisonCard — Scientific 3-step AI Assistance Impact card.
 * Clearly articulates:
 * Raw OCR Baseline + AI Language Contribution = Verified Outcome
 * Without falsely claiming "AI Accuracy = 100%".
 */
import { formatMetricPercent } from '../../utils/metricFormat';

export const ComparisonCard: React.FC<ComparisonCardProps> = ({
  rawBaselineLabel,
  rawBaselineValue,
  rawOcrLabel,
  rawOcrValue,
  aiContributionLabel,
  aiContributionValue,
  aiImprovementLabel,
  aiImprovementValue,
  verifiedResultLabel,
  verifiedOutcomeLabel,
  verifiedResultValue,
  verifiedOutcomeValue,
  verifiedBadge,
  note,
  gainUnit = 'percent',
  contributionDescription = 'Contextual Vietnamese linguistic correction',
  formulaContributionLabel = 'AI Assistance Contribution',
  formulaResultLabel = 'Human Verified Outcome',

  beforeTag,
  beforeTitle = 'RAW OCR BASELINE',
  beforeValue,
  beforeBadge,
  afterTag,
  afterTitle = 'VERIFIED RESULT',
  afterValue,
  afterBadge,
  gainBadge,
  microStats,
  footnote,
  style,
  testID,
}) => {
  // Resolve values prioritizing new scientific naming
  const rawRawVal = rawBaselineValue || rawOcrValue || beforeValue;
  const displayRawTitle = rawBaselineLabel || rawOcrLabel || beforeTitle || 'RAW OCR BASELINE';
  const displayRawValue = formatMetricPercent(rawRawVal);

  const gainRawVal = aiContributionValue || aiImprovementValue || gainBadge;
  const displayGainTitle = aiContributionLabel || aiImprovementLabel || 'AI ASSISTANCE CONTRIBUTION';
  const formattedGainPercent = formatMetricPercent(gainRawVal, { withSign: true });
  const formattedGain = gainUnit === 'percentagePoints'
    ? formattedGainPercent.replace('%', ' pp')
    : formattedGainPercent;
  const displayGainValue = formattedGain === '—' ? '—' : `${formattedGain} improvement`;

  const verifiedRawVal = verifiedResultValue || verifiedOutcomeValue || afterValue;
  const displayVerifiedTitle = verifiedResultLabel || verifiedOutcomeLabel || afterTitle || 'VERIFIED RESULT';
  const displayVerifiedValue = formatMetricPercent(verifiedRawVal);
  const displayVerifiedBadge = verifiedBadge || afterBadge;

  const displayNote = note || footnote || 'AI contribution represents recovered recognition errors after language-context post-processing.';

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* 3-Step Scientific Flow */}
      <View style={styles.flowContainer}>

        {/* STEP 1: RAW OCR BASELINE */}
        <View style={styles.stepBlock}>
          <View style={styles.stepHeaderRow}>
            <View style={styles.stepTagBadge}>
              <Text style={styles.stepTagText}>{beforeTag || 'STEP 1: BASELINE'}</Text>
            </View>
            {beforeBadge ? (
              <View style={styles.baselinePill}>
                <Text style={styles.baselinePillText}>{beforeBadge}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricTextGroup}>
              <Text style={styles.modelName}>{displayRawTitle}</Text>
              <Text style={styles.modelSub}>Initial handwriting prediction before post-processing</Text>
            </View>
            <Text style={styles.rawAccuracyNumber}>{displayRawValue}</Text>
          </View>
        </View>

        {/* STEP 2: AI LANGUAGE CONTRIBUTION (Transition Flow) */}
        <View style={styles.transitionContainer}>
          <View style={styles.arrowLine} />

          <View style={styles.aiImpactCard}>
            <View style={styles.aiImpactTopRow}>
              <View style={styles.sparkleWrap}>
                <Ionicons name="sparkles" size={13} color="#7C3AED" />
              </View>
              <Text style={styles.aiImpactLabel}>{displayGainTitle}</Text>
            </View>
            <Text style={styles.aiImpactValue}>{displayGainValue}</Text>
            <Text style={styles.aiImpactSub}>{contributionDescription}</Text>
          </View>

          <View style={styles.arrowLine} />
          <Ionicons name="arrow-down" size={14} color="#7C3AED" style={styles.downArrowIcon} />
        </View>

        {/* STEP 3: VERIFIED OUTCOME (Post-Review Ground Truth) */}
        <View style={styles.verifiedBlock}>
          <View style={styles.verifiedGlowBar} />

          <View style={styles.stepHeaderRow}>
            <View style={styles.verifiedTagRow}>
              <View style={styles.verifiedDot} />
              <Text style={styles.verifiedTagText}>{afterTag || 'STEP 3: GROUND TRUTH VALIDATED'}</Text>
            </View>
            {displayVerifiedBadge ? (
              <View style={styles.evalBatchBadge}>
                <Text style={styles.evalBatchBadgeText}>{displayVerifiedBadge}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricTextGroup}>
              <Text style={styles.verifiedModelName}>{displayVerifiedTitle}</Text>
              <Text style={styles.verifiedModelSub}>
                After ground truth evaluation
              </Text>
            </View>
            <Text style={styles.verifiedAccuracyNumber}>{displayVerifiedValue}</Text>
          </View>
        </View>
      </View>

      {/* Scientific Formula Bar: Raw OCR Baseline + AI Assistance Contribution = Human Verified Outcome */}
      <View style={styles.formulaStrip}>
        <Text style={styles.formulaEquation}>
          <Text style={[styles.formulaPart, { color: '#1D4ED8' }]}>Raw OCR Baseline ({displayRawValue})</Text>
          <Text style={styles.formulaOperator}> + </Text>
          <Text style={[styles.formulaPart, { color: '#6D28D9' }]}>{formulaContributionLabel} ({formattedGain})</Text>
          <Text style={styles.formulaOperator}> = </Text>
          <Text style={[styles.formulaPart, { color: '#047857', fontWeight: '800' }]}>{formulaResultLabel} ({displayVerifiedValue})</Text>
        </Text>
        <Text style={styles.formulaSubCaption}>After ground truth evaluation</Text>
      </View>

      {/* Optional Micro Stats */}
      {microStats && microStats.length > 0 && (
        <View style={styles.microStatsRow}>
          {microStats.map((stat, i) => (
            <View key={i} style={styles.microStatCol}>
              <Text style={[styles.microStatVal, stat.color ? { color: stat.color } : null]}>
                {stat.value}
              </Text>
              <Text style={styles.microStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Scientific Note */}
      <View style={styles.noteBox}>
        <Ionicons name="information-circle-outline" size={14} color="#059669" style={{ marginRight: 6 }} />
        <Text style={styles.noteText}>{displayNote}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
      },
    }),
  },
  flowContainer: {
    gap: 2,
  },
  stepBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepTagBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stepTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  baselinePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  baselinePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricTextGroup: {
    flex: 1,
    marginRight: 10,
  },
  modelName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  modelSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  rawAccuracyNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#334155',
    fontVariant: ['tabular-nums'],
  },

  // Transition / Bridge
  transitionContainer: {
    alignItems: 'center',
    marginVertical: 4,
  },
  arrowLine: {
    width: 2,
    height: 8,
    backgroundColor: '#DDD6FE',
  },
  downArrowIcon: {
    marginTop: 2,
  },
  aiImpactCard: {
    width: '100%',
    backgroundColor: '#FAF5FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  aiImpactTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  sparkleWrap: {
    marginRight: 5,
  },
  aiImpactLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6D28D9',
    letterSpacing: 0.6,
  },
  aiImpactValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#7C3AED',
    marginVertical: 2,
    fontVariant: ['tabular-nums'],
  },
  aiImpactSub: {
    fontSize: 11,
    color: '#5B21B6',
    textAlign: 'center',
  },

  // Verified Result Block
  verifiedBlock: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  verifiedGlowBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#059669',
  },
  verifiedTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
    marginRight: 6,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  evalBatchBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  evalBatchBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  verifiedModelName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  verifiedModelSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  verifiedAccuracyNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#047857',
    fontVariant: ['tabular-nums'],
  },

  // Formula Strip
  formulaStrip: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formulaEquation: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
  },
  formulaSubCaption: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
    fontStyle: 'italic',
  },
  formulaPart: {
    fontWeight: '700',
    color: '#334155',
  },
  formulaOperator: {
    fontWeight: '800',
    color: '#94A3B8',
  },

  // Micro Stats Row
  microStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  microStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  microStatVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  microStatLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },

  // Note Box
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  noteText: {
    fontSize: 11,
    lineHeight: 15,
    color: '#166534',
    fontStyle: 'italic',
    flex: 1,
  },
});
