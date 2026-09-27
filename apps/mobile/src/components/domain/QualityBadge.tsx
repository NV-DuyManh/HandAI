import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SIZES } from '../../constants/theme';

interface QualityBadgeProps {
  label: string;
  isGood: boolean;
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({ label, isGood }) => {
  return (
    <View
      style={[styles.container, isGood ? styles.goodContainer : styles.badContainer]}
      accessible
      accessibilityLabel={`${label}: ${isGood ? 'Đạt' : 'Cần chú ý'}`}
    >
      <Ionicons
        name={isGood ? 'checkmark-circle' : 'alert-circle'}
        size={16}
        color={isGood ? '#15803D' : '#B45309'}
      />
      <Text style={[styles.text, { color: isGood ? '#15803D' : '#B45309' }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.small,
    paddingVertical: 6,
    borderRadius: SIZES.pillRadius,
    borderWidth: 1,
    marginRight: SIZES.xs,
    marginBottom: SIZES.xs,
  },
  goodContainer: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  badContainer: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
});
