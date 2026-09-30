import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from './StatusBadge';

export interface DatasetCardProps {
  datasetName?: string;
  totalSamples?: number | string;
  trainingSamples?: number | string;
  benchmarkSamples?: number | string;
  totalSessions?: number | string;
  totalEvaluatedLines?: number | string;
  note?: string;
  verifiedLabel?: string;
  versionLabel?: string;
  style?: ViewStyle;
  testID?: string;
}

/**
 * DatasetCard — Transparent empirical dataset breakdown for academic defense.
 * Clearly contrasts the full Training Corpus against the verified Evaluation Benchmark.
 */
export const DatasetCard: React.FC<DatasetCardProps> = ({
  datasetName = 'Dataset summary unavailable',
  totalSamples,
  trainingSamples,
  benchmarkSamples,
  totalSessions,
  totalEvaluatedLines,
  note,
  verifiedLabel,
  versionLabel,
  style,
  testID,
}) => {
  const toNumber = (value: number | string | undefined): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const trainingCount = toNumber(trainingSamples);
  const benchmarkCount = toNumber(benchmarkSamples);
  const splitTotal = (trainingCount ?? 0) + (benchmarkCount ?? 0);
  const derivedTotal = totalSamples ?? (splitTotal > 0 ? splitTotal : undefined);
  const trainingShare = splitTotal > 0 && trainingCount != null
    ? `${((trainingCount / splitTotal) * 100).toFixed(2)}%`
    : null;
  const benchmarkShare = splitTotal > 0 && benchmarkCount != null
    ? `${((benchmarkCount / splitTotal) * 100).toFixed(2)}%`
    : null;

  return (
    <View style={[styles.card, style]} testID={testID}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.datasetName}>{datasetName}</Text>
          <Text style={styles.totalSamplesText}>
            {derivedTotal == null
              ? 'Total sample count unavailable'
              : `${typeof derivedTotal === 'number' ? derivedTotal.toLocaleString() : derivedTotal} Total Handwriting Samples`}
          </Text>
        </View>
        <View style={styles.badgesWrap}>
          {verifiedLabel ? <StatusBadge label={verifiedLabel} variant="green" showDot /> : null}
          {versionLabel ? <StatusBadge label={versionLabel} variant="blue" /> : null}
        </View>
      </View>

      {/* 2 Primary Blocks: Training Corpus vs Evaluation Benchmark */}
      <View style={styles.splitRow}>
        {/* Training Corpus */}
        <View style={styles.corpusBlock}>
          <Text style={styles.blockLabel}>Training Corpus</Text>
          <Text style={styles.blockNumber}>
            {trainingSamples == null ? '—' : typeof trainingSamples === 'number' ? trainingSamples.toLocaleString() : trainingSamples}
          </Text>
          <Text style={styles.blockSub}>{trainingShare ? `samples (${trainingShare})` : 'share unavailable'}</Text>
        </View>

        {/* Evaluation Benchmark */}
        <View style={[styles.corpusBlock, styles.benchmarkBlock]}>
          <Text style={[styles.blockLabel, { color: '#047857' }]}>Evaluation Benchmark</Text>
          <Text style={[styles.blockNumber, { color: '#059669' }]}>
            {benchmarkSamples == null ? '—' : typeof benchmarkSamples === 'number' ? benchmarkSamples.toLocaleString() : benchmarkSamples}
          </Text>
          <Text style={[styles.blockSub, { color: '#166534' }]}>
            {benchmarkShare ? `evaluation samples (${benchmarkShare})` : 'share unavailable'}
          </Text>
        </View>
      </View>

      {/* Visual Proportion Bar */}
      {splitTotal > 0 ? (
        <View style={styles.splitBarTrack}>
          <View style={[styles.splitBarFill, { flex: trainingCount ?? 0, backgroundColor: '#1D4ED8' }]} />
          <View style={[styles.splitBarFill, { flex: benchmarkCount ?? 0, backgroundColor: '#059669' }]} />
        </View>
      ) : null}

      {/* Secondary Stats: Total evaluation sessions & Total evaluated samples */}
      <View style={styles.secondaryStatsRow}>
        <View style={styles.secondaryStatItem}>
          <Text style={styles.secondaryStatLabel}>Total Evaluation Sessions</Text>
          <Text style={styles.secondaryStatVal}>
            {totalSessions == null ? '—' : typeof totalSessions === 'number' ? `${totalSessions} sessions` : totalSessions}
          </Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.secondaryStatItem}>
          <Text style={styles.secondaryStatLabel}>Total Evaluated Samples</Text>
          <Text style={styles.secondaryStatVal}>
            {totalEvaluatedLines == null ? '—' : typeof totalEvaluatedLines === 'number' ? `${totalEvaluatedLines.toLocaleString()} samples` : totalEvaluatedLines}
          </Text>
        </View>
      </View>

      {/* Academic Transparency Note */}
      {note ? <View style={styles.noteBox}>
        <Ionicons name="information-circle-outline" size={15} color="#059669" style={{ marginRight: 6 }} />
        <Text style={styles.noteText}>{note}</Text>
      </View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  datasetName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  totalSamplesText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  badgesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  corpusBlock: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  benchmarkBlock: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  blockLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  blockNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginVertical: 4,
    fontVariant: ['tabular-nums'],
  },
  blockSub: {
    fontSize: 11,
    color: '#64748B',
  },
  splitBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 14,
  },
  splitBarFill: {
    height: '100%',
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginBottom: 12,
  },
  secondaryStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  secondaryStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  secondaryStatVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  noteText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#166534',
    fontStyle: 'italic',
    flex: 1,
  },
});
