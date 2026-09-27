import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, ScrollView, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SIZES } from '../../constants/theme';
import { AppHeader } from '../../components/ui/AppHeader';
import { TokenConfirmationCard } from '../../components/domain/TokenConfirmationCard';
import { getSubmissionService } from '../../services/api/SubmissionServiceFactory';
import { submissionDraftStore, isHandwritingDomain } from '../../services/draft/submissionDraftStore';

export default function TokenConfirmationScreen() {
  const router = useRouter();
  const { id, token } = useLocalSearchParams<{ id: string; token: string }>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const draft = submissionDraftStore.getDraft();
    if (isHandwritingDomain(draft?.mode) || (id && id.startsWith('trial_'))) {
      console.warn('[TOKEN_CONFIRMATION] Blocked: Handwriting text flow must never enter digit confirmation.');
      router.replace('/(tabs)');
    }
  }, [id, router]);

  const handleConfirm = async (confirmedToken: string) => {
    if (!id) {
      Alert.alert('Lỗi', 'Không tìm thấy mã bài làm để xác nhận.');
      return;
    }
    try {
      setLoading(true);
      const submissionService = getSubmissionService();
      const result = await submissionService.confirmToken(id as string, confirmedToken);

      if (result.validation?.decision === 'VALID') {
        router.replace({ pathname: '/results/correct', params: { data: JSON.stringify(result) } });
      } else {
        router.replace({ pathname: '/results/error-hint', params: { data: JSON.stringify(result) } });
      }
    } catch (e: any) {
      console.error('[TOKEN_CONFIRMATION] Error confirming token:', e);
      Alert.alert('Lỗi xác nhận', e?.message || 'Không thể cập nhật chữ số. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Xác nhận chữ số" showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.spacerTop} />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Đang cập nhật kết quả bài làm...</Text>
          </View>
        ) : (
          <TokenConfirmationCard
            initialToken={token || '7'}
            onConfirm={handleConfirm}
          />
        )}

        <View style={styles.spacer} />
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
    justifyContent: 'center',
  },
  spacerTop: {
    height: SIZES.medium,
  },
  spacer: {
    flex: 1,
    minHeight: SIZES.large,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: SIZES.xxlarge,
  },
  loadingText: {
    marginTop: SIZES.medium,
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
