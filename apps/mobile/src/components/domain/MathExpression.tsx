import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { RecognizedExercise } from '../../types';

interface MathExpressionProps {
  exercise: RecognizedExercise;
  highlightIndex?: number;
}

export const MathExpression: React.FC<MathExpressionProps> = ({ exercise, highlightIndex }) => {
  const op1 = exercise.operands[0]?.value || '';
  const op2 = exercise.operands[1]?.value || '';
  const resultDigits = exercise.observedResult.map(t => t.value);

  return (
    <View
      style={[styles.container, SHADOWS.small]}
      accessible
      accessibilityLabel={`Phép tính: ${op1} ${exercise.operator} ${op2} bằng ${resultDigits.join('')}`}
    >
      <Text style={styles.digitRow}>{op1}</Text>
      
      <View style={styles.operatorRow}>
        <Text style={styles.operator}>{exercise.operator}</Text>
        <Text style={styles.digitRow}>{op2}</Text>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.resultRow}>
        {resultDigits.map((digit, idx) => {
          // highlightIndex from backend is 0-indexed or 1-indexed depending on error position
          // In error-hint.tsx we see: highlightIndex: 1
          const isError = highlightIndex !== undefined && idx === highlightIndex;
          return (
            <View key={idx} style={[styles.digitBox, isError && styles.errorDigitBox]}>
              <Text style={[styles.digit, isError && styles.errorDigitText]}>
                {digit}
              </Text>
              {isError && <View style={styles.errorIndicator} />}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    paddingVertical: SIZES.large,
    paddingHorizontal: SIZES.xxlarge,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 200,
  },
  operatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  digitRow: {
    fontSize: 44,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 6,
    fontVariant: ['tabular-nums'],
  },
  operator: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginRight: 16,
  },
  divider: {
    height: 3,
    backgroundColor: COLORS.textPrimary,
    width: '100%',
    marginVertical: SIZES.small,
    borderRadius: 2,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  digitBox: {
    alignItems: 'center',
    paddingHorizontal: 2,
    position: 'relative',
  },
  errorDigitBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  digit: {
    fontSize: 44,
    fontWeight: '800',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  errorDigitText: {
    color: COLORS.error,
  },
  errorIndicator: {
    width: '100%',
    height: 3,
    backgroundColor: COLORS.error,
    borderRadius: 2,
    marginTop: 2,
  },
});
