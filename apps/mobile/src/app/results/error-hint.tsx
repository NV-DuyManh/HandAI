import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SIZES } from '../../constants/theme';
import { AppHeader } from '../../components/ui/AppHeader';
import { AppButton } from '../../components/ui/AppButton';
import { HintCard } from '../../components/domain/HintCard';
import { MathExpression } from '../../components/domain/MathExpression';
import { SubmissionResult } from '../../types';
import { logFlowDomain } from '../../services/draft/submissionDraftStore';

export default function ErrorHintScreen() {
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data: string }>();

  useEffect(() => {
    logFlowDomain('RESULT', 'ARITHMETIC');
  }, []);

  let result: Partial<SubmissionResult> = {
    studentFeedback: {
      title: 'Hãy xem lại hàng chục',
      hint: 'Em nhớ kiểm tra số nhớ từ hàng đơn vị trước khi cộng các số ở hàng chục nhé.',
      revealAnswer: false,
    },
    recognizedExercise: {
      operator: '+',
      operands: [{ value: '458' }, { value: '276' }],
      observedResult: [{ value: '724' }],
    },
    validation: {
      decision: 'INVALID' as any,
      firstInvalidIndex: 1,
    },
  };

  try {
    if (data) result = JSON.parse(data);
  } catch {
    // handled
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Gợi ý bài làm" showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.feedbackTitle}>{result.studentFeedback?.title}</Text>
        <Text style={styles.feedbackSubtitle}>
          MathVision đã phát hiện một bước tính cần em xem lại:
        </Text>

        <View style={styles.expressionContainer}>
          {result.recognizedExercise && (
            <MathExpression
              exercise={result.recognizedExercise}
              highlightIndex={result.validation?.firstInvalidIndex}
            />
          )}
        </View>

        {result.studentFeedback?.hint ? (
          <HintCard hint={result.studentFeedback.hint} />
        ) : null}

        <View style={styles.spacer} />

        <View style={styles.actions}>
          <AppButton
            title="Em sẽ sửa lại"
            onPress={() => router.replace('/(tabs)')}
            variant="primary"
          />
          <View style={{ height: SIZES.small }} />
          <AppButton
            title="Chụp lại bài đã sửa"
            variant="secondary"
            onPress={() => router.replace('/camera')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SIZES.large,
    flexGrow: 1,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  feedbackTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: 4,
    textAlign: 'center',
  },
  feedbackSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SIZES.large,
  },
  expressionContainer: {
    alignItems: 'center',
    marginBottom: SIZES.large,
  },
  spacer: {
    flex: 1,
    minHeight: SIZES.large,
  },
  actions: {
    paddingBottom: SIZES.medium,
  },
});
