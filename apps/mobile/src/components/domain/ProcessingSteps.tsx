import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface ProcessingStepsProps {
  currentStepIndex: number;
}

export const ProcessingSteps: React.FC<ProcessingStepsProps> = ({ currentStepIndex }) => {
  const steps = ['Đọc bài', 'Kiểm tra', 'Gợi ý'];

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <View style={styles.stepsContainer}>
        {steps.map((step, index) => {
          const isActive = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;
          
          return (
            <View key={step} style={styles.stepWrapper}>
              <View style={[
                styles.dot, 
                isActive ? styles.dotActive : styles.dotInactive,
                isCurrent && styles.dotCurrent
              ]}>
                {index < currentStepIndex && (
                  <Ionicons name="checkmark" size={16} color={COLORS.surface} />
                )}
              </View>
              <Text style={[
                styles.stepText,
                isActive ? styles.textActive : styles.textInactive
              ]}>{step}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: SIZES.large,
    position: 'relative',
  },
  line: {
    position: 'absolute',
    top: SIZES.large + 14,
    left: '15%',
    right: '15%',
    height: 2,
    backgroundColor: COLORS.border,
    zIndex: 0,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  stepWrapper: {
    alignItems: 'center',
    width: 80,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
  },
  dotInactive: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  dotCurrent: {
    borderWidth: 4,
    borderColor: COLORS.primaryDark,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '600',
  },
  textActive: {
    color: COLORS.textPrimary,
  },
  textInactive: {
    color: COLORS.textSecondary,
  }
});
