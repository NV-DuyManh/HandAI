import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { AppCard } from '../ui/AppCard';
import { AppButton } from '../ui/AppButton';
import { Ionicons } from '@expo/vector-icons';

interface TokenConfirmationCardProps {
  initialToken: string;
  onConfirm: (token: string) => void;
}

export const TokenConfirmationCard: React.FC<TokenConfirmationCardProps> = ({ initialToken, onConfirm }) => {
  const [token, setToken] = useState(initialToken);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    const backAction = () => {
      setIsEditing(false);
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isEditing]);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  return (
    <AppCard style={styles.container}>
      <View style={styles.headerBadge}>
        <Ionicons name="help-circle" size={24} color={COLORS.primary} />
        <Text style={styles.badgeText}>Xác nhận chữ viết</Text>
      </View>

      <Text style={styles.title}>MathVision chưa chắc chắn số này:</Text>
      <Text style={styles.subtitle}>Em hãy nhìn lại bài viết và chọn số chính xác nhé.</Text>

      <View style={[styles.tokenBox, SHADOWS.small]}>
        <Text style={styles.tokenText}>{token}</Text>
      </View>

      {!isEditing ? (
        <View style={styles.actionRow}>
          <AppButton
            title="Đúng rồi"
            onPress={() => onConfirm(token)}
            style={styles.halfButton}
            variant="primary"
          />
          <View style={{ width: SIZES.medium }} />
          <AppButton
            title="Chọn số khác"
            onPress={() => setIsEditing(true)}
            variant="outlined"
            style={styles.halfButton}
          />
        </View>
      ) : (
        <View style={styles.keypad}>
          <Text style={styles.instruction}>Chạm vào số đúng trong bài của em:</Text>
          <View style={styles.grid}>
            {digits.map(d => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.digitButton,
                  d === token && styles.digitButtonSelected,
                ]}
                onPress={() => {
                  setToken(d);
                  setIsEditing(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Số ${d}`}
              >
                <Text
                  style={[
                    styles.digitButtonText,
                    d === token && styles.digitButtonTextSelected,
                  ]}
                >
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.cancelEditButton}
            onPress={() => setIsEditing(false)}
            accessibilityRole="button"
            accessibilityLabel="Đóng bàn phím"
          >
            <Text style={styles.cancelEditText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      )}
    </AppCard>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SIZES.xlarge,
    paddingHorizontal: SIZES.large,
    width: '100%',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubdued,
    paddingHorizontal: SIZES.medium,
    paddingVertical: 6,
    borderRadius: SIZES.pillRadius,
    marginBottom: SIZES.medium,
  },
  badgeText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SIZES.large,
  },
  tokenBox: {
    width: 90,
    height: 100,
    borderWidth: 2.5,
    borderColor: COLORS.primary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubdued,
    marginBottom: SIZES.xlarge,
  },
  tokenText: {
    fontSize: 52,
    fontWeight: '800',
    color: COLORS.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  halfButton: {
    flex: 1,
  },
  keypad: {
    width: '100%',
    alignItems: 'center',
  },
  instruction: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SIZES.medium,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: SIZES.medium,
  },
  digitButton: {
    width: 54,
    height: 54,
    backgroundColor: COLORS.background,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  digitButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  digitButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  digitButtonTextSelected: {
    color: COLORS.surface,
  },
  cancelEditButton: {
    paddingVertical: SIZES.small,
    paddingHorizontal: SIZES.large,
  },
  cancelEditText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
