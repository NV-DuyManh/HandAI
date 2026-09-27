import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { getSubmissionService } from '../services/api/SubmissionServiceFactory';
import { SubmissionStatus } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { submissionDraftStore, isHandwritingDomain, resolveFlowDomain } from '../services/draft/submissionDraftStore';
import { ensureFileUri, logStageDiagnostic } from '../services/image/imagePipeline';

export default function ProcessingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    uri?: string;
    originalUri?: string;
    retrySubmissionId?: string;
  }>();
  const [step, setStep] = useState(0); // 0: Đọc bài, 1: Kiểm tra, 2: Gợi ý

  useEffect(() => {
    let active = true;
    let submissionId = '';

    const runProcess = async () => {
      try {
        setStep(0);
        const draft = submissionDraftStore.getDraft();
        const effectiveMode = resolveFlowDomain(null, draft?.mode);

        if (isHandwritingDomain(effectiveMode) || effectiveMode !== 'ARITHMETIC') {
          if (__DEV__) {
            console.warn('[HANDWRITING_PROCESSING_GUARD_TRIGGERED] Non-arithmetic domain reached /processing. Blocking arithmetic submission.');
          }
          if (effectiveMode === 'OCR_PILOT') {
            router.replace('/ocr-pilot/line-crop' as any);
          } else {
            router.replace('/ocr-pilot/multiline-review' as any);
          }
          return;
        }

        const rawParamUri = Array.isArray(params.uri) ? params.uri[0] : params.uri;
        const activeUri = draft?.uri || (rawParamUri ? ensureFileUri(rawParamUri) : '');
        const activeRetryId = draft?.retrySubmissionId || (Array.isArray(params.retrySubmissionId) ? params.retrySubmissionId[0] : params.retrySubmissionId);
        const activeOriginalUri = draft?.rawUri || (Array.isArray(params.originalUri) ? params.originalUri[0] : params.originalUri);

        if (!activeUri) {
          console.error('[PROCESSING][IMAGE_URI_INVALID] No valid image URI found in draft store or params.');
          Alert.alert('Lỗi', 'Không tìm thấy ảnh bài tập hợp lệ. Vui lòng chụp lại.', [{ text: 'Đồng ý', onPress: () => router.back() }]);
          return;
        }

        logStageDiagnostic('PROCESSING_INPUT', {
          uri: activeUri,
          width: draft?.width,
          height: draft?.height,
          mimeType: draft?.mimeType,
          source: draft?.source,
        });

        const submissionService = getSubmissionService();
        let result;
        if (activeRetryId) {
          result = await submissionService.retrySubmission(activeRetryId, activeUri);
        } else {
          result = await submissionService.uploadImage(activeUri);
        }
        if (!active) return;
        submissionId = result.id;

        if (
          result.status === SubmissionStatus.NEEDS_RETAKE ||
          result.status === SubmissionStatus.CROP_REQUIRED
        ) {
          logStageDiagnostic('TERMINAL_STATUS', {
            uri: activeUri,
            source: draft?.source,
            extra: `status=${result.status} issue=${result.imageQualityIssue}`,
          });
          router.replace({
            pathname: '/results/quality-failure' as any,
            params: {
              issue: result.imageQualityIssue,
              originalUri: activeOriginalUri,
              submissionId,
            },
          });
          return;
        }
        if (
          result.status === SubmissionStatus.OUT_OF_SCOPE ||
          result.reasonCode === 'OUT_OF_SCOPE'
        ) {
          logStageDiagnostic('TERMINAL_STATUS', {
            uri: activeUri,
            source: draft?.source,
            extra: `status=${result.status} reasonCode=${result.reasonCode || 'none'}`,
          });
          router.replace('/results/out-of-scope');
          return;
        }
        if (result.status === SubmissionStatus.REVIEW_REQUIRED) {
          logStageDiagnostic('TERMINAL_STATUS', {
            uri: activeUri,
            source: draft?.source,
            extra: `status=${result.status} reasonCode=${result.reasonCode || 'none'}`,
          });
          router.replace({
            pathname: '/results/review-required',
            params: {
              reasonCode: result.reasonCode || '',
              submissionId,
              diagnostics: result.diagnostics ? JSON.stringify(result.diagnostics) : '',
            },
          });
          return;
        }
        if (result.status === SubmissionStatus.FEEDBACK_READY) {
          logStageDiagnostic('TERMINAL_STATUS', {
            uri: activeUri,
            source: draft?.source,
            extra: `status=${result.status} id=${submissionId}`,
          });
          router.replace({ pathname: '/results/correct', params: { data: JSON.stringify(result) } });
          return;
        }

        setStep(1);

        let scenarioHint = 'mock-correct';
        if (activeUri?.includes('mock-earliest-error')) scenarioHint = 'mock-earliest-error';
        if (activeUri?.includes('mock-confirm')) scenarioHint = 'mock-confirm';

        // Polling loop
        let polled = result;
        while (active && polled.status === SubmissionStatus.PROCESSING) {
          await new Promise(r => setTimeout(r, 2000));
          if (!active) return;
          try {
            polled = await submissionService.getSubmission(submissionId, scenarioHint);
          } catch (e) {
            console.error('Polling error', e);
          }
        }

        if (!active) return;

        logStageDiagnostic('TERMINAL_STATUS', {
          uri: activeUri,
          source: draft?.source,
          extra: `status=${polled.status} decision=${polled.validation?.decision} id=${submissionId}`,
        });

        if (polled.status === SubmissionStatus.NEEDS_CONFIRMATION) {
          if (isHandwritingDomain(draft?.mode)) {
            router.replace('/ocr-pilot/result' as any);
            return;
          }
          router.replace({
            pathname: '/results/token-confirmation',
            params: {
              id: submissionId,
              token: polled.ambiguousToken?.value || '',
            },
          });
          return;
        }

        if (
          polled.status === SubmissionStatus.NEEDS_RETAKE ||
          polled.status === SubmissionStatus.CROP_REQUIRED
        ) {
          router.replace({
            pathname: '/results/quality-failure' as any,
            params: {
              issue: polled.imageQualityIssue,
              originalUri: activeOriginalUri,
              submissionId,
            },
          });
          return;
        }

        if (
          polled.status === SubmissionStatus.OUT_OF_SCOPE ||
          polled.reasonCode === 'OUT_OF_SCOPE'
        ) {
          router.replace('/results/out-of-scope');
          return;
        }

        if (polled.status === SubmissionStatus.REVIEW_REQUIRED) {
          router.replace({
            pathname: '/results/review-required',
            params: {
              reasonCode: polled.reasonCode || '',
              submissionId,
              diagnostics: polled.diagnostics ? JSON.stringify(polled.diagnostics) : '',
            },
          });
          return;
        }

        setStep(2);
        await new Promise(r => setTimeout(r, 800));
        if (!active) return;

        if (polled.validation?.decision === 'VALID') {
          router.replace({
            pathname: '/results/correct',
            params: { data: JSON.stringify(polled) },
          });
        } else {
          router.replace({
            pathname: '/results/error-hint',
            params: { data: JSON.stringify(polled) },
          });
        }
      } catch (error: any) {
        const httpStatus = error?.response?.status;
        let stageCode = 'UPLOAD_PRE_HTTP_FAILURE';
        if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
          stageCode = `UPLOAD_HTTP_${httpStatus}`;
        } else if (httpStatus && httpStatus >= 500) {
          stageCode = `UPLOAD_HTTP_${httpStatus}`;
        } else if (error?.code === 'ERR_NETWORK') {
          stageCode = 'UPLOAD_NETWORK_ERROR';
        }
        console.error(`[PROCESSING][${stageCode}] Submission error:`, error?.message || error);

        if (active) {
          Alert.alert(
            'Chưa thể gửi bài tập',
            'MathVision chưa thể gửi ảnh bài tập lên máy chủ. Em hãy thử lại hoặc chụp lại ảnh nhé.',
            [{ text: 'Đồng ý', onPress: () => router.back() }]
          );
        }
      }
    };

    runProcess();

    return () => {
      active = false;
    };
  }, [params.uri, router, params.originalUri, params.retrySubmissionId]);

  const stages = [
    { label: 'Đọc bài', desc: 'Nhận diện chữ số' },
    { label: 'Kiểm tra', desc: 'So sánh từng hàng' },
    { label: 'Gợi ý', desc: 'Chuẩn bị kết quả' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>MathVision đang xem bài...</Text>
        <Text style={styles.subtitle}>Em chờ một lát để trợ lý kiểm tra từng chữ số nhé.</Text>

        <View style={[styles.imagePreview, SHADOWS.small]}>
          {(() => {
            const draftUri = submissionDraftStore.getDraft()?.uri;
            const fallbackUri = Array.isArray(params.uri) ? params.uri[0] : params.uri;
            const displayUri = draftUri || (fallbackUri ? ensureFileUri(fallbackUri) : '');
            return displayUri ? (
              <Image source={{ uri: displayUri }} style={styles.image} resizeMode="contain" />
            ) : null;
          })()}
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        </View>

        {/* Stepper progress indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.stepRow}>
            {stages.map((stage, index) => {
              const isCompleted = step > index;
              const isActive = step === index;
              return (
                <View key={stage.label} style={styles.stepWrapper}>
                  <View
                    style={[
                      styles.dot,
                      isActive && styles.dotActive,
                      isCompleted && styles.dotCompleted,
                    ]}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    ) : (
                      <Text
                        style={[
                          styles.dotNumber,
                          isActive && styles.dotNumberActive,
                        ]}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepText,
                      isActive && styles.stepTextActive,
                      isCompleted && styles.stepTextCompleted,
                    ]}
                  >
                    {stage.label}
                  </Text>
                  <Text style={styles.stepDesc}>{stage.desc}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.large,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
    padding: SIZES.xlarge,
    alignItems: 'center',
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SIZES.xlarge,
    lineHeight: 20,
  },
  imagePreview: {
    width: 200,
    height: 200,
    borderRadius: SIZES.cardRadius,
    overflow: 'hidden',
    marginBottom: SIZES.xxlarge,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  image: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    width: '100%',
    paddingTop: SIZES.small,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stepWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  dotActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceSubdued,
  },
  dotCompleted: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success,
  },
  dotNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  dotNumberActive: {
    color: COLORS.primaryDark,
  },
  stepText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  stepTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  stepTextCompleted: {
    color: COLORS.success,
    fontWeight: '700',
  },
  stepDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
});
