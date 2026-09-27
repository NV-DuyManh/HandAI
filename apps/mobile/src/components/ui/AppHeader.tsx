import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  rightAccessibilityLabel?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showBack = false,
  rightIcon,
  onRightPress,
  rightAccessibilityLabel,
}) => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {showBack ? (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}

      <Text
        style={styles.title}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>

      {rightIcon ? (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onRightPress}
          accessibilityRole="button"
          accessibilityLabel={rightAccessibilityLabel || 'Tùy chọn'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={rightIcon} size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.small,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: SIZES.small,
  },
  iconButton: {
    width: SIZES.minTouchTarget,
    height: SIZES.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: SIZES.minTouchTarget / 2,
  },
  placeholder: {
    width: SIZES.minTouchTarget,
  },
});
