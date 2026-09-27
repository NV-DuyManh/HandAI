import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: 'elevated' | 'flat' | 'outlined' | 'subdued';
  accessible?: boolean;
  accessibilityLabel?: string;
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  style,
  variant = 'elevated',
  accessible = false,
  accessibilityLabel,
}) => {
  return (
    <View
      style={[
        styles.card,
        variant === 'elevated' && [styles.elevated, SHADOWS.small],
        variant === 'flat' && styles.flat,
        variant === 'outlined' && styles.outlined,
        variant === 'subdued' && styles.subdued,
        style,
      ]}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
    padding: SIZES.medium,
  },
  elevated: {
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  flat: {
    backgroundColor: COLORS.surface,
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  subdued: {
    backgroundColor: COLORS.surfaceSubdued,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
});
