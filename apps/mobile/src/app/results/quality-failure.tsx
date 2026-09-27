import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SIZES } from '../../constants/theme';
import { AppHeader } from '../../components/ui/AppHeader';
import { AppButton } from '../../components/ui/AppButton';
import { StatusCard } from '../../components/domain/StatusCard';
import { ImageQualityIssue } from '../../types';

export default function QualityFailureScreen() {
  const router = useRouter();
  const { issue, originalUri, submissionId } = useLocalSearchParams<{
    issue: string;
    originalUri?: string;
    submissionId?: string;
  }>();

  let title = 'Ảnh bài tập chưa rõ nét';
  let subtitle = 'Em hãy chụp lại thật rõ để MathVision đọc chính xác từng chữ số nhé.';
  let buttonTitle = 'Chụp lại ảnh khác';

  if (issue === ImageQualityIssue.BLUR) {
    title = 'Ảnh bị rung hoặc hơi mờ';
    subtitle = 'Em hãy giữ điện thoại thật yên tay rồi chụp lại nhé.';
    buttonTitle = 'Chụp lại thật rõ';
  } else if (issue === ImageQualityIssue.DARK) {
    title = 'Ảnh hơi tối hoặc thiếu sáng';
    subtitle = 'Em hãy bật đèn hoặc di chuyển đến nơi sáng hơn để chụp nhé.';
    buttonTitle = 'Tìm chỗ sáng và chụp lại';
  } else if (issue === ImageQualityIssue.INCOMPLETE_CROP) {
    title = 'Chưa thấy trọn vẹn phép tính';
    subtitle = 'Phép tính bị mất một phần chữ số. Em hãy chỉnh lại khung hoặc chụp lại nhé.';
    buttonTitle = 'Chỉnh lại vùng bài';
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Chất lượng ảnh" showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.spacerTop} />

        <StatusCard status="warning" title={title} subtitle={subtitle} />

        <View style={styles.spacer} />

        <View style={styles.actions}>
          <AppButton
            title={buttonTitle}
            variant="primary"
            onPress={() => {
              if (issue === ImageQualityIssue.INCOMPLETE_CROP && originalUri) {
                router.replace({
                  pathname: '/crop' as any,
                  params: { uri: originalUri, retrySubmissionId: submissionId },
                });
              } else {
                router.replace({
                  pathname: '/camera' as any,
                  params: { retrySubmissionId: submissionId, mode: 'ARITHMETIC' },
                });
              }
            }}
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
  spacerTop: {
    height: SIZES.large,
  },
  spacer: {
    flex: 1,
    minHeight: SIZES.xlarge,
  },
  actions: {
    paddingBottom: SIZES.medium,
  },
});
