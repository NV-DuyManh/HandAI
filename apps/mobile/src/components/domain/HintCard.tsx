import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppCard } from '../ui/AppCard';
import { COLORS, SIZES } from '../../constants/theme';

interface HintCardProps {
  hint: string;
}

export const HintCard: React.FC<HintCardProps> = ({ hint }) => {
  return (
    <AppCard
      style={styles.container}
      variant="outlined"
      accessible
      accessibilityLabel={`Gợi ý từ MathVision: ${hint}`}
    >
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="bulb" size={20} color={COLORS.warning} />
        </View>
        <Text style={styles.title}>Gợi ý từ MathVision</Text>
      </View>
      <Text style={styles.hintText}>{hint}</Text>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1.5,
    borderRadius: SIZES.cardRadius,
    padding: SIZES.large,
    marginBottom: SIZES.large,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.small,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.small,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  hintText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 24,
    fontWeight: '500',
  },
});
