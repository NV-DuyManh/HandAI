import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { AppHeader } from '../../components/ui/AppHeader';
import { AppButton } from '../../components/ui/AppButton';
import { Ionicons } from '@expo/vector-icons';
import { submissionDraftStore, logFlowDomain } from '../../services/draft/submissionDraftStore';
import { ensureFileUri } from '../../services/image/imagePipeline';
import { OcrPilotService, OcrTrialResult } from '../../services/api/OcrPilotService';
import { getAppBranding } from '../../config/appMode';

export default function OcrResultScreen() {
  const router = useRouter();
  const branding = getAppBranding();
  const draft = submissionDraftStore.getDraft();
  const lineCropUri = draft?.uri ? ensureFileUri(draft.uri) : '';

  const [isLoading, setIsLoading] = useState(true);
  const [trialResult, setTrialResult] = useState<OcrTrialResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Feedback states
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [feedbackVerdict, setFeedbackVerdict] = useState<'CORRECT' | 'CORRECTED' | 'SKIPPED' | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  useEffect(() => {
    let active = true;

    const performRecognition = async () => {
      if (!lineCropUri) {
        setErrorMsg('Không tìm thấy ảnh dòng chữ');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMsg(null);
        const source = draft?.source || 'CAMERA';
        const res = await OcrPilotService.createTrial(lineCropUri, source, false, true);
        if (!active) return;
        logFlowDomain('RESULT', 'HANDWRITING_TEXT');
        setTrialResult(res);
        setEditedText(res.recognizedText || '');
        setIsLoading(false);
      } catch (err: any) {
        if (!active) return;
        console.error('[OCR_PILOT] Recognition error:', err);
        setErrorMsg('Không thể nhận diện dòng chữ lúc này. Vui lòng kiểm tra kết nối.');
        setIsLoading(false);
      }
    };

    performRecognition();

    return () => {
      active = false;
    };
  }, [lineCropUri, draft?.source]);

  const handleCorrect = async () => {
    if (!trialResult) return;
    try {
      setIsSubmittingFeedback(true);
      await OcrPilotService.submitFeedback(trialResult.trialId, 'CORRECT');
      setFeedbackVerdict('CORRECT');
      setFeedbackSaved(true);
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu phản hồi. Vui lòng thử lại.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleSaveCorrection = async () => {
    if (!trialResult) return;
    if (!editedText || !editedText.trim()) {
      Alert.alert('Chưa nhập chữ', 'Em hãy nhập dòng chữ đúng nhé.');
      return;
    }

    try {
      setIsSubmittingFeedback(true);
      await OcrPilotService.submitFeedback(trialResult.trialId, 'CORRECTED', editedText);
      setFeedbackVerdict('CORRECTED');
      setFeedbackSaved(true);
      setIsEditing(false);
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu phản hồi đã sửa. Vui lòng thử lại.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleSkip = async () => {
    if (trialResult) {
      try {
        await OcrPilotService.submitFeedback(trialResult.trialId, 'SKIPPED');
      } catch {
        // Non-blocking skip
      }
    }
    router.replace('/(tabs)');
  };

  const handleRecognizeAnother = () => {
    submissionDraftStore.clearDraft();
    router.replace('/(tabs)');
  };

  const hasRecognizedText = !!(trialResult && trialResult.recognizedText && trialResult.recognizedText.trim().length > 0);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title={hasRecognizedText ? "Kết quả nhận diện" : `${branding.name} chưa đọc chắc chắn`} showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Cropped Line Image Card */}
        <View style={[styles.card, SHADOWS.small]}>
          <Text style={styles.cardLabel}>Ảnh dòng chữ em đã chọn:</Text>
          {lineCropUri ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: lineCropUri }} style={styles.cropImage} resizeMode="contain" />
            </View>
          ) : (
            <Text style={styles.missingImageText}>Chưa có ảnh dòng chữ</Text>
          )}
        </View>

        {/* Recognition Content */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingTitle}>{branding.name} đang đọc chữ viết tay...</Text>
            <Text style={styles.loadingSub}>Mô hình AI CRNN đang xử lý dòng chữ tiếng Việt</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={44} color={COLORS.error} />
            <Text style={styles.errorTitle}>Lỗi nhận diện</Text>
            <Text style={styles.errorSub}>{errorMsg}</Text>
            <AppButton title="Thử lại" onPress={handleRecognizeAnother} variant="primary" />
          </View>
        ) : (
          <View style={styles.resultSection}>
            {hasRecognizedText ? (
              <>
                <Text style={styles.sectionHeading}>{branding.name} đọc được:</Text>
                <View style={[styles.textBox, SHADOWS.small]}>
                  <Text style={styles.recognizedText}>
                    {trialResult?.recognizedText}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.emptyNoticeBox}>
                <Ionicons name="help-circle-outline" size={32} color={COLORS.warning} />
                <Text style={styles.emptyNoticeTitle}>{branding.name} chưa đọc chắc chắn</Text>
                <Text style={styles.emptyNoticeSub}>
                  {branding.name} đã thử đọc bài viết tay nhưng kết quả chưa đủ rõ. Em có thể thử lại hoặc nhập nội dung đúng.
                </Text>
              </View>
            )}

            {/* Feedback Actions */}
            {!feedbackSaved ? (
              <View style={styles.feedbackSection}>
                {!isEditing ? (
                  <>
                    {hasRecognizedText ? (
                      <>
                        <Text style={styles.feedbackPrompt}>Kết quả đọc có chính xác không em?</Text>

                        <TouchableOpacity
                          style={[styles.actionButton, styles.correctButton]}
                          onPress={handleCorrect}
                          disabled={isSubmittingFeedback}
                        >
                          <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                          <Text style={styles.actionButtonText}>✓ Đúng</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionButton, styles.editButton]}
                          onPress={() => setIsEditing(true)}
                          disabled={isSubmittingFeedback}
                        >
                          <Ionicons name="pencil" size={20} color={COLORS.primaryDark} />
                          <Text style={[styles.actionButtonText, { color: COLORS.primaryDark }]}>✎ Sửa</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.retryButton]}
                          onPress={handleRecognizeAnother}
                          disabled={isSubmittingFeedback}
                        >
                          <Ionicons name="refresh" size={20} color="#FFFFFF" />
                          <Text style={styles.actionButtonText}>Thử lại</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionButton, styles.editButton]}
                          onPress={() => setIsEditing(true)}
                          disabled={isSubmittingFeedback}
                        >
                          <Ionicons name="pencil" size={20} color={COLORS.primaryDark} />
                          <Text style={[styles.actionButtonText, { color: COLORS.primaryDark }]}>Nhập nội dung đúng</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    <TouchableOpacity
                      style={styles.skipButton}
                      onPress={handleSkip}
                      disabled={isSubmittingFeedback}
                    >
                      <Text style={styles.skipButtonText}>Bỏ qua</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.editSection}>
                    <Text style={styles.editLabel}>Nhập dòng chữ đúng theo ảnh:</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editedText}
                      onChangeText={setEditedText}
                      autoFocus
                      multiline
                      placeholder="Nhập chữ viết tay đúng..."
                    />
                    <View style={styles.editButtonsRow}>
                      <TouchableOpacity
                        style={[styles.editActionBtn, styles.cancelBtn]}
                        onPress={() => setIsEditing(false)}
                        disabled={isSubmittingFeedback}
                      >
                        <Text style={styles.cancelBtnText}>Hủy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.editActionBtn, styles.saveBtn]}
                        onPress={handleSaveCorrection}
                        disabled={isSubmittingFeedback}
                      >
                        {isSubmittingFeedback ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.saveBtnText}>Lưu kết quả đúng</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.savedSection}>
                <View style={styles.savedBadge}>
                  <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
                  <Text style={styles.savedTitle}>
                    {feedbackVerdict === 'CORRECT' ? 'Cảm ơn em! Đã ghi nhận kết quả đúng.' : 'Đã lưu kết quả em đã sửa!'}
                  </Text>
                  <Text style={styles.savedSub}>
                    Dữ liệu đã được lưu để hỗ trợ đội ngũ AI huấn luyện cải thiện mô hình sau này.
                  </Text>
                </View>

                <View style={{ height: SIZES.large }} />
                <AppButton title="THỬ NHẬN DIỆN DÒNG KHÁC" onPress={handleRecognizeAnother} variant="primary" />
                <View style={{ height: SIZES.small }} />
                <AppButton title="Về trang chủ" onPress={() => router.replace('/(tabs)')} variant="secondary" />
              </View>
            )}
          </View>
        )}

        {__DEV__ && (
          <View style={styles.devBox} testID="dev-diagnostic-panel">
            <Text style={styles.devTitle}>DEV Diagnostic (Handwriting OCR)</Text>
            <Text style={styles.devText}>flowDomain: HANDWRITING_TEXT</Text>
            <Text style={styles.devText}>trialId: {trialResult?.trialId || 'UNAVAILABLE'}</Text>
            <Text style={styles.devText}>lineCount: 1</Text>
            <Text style={styles.devText}>ocrInvoked: {trialResult ? 'true' : 'UNAVAILABLE'}</Text>
            <Text style={styles.devText}>recognizedTextLength: {trialResult?.recognizedText ? String(trialResult.recognizedText.length) : '0'}</Text>
            <Text style={styles.devText}>perLineStatus: {trialResult?.recognizedText ? 'OK' : 'EMPTY'}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SIZES.large,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
    padding: SIZES.medium,
    marginBottom: SIZES.large,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  imageContainer: {
    height: 80,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropImage: {
    width: '100%',
    height: '100%',
  },
  missingImageText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  loadingBox: {
    padding: SIZES.xlarge,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 14,
  },
  loadingSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  errorBox: {
    padding: SIZES.xlarge,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.error,
    marginTop: 10,
  },
  errorSub: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: SIZES.large,
  },
  resultSection: {
    marginTop: 4,
  },
  emptyNoticeBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: SIZES.medium,
    alignItems: 'center',
    marginBottom: SIZES.large,
  },
  emptyNoticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 6,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyNoticeSub: {
    fontSize: 14,
    color: '#B45309',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  textBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: SIZES.cardRadius,
    padding: SIZES.large,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
    marginBottom: SIZES.large,
  },
  recognizedText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 30,
  },
  feedbackSection: {
    marginTop: SIZES.small,
  },
  feedbackPrompt: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SIZES.medium,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZES.minTouchTarget,
    borderRadius: SIZES.buttonRadius,
    paddingHorizontal: SIZES.large,
    marginBottom: SIZES.medium,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  correctButton: {
    backgroundColor: COLORS.success,
  },
  correctButtonText: {
    color: '#FFFFFF',
  },
  editButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  editSection: {
    backgroundColor: COLORS.surface,
    padding: SIZES.large,
    borderRadius: SIZES.cardRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: SIZES.medium,
    fontSize: 18,
    color: COLORS.textPrimary,
    minHeight: 50,
    backgroundColor: '#FFFFFF',
    marginBottom: SIZES.medium,
  },
  editButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SIZES.small,
  },
  editActionBtn: {
    minHeight: SIZES.minTouchTarget,
    paddingHorizontal: SIZES.large,
    borderRadius: SIZES.buttonRadius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: COLORS.background,
  },
  cancelBtnText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  savedSection: {
    alignItems: 'center',
    marginTop: SIZES.medium,
  },
  savedBadge: {
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: SIZES.large,
    borderRadius: SIZES.cardRadius,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    width: '100%',
  },
  savedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065F46',
    marginTop: 8,
    textAlign: 'center',
  },
  savedSub: {
    fontSize: 13,
    color: '#047857',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  devBox: {
    marginTop: SIZES.large,
    padding: SIZES.medium,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  devTitle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  devText: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
});
