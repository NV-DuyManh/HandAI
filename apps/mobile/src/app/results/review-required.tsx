import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, SIZES } from '../../constants/theme';
import { AppHeader } from '../../components/ui/AppHeader';
import { AppButton } from '../../components/ui/AppButton';
import { StatusCard } from '../../components/domain/StatusCard';
import { getSubmissionService } from '../../services/api/SubmissionServiceFactory';
import { SubmissionResult } from '../../types';
import { logFlowDomain } from '../../services/draft/submissionDraftStore';

interface ReasonContent {
  title: string;
  subtitle: string;
  actionTitle: string;
}

function getReasonContent(reasonCode?: string): ReasonContent {
  switch (reasonCode) {
    case 'DETECTOR_NO_TOKENS':
    case 'NO_CONTENT_DETECTED':
      return {
        title: 'MathVision chưa nhận diện được bài làm',
        subtitle: 'MathVision đã thử nhận diện nhưng chưa nhận ra đủ chữ số hoặc dấu phép tính trong ảnh.',
        actionTitle: 'Thử lại',
      };
    case 'INVALID_LAYOUT':
      return {
        title: 'Cần thầy cô xem cách đặt tính',
        subtitle: 'Các chữ số hoặc dấu phép tính chưa rõ ràng theo hàng dọc. Bài đã được chuyển cho thầy cô hỗ trợ em.',
        actionTitle: 'Thử lại',
      };
    case 'OCR_LOW_CONFIDENCE':
      return {
        title: 'MathVision chưa chắc chắn kết quả',
        subtitle: 'MathVision đã thử đọc bài của em nhưng chưa đủ chắc chắn để kết luận. Bài làm đã được giữ lại để xem thêm.',
        actionTitle: 'Thử lại',
      };
    case 'IMAGE_QUALITY_FAILED':
      return {
        title: 'Chất lượng ảnh chụp chưa đạt',
        subtitle: 'Ảnh chụp có thể bị chói sáng, quá tối hoặc bị che khuất. Em có thể chụp lại hoặc chờ thầy cô xem giúp.',
        actionTitle: 'Chụp lại ảnh mới',
      };
    case 'IMAGE_EFFECTIVELY_EMPTY':
      return {
        title: 'Ảnh chụp chưa có bài làm',
        subtitle: 'Ảnh chụp có vẻ còn trống hoặc chưa có nội dung bài tập. Em hãy đặt bài làm vào khung hình và chụp lại nhé.',
        actionTitle: 'Chụp lại bài làm',
      };
    case 'AI_RUNTIME_ERROR':
      return {
        title: 'Hệ thống đang bận',
        subtitle: 'Hệ thống nhận diện đang bận hoặc gặp gián đoạn tạm thời. Bài của em đã được lưu an toàn để thầy cô xem lại.',
        actionTitle: 'Thử lại sau',
      };
    default:
      return {
        title: 'MathVision cần thầy cô xem giúp',
        subtitle: 'Bài làm của em đã được chuyển cho thầy cô để xem lại cẩn thận.',
        actionTitle: 'Thử lại',
      };
  }
}

export default function ReviewRequiredScreen() {
  const router = useRouter();
  const { reasonCode: initialReasonCode, submissionId, diagnostics: initialDiagnostics } = useLocalSearchParams<{
    reasonCode?: string;
    submissionId?: string;
    diagnostics?: string;
  }>();

  const [serverResult, setServerResult] = useState<SubmissionResult | null>(null);
  const [serverFetchStatus, setServerFetchStatus] = useState<'INITIAL' | 'FETCHING' | 'RESULT_FETCH_OK' | 'RESULT_FETCH_FAILED'>(
    submissionId ? 'FETCHING' : 'INITIAL'
  );
  const [serverFetchError, setServerFetchError] = useState<string | null>(null);

  // Authoritative server fetch on mount
  useEffect(() => {
    let isMounted = true;
    if (submissionId) {
      getSubmissionService()
        .getSubmission(submissionId)
        .then((res) => {
          if (isMounted) {
            setServerResult(res);
            setServerFetchStatus('RESULT_FETCH_OK');
          }
        })
        .catch((err: any) => {
          if (isMounted) {
            console.warn('[REVIEW_REQUIRED] Authoritative server fetch failed for submissionId:', submissionId, err?.message || err);
            setServerFetchStatus('RESULT_FETCH_FAILED');
            const errDetail = err?.response?.status ? `HTTP ${err.response.status}` : (err?.message || 'Network Error');
            setServerFetchError(errDetail);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [submissionId]);

  let parsedDiags: Record<string, any> | null = null;
  if (initialDiagnostics) {
    try {
      parsedDiags = JSON.parse(initialDiagnostics);
    } catch {
      parsedDiags = null;
    }
  }

  // Server result overrides fragile route params
  const effectiveDiagnostics = serverResult?.diagnostics || parsedDiags;
  const effectiveReasonCode = serverResult?.reasonCode || initialReasonCode || parsedDiags?.reasonCode;
  const effectiveFlowDomain = serverResult?.flowDomain || (parsedDiags?.flowDomain as any) || 'ARITHMETIC';
  const effectiveStatus = serverResult?.status || 'REVIEW_REQUIRED';

  useEffect(() => {
    logFlowDomain('RESULT', effectiveFlowDomain);
  }, [effectiveFlowDomain]);

  const content = getReasonContent(effectiveReasonCode);

  const formatDiag = (val: any, naCondition: boolean = false): string => {
    if (naCondition) return 'N/A';
    if (val === undefined || val === null) return 'UNAVAILABLE';
    if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : 'none';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return String(val);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <AppHeader title="Chờ thầy cô xem lại" showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.spacerTop} />

        <StatusCard
          status="warning"
          title={content.title}
          subtitle={content.subtitle}
        />

        {__DEV__ && (
          <View style={styles.devBox} testID="dev-diagnostic-panel">
            <Text style={styles.devTitle}>DEV Diagnostic (Stage Proof)</Text>
            <Text style={styles.devText}>flowDomain: {effectiveFlowDomain}</Text>
            <Text style={styles.devText}>status: {effectiveStatus}</Text>
            <Text style={styles.devText}>reasonCode: {effectiveReasonCode || 'UNAVAILABLE'}</Text>
            <Text style={styles.devText}>detectorInvoked: {formatDiag(effectiveDiagnostics?.detectorInvoked)}</Text>
            <Text style={styles.devText}>detectorTokenCount: {formatDiag(effectiveDiagnostics?.detectorTokenCount)}</Text>
            <Text style={styles.devText}>ocrInvoked: {formatDiag(effectiveDiagnostics?.ocrInvoked, effectiveDiagnostics?.ocrInvoked === 'not_applicable')}</Text>
            <Text style={styles.devText}>ocrTextLength: {formatDiag(effectiveDiagnostics?.ocrTextLength, effectiveDiagnostics?.ocrInvoked === false)}</Text>
            <Text style={styles.devText}>parserStatus: {formatDiag(effectiveDiagnostics?.parserStatus)}</Text>
            <Text style={styles.devText}>validatorStatus: {formatDiag(effectiveDiagnostics?.validatorStatus)}</Text>
            <Text style={styles.devText}>qualityFlags: {formatDiag(effectiveDiagnostics?.qualityFlags)}</Text>
            <Text style={styles.devText}>
              serverFetchStatus: {serverFetchStatus}{serverFetchStatus === 'RESULT_FETCH_FAILED' && serverFetchError ? ` (${serverFetchError})` : ''}
            </Text>
            {submissionId ? <Text style={styles.devText}>submissionId: {submissionId}</Text> : null}
          </View>
        )}

        <View style={styles.spacer} />

        <View style={styles.actions}>
          <AppButton
            title={content.actionTitle}
            variant="primary"
            onPress={() => router.replace({ pathname: '/camera' as any, params: { mode: 'ARITHMETIC' } })}
          />
          <View style={{ height: SIZES.small }} />
          <AppButton
            title="Về trang chủ"
            variant="secondary"
            onPress={() => router.replace('/(tabs)')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
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
  devBox: {
    marginTop: SIZES.medium,
    padding: SIZES.medium,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  devTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  devText: {
    fontSize: 12,
    color: '#4B5563',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 2,
  },
  actions: {
    paddingBottom: SIZES.medium,
  },
});
