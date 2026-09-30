import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type StatusBadgeVariant = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'neutral';

export interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
  showDot?: boolean;
  dotColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

const BADGE_VARIANTS: Record<
  StatusBadgeVariant,
  { bg: string; border: string; text: string; dot: string }
> = {
  blue: {
    bg: '#EFF6FF',
    border: '#BFDBFE',
    text: '#1D4ED8',
    dot: '#2563EB',
  },
  green: {
    bg: '#ECFDF5',
    border: '#A7F3D0',
    text: '#047857',
    dot: '#10B981',
  },
  purple: {
    bg: '#F5F3FF',
    border: '#DDD6FE',
    text: '#6D28D9',
    dot: '#7C3AED',
  },
  orange: {
    bg: '#FFF7ED',
    border: '#FED7AA',
    text: '#C2410C',
    dot: '#EA580C',
  },
  red: {
    bg: '#FEF2F2',
    border: '#FECACA',
    text: '#B91C1C',
    dot: '#EF4444',
  },
  neutral: {
    bg: '#F8FAFC',
    border: '#E2E8F0',
    text: '#475569',
    dot: '#94A3B8',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  showDot = false,
  dotColor,
  icon,
  iconSize = 12,
  style,
  textStyle,
  testID,
}) => {
  const currentVariant = BADGE_VARIANTS[variant] || BADGE_VARIANTS.neutral;
  const activeDotColor = dotColor || currentVariant.dot;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: currentVariant.bg, borderColor: currentVariant.border },
        style,
      ]}
      testID={testID}
      accessibilityRole="text"
    >
      {showDot && (
        <View style={[styles.dot, { backgroundColor: activeDotColor }]} />
      )}
      {icon && (
        <Ionicons
          name={icon}
          size={iconSize}
          color={currentVariant.text}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.text,
          { color: currentVariant.text },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

export default StatusBadge;
