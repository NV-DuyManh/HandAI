import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SIZES } from '../../constants/theme';
import { AppHeader } from '../../components/ui/AppHeader';
import { AppButton } from '../../components/ui/AppButton';
import { StatusCard } from '../../components/domain/StatusCard';
import { MathExpression } from '../../components/domain/MathExpression';
import { SubmissionResult } from '../../types';
import { logFlowDomain } from '../../services/draft/submissionDraftStore';

export default function CorrectScreen() {
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data: string }>();

  useEffect(() => {
    logFlowDomain('RESULT', 'ARITHMETIC');
  }, []);

  let result: Partial<SubmissionResult> = {
    studentFeedback: {
      title: 'Làm tốt lắm! 🎉',
      hint: 'MathVision chưa tìm thấy lỗi trong bài em vừa kiểm tra.',
      revealAnswer: false,
    },
    recognizedExercise: {
      operator: '+',
      operands: [{ value: '458' }, { value: '276' }],
      observedResult: [{ value: '734' }],
    },
  };

  try {
    if (data) result = JSON.parse(data);
  } catch (e) {
    console.error(e);
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Kết quả bài làm" showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <StatusCard
          status="success"
          title={result.studentFeedback?.title || 'Làm tốt lắm! 🎉'}
          subtitle={
            result.studentFeedback?.hint ||
            'MathVision chưa tìm thấy lỗi trong bài em vừa kiểm tra.'
          }
        />

        <View style={styles.expressionContainer}>
          {result.recognizedExercise && (
            <MathExpression exercise={result.recognizedExercise} />
          )}
        </View>

        <View style={styles.spacer} />

        <View style={styles.actions}>
          <AppButton
            title="Kiểm tra bài toán khác"
            onPress={() => router.replace('/camera')}
            variant="primary"
          />
          <View style={{ height: SIZES.small }} />
          <AppButton
            title="Về trang chủ"
            variant="secondary"
            onPress={() => router.replace('/(tabs)')}
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
  expressionContainer: {
    marginTop: SIZES.medium,
    marginBottom: SIZES.large,
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
    minHeight: SIZES.large,
  },
  actions: {
    paddingBottom: SIZES.medium,
  },
});
