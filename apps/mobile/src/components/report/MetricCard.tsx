import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type MetricCardColor = 'blue' | 'green' | 'purple' | 'orange' | 'amber' | 'emerald';

export interface MetricCardProps {
  value: string;
  title: string;
  explanation: string;
  color: MetricCardColor;
  icon: keyof typeof Ionicons.glyphMap;
  categoryTag?: string;
  isPrimary?: boolean;
  style?: ViewStyle;
  delayMs?: number;
  testID?: string;
}

interface ColorTheme {
  accent: string;
  number: string;
  iconBg: string;
  iconColor: string;
  bg: string;
  border: string;
  tagBg: string;
  tagColor: string;
}

const COLOR_MAP: Record<MetricCardColor, ColorTheme> = {
  blue: {
    accent: '#2563EB',
    number: '#1D4ED8',
    iconBg: '#DBEAFE',
    iconColor: '#1D4ED8',
    bg: '#F0F7FF',
    border: '#BFDBFE',
    tagBg: '#EFF6FF',
    tagColor: '#1D4ED8',
  },
  green: {
    accent: '#059669',
    number: '#047857',
    iconBg: '#D1FAE5',
    iconColor: '#047857',
    bg: '#F0FDF4',
    border: '#A7F3D0',
    tagBg: '#ECFDF5',
    tagColor: '#047857',
  },
  emerald: {
    accent: '#059669',
    number: '#047857',
    iconBg: '#D1FAE5',
    iconColor: '#047857',
    bg: '#F0FDF4',
    border: '#A7F3D0',
    tagBg: '#ECFDF5',
    tagColor: '#047857',
  },
  purple: {
    accent: '#7C3AED',
    number: '#6D28D9',
    iconBg: '#EDE9FE',
    iconColor: '#6D28D9',
    bg: '#FAF5FF',
    border: '#DDD6FE',
    tagBg: '#F5F3FF',
    tagColor: '#6D28D9',
  },
  orange: {
    accent: '#D97706',
    number: '#B45309',
    iconBg: '#FEF3C7',
    iconColor: '#B45309',
    bg: '#FFFBEB',
    border: '#FDE68A',
    tagBg: '#FFF7ED',
    tagColor: '#C2410C',
  },
  amber: {
    accent: '#D97706',
    number: '#B45309',
    iconBg: '#FEF3C7',
    iconColor: '#B45309',
    bg: '#FFFBEB',
    border: '#FDE68A',
    tagBg: '#FFF7ED',
    tagColor: '#C2410C',
  },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  value,
  title,
  explanation,
  color,
  icon,
  categoryTag,
  isPrimary = false,
  style,
  delayMs = 0,
  testID,
}) => {
  const theme = COLOR_MAP[color] || COLOR_MAP.blue;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: delayMs,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay: delayMs,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [fadeAnim, slideAnim, delayMs]);

  return (
    <Animated.View
      style={[
        styles.card,
        isPrimary ? styles.primaryCard : styles.supportingCard,
        {
          backgroundColor: theme.bg,
          borderColor: theme.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        style,
      ]}
      testID={testID}
      accessibilityRole="summary"
    >
      {/* Top Color Accent Line */}
      <View
        style={[
          styles.topAccentLine,
          { backgroundColor: theme.accent, height: isPrimary ? 4.5 : 3.5 },
        ]}
      />

      {/* Header Row: Category Badge & Icon */}
      <View style={styles.headerRow}>
        {categoryTag ? (
          <View style={[styles.categoryBadge, { backgroundColor: theme.tagBg, borderColor: theme.border }]}>
            {isPrimary && <View style={[styles.liveDot, { backgroundColor: theme.accent }]} />}
            <Text style={[styles.categoryText, { color: theme.tagColor }]}>
              {categoryTag}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <View style={[styles.iconWrapper, { backgroundColor: theme.iconBg }]}>
          <Ionicons name={icon} size={isPrimary ? 18 : 15} color={theme.iconColor} />
        </View>
      </View>

      {/* Main Metric Value (Visual Priority #1) */}
      <Text
        style={[
          styles.number,
          isPrimary ? styles.primaryNumber : styles.supportingNumber,
          { color: theme.number },
        ]}
      >
        {value}
      </Text>

      {/* Metric Title (Visual Priority #2) */}
      <Text
        style={[
          styles.title,
          isPrimary ? styles.primaryTitle : styles.supportingTitle,
        ]}
        numberOfLines={2}
      >
        {title}
      </Text>

      {/* Short Explanation (Visual Priority #3) */}
      <Text
        style={[
          styles.explanation,
          isPrimary ? styles.primaryExplanation : styles.supportingExplanation,
        ]}
        numberOfLines={2}
      >
        {explanation}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)',
      } as any,
    }),
  },
  primaryCard: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  supportingCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 140,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  topAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 0.8,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  categoryText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  iconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  primaryNumber: {
    fontSize: 36,
    marginVertical: 6,
  },
  supportingNumber: {
    fontSize: 26,
    marginVertical: 4,
  },
  title: {
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  primaryTitle: {
    fontSize: 14.5,
    lineHeight: 19,
    marginBottom: 4,
  },
  supportingTitle: {
    fontSize: 11.5,
    lineHeight: 15,
    marginBottom: 3,
  },
  explanation: {
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  primaryExplanation: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  supportingExplanation: {
    fontSize: 9.5,
    lineHeight: 13,
  },
});

export default MetricCard;
