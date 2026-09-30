import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface TrendRunItem {
  runLabel: string;
  gainPercent: number;
  model: string;
  isLatest?: boolean;
}

export interface TrendSparklineProps {
  title?: string;
  subtitle?: string;
  runs?: TrendRunItem[];
  gainUnit?: 'percent' | 'percentagePoints';
  style?: ViewStyle;
  testID?: string;
}

/**
 * TrendSparkline — Lightweight, elegant sparkline visualization.
 * Displays cross-run AI Improvement changes across benchmark experiments.
 * Never creates artificial experiment results: displays real data only or truthful unavailable note.
 */
export const TrendSparkline: React.FC<TrendSparklineProps> = ({
  title = 'AI Improvement Trend',
  subtitle = 'Measured assistance gains across benchmark runs',
  runs = [],
  gainUnit = 'percent',
  style,
  testID,
}) => {
  const unitLabel = gainUnit === 'percentagePoints' ? ' pp' : '%';
  const hasValidTrend = runs && runs.length >= 2;

  if (!hasValidTrend) {
    return (
      <View style={[styles.container, style]} testID={testID}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Ionicons name="trending-up" size={15} color="#7C3AED" style={{ marginRight: 6 }} />
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.pendingBadge}>Historical Pending</Text>
        </View>

        {/* Unavailable Notice (Scientific Integrity) */}
        <View style={styles.unavailableBox}>
          <Ionicons name="bar-chart-outline" size={22} color="#7C3AED" style={{ marginBottom: 6 }} />
          <Text style={styles.unavailableTitle}>Historical comparison unavailable</Text>
          <Text style={styles.unavailableSub}>
            Benchmark trend will appear after multiple validated runs.
          </Text>
        </View>
      </View>
    );
  }

  const maxGain = Math.max(...runs.map((r) => r.gainPercent), 25);
  const avgGain = Math.round(runs.reduce((a, b) => a + b.gainPercent, 0) / runs.length);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Ionicons name="trending-up" size={15} color="#7C3AED" style={{ marginRight: 6 }} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.avgBadge}>Avg +{avgGain}{unitLabel} Gain</Text>
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {/* Sparkline Bars Row (Purple/Indigo Semantic) */}
      <View style={styles.runsRow}>
        {runs.map((run, i) => {
          const heightPct = Math.max(20, Math.round((run.gainPercent / maxGain) * 100));

          return (
            <View key={i} style={styles.runCol}>
              {/* Value Label */}
              <Text style={[styles.gainLabel, run.isLatest && styles.latestGainLabel]}>
                +{run.gainPercent}{unitLabel}
              </Text>

              {/* Bar Track */}
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${heightPct}%` },
                    run.isLatest ? styles.latestBarFill : styles.normalBarFill,
                  ]}
                />
              </View>

              {/* Run Name */}
              <Text style={[styles.runName, run.isLatest && styles.latestRunName]}>
                {run.runLabel}
              </Text>
              <Text style={styles.modelTag}>{run.model.split(' ')[0]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  avgBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6D28D9',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 12,
  },
  unavailableBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  unavailableTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4C1D95',
    marginBottom: 2,
  },
  unavailableSub: {
    fontSize: 11,
    color: '#6D28D9',
    textAlign: 'center',
    lineHeight: 16,
  },
  runsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 100,
    paddingTop: 8,
  },
  runCol: {
    alignItems: 'center',
    flex: 1,
  },
  gainLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  latestGainLabel: {
    fontWeight: '800',
    color: '#4C1D95',
    fontSize: 12,
  },
  barTrack: {
    width: 24,
    height: 52,
    backgroundColor: '#EDE9FE',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  normalBarFill: {
    backgroundColor: '#A78BFA',
  },
  latestBarFill: {
    backgroundColor: '#7C3AED',
  },
  runName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  latestRunName: {
    fontWeight: '800',
    color: '#0F172A',
  },
  modelTag: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 1,
  },
});
