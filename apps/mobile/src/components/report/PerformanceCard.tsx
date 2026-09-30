import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from './StatusBadge';

export interface PerformanceCardProps {
  value: string;
  title?: string;
  description?: string;
  categoryTag?: string;
  badgeLabel?: string;
  badgeVariant?: 'blue' | 'green' | 'purple' | 'orange' | 'neutral';
  style?: ViewStyle;
  delayMs?: number;
  testID?: string;
}

/**
 * PerformanceCard — Hero metric card for academic defense presentations.
 * Clean, center-aligned, large typography inspired by Apple HIG & DeepMind research interfaces.
 */
export const PerformanceCard: React.FC<PerformanceCardProps> = ({
  value,
  title = 'CRNN Recognition Accuracy',
  description = 'Automatic handwriting recognition performance before post-processing.',
  categoryTag = 'Recognition Performance',
  badgeLabel = 'Primary Metric',
  badgeVariant = 'blue',
  style,
  delayMs = 0,
  testID,
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
      return;
    }
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.96);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: delayMs,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 350,
        delay: delayMs,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [delayMs, fadeAnim, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.heroCard,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
        style,
      ]}
      testID={testID}
    >
      {/* Top Tag & Badge */}
      <View style={styles.topHeader}>
        <View style={styles.tagWrap}>
          <View style={styles.tagIndicator} />
          <Text style={styles.categoryTag}>{categoryTag.toUpperCase()}</Text>
        </View>
        {badgeLabel ? (
          <StatusBadge label={badgeLabel} variant={badgeVariant} />
        ) : null}
      </View>

      {/* Hero Number (Centered, High Impact) */}
      <View style={styles.heroCenterContent}>
        <Text style={styles.heroNumber} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroDescription}>{description}</Text>
      </View>

      {/* Bottom Sub-indicator Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarItem}>
          <Ionicons name="hardware-chip-outline" size={14} color="#2563EB" style={{ marginRight: 5 }} />
          <Text style={styles.bottomBarText}>CRNN Acoustic & Visual Decoding</Text>
        </View>
        <View style={styles.bottomDot} />
        <View style={styles.bottomBarItem}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#059669" style={{ marginRight: 5 }} />
          <Text style={styles.bottomBarText}>Pre-Correction Baseline</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1E3A8A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 14px rgba(30, 58, 138, 0.06)',
      },
    }),
  },
  topHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
    marginRight: 6,
  },
  categoryTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
    letterSpacing: 0.7,
  },
  heroCenterContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    width: '100%',
  },
  heroNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -1,
    lineHeight: 56,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 6,
    marginBottom: 6,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 320,
  },
  bottomBar: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  bottomBarItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomBarText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  bottomDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 4,
  },
});
