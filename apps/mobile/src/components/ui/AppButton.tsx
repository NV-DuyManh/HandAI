import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, View } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outlined' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  accessibilityLabel,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return COLORS.border;
    switch (variant) {
      case 'primary': return COLORS.primary;
      case 'secondary': return COLORS.surfaceSubdued;
      case 'danger': return COLORS.error;
      case 'outlined':
      case 'ghost': return 'transparent';
      default: return COLORS.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return COLORS.textMuted;
    switch (variant) {
      case 'primary': return COLORS.surface;
      case 'secondary': return COLORS.primaryDark;
      case 'danger': return COLORS.surface;
      case 'outlined': return COLORS.primary;
      case 'ghost': return COLORS.textSecondary;
      default: return COLORS.surface;
    }
  };

  const isInteractive = !disabled && !loading;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: getBackgroundColor() },
        variant === 'primary' && isInteractive && SHADOWS.small,
        variant === 'secondary' && styles.secondaryBorder,
        variant === 'outlined' && styles.outlined,
        style,
      ]}
      onPress={onPress}
      disabled={!isInteractive}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <View style={styles.innerContent}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: SIZES.minTouchTarget,
    height: 52,
    borderRadius: SIZES.buttonRadius,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.xlarge,
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: SIZES.small,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  outlined: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  secondaryBorder: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
});
