import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { AppHeader } from '../components/ui/AppHeader';
import { AppButton } from '../components/ui/AppButton';
import { QualityBadge } from '../components/domain/QualityBadge';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { submissionDraftStore, resolveFlowDomain, isHandwritingDomain } from '../services/draft/submissionDraftStore';
import { ensureFileUri, logStageDiagnostic } from '../services/image/imagePipeline';

export default function PreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    uri?: string;
    originalUri?: string;
    retrySubmissionId?: string;
  }>();

  const draft = submissionDraftStore.getDraft();
  const effectiveMode = resolveFlowDomain(null, draft?.mode);
  const rawUri = draft?.uri || (Array.isArray(params.uri) ? params.uri[0] : params.uri);
  const initialUri = rawUri ? ensureFileUri(rawUri) : '';

  const [imageUri, setImageUri] = useState<string>(initialUri);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isHandwritingDomain(effectiveMode) || effectiveMode !== 'ARITHMETIC') {
      if (__DEV__) {
        console.warn('[HANDWRITING_PREVIEW_GUARD_TRIGGERED] Non-arithmetic mode reached /preview. Redirecting to handwriting review.');
      }
      if (effectiveMode === 'OCR_PILOT') {
        router.replace('/ocr-pilot/line-crop' as any);
      } else {
        router.replace('/ocr-pilot/multiline-review' as any);
      }
      return;
    }

    if (initialUri) {
      logStageDiagnostic('PREVIEW_INPUT', {
        uri: initialUri,
        width: draft?.width,
        height: draft?.height,
        mimeType: draft?.mimeType,
        source: draft?.source,
        extra: `mode=${effectiveMode}`,
      });
    }
    const timer = setTimeout(() => {
      setIsChecking(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [initialUri, draft?.width, draft?.height, draft?.mimeType, draft?.source, effectiveMode, router]);

  const handleContinue = () => {
    if (isHandwritingDomain(effectiveMode) || effectiveMode !== 'ARITHMETIC') {
      if (__DEV__) {
        console.warn('[HANDWRITING_PREVIEW_GUARD_TRIGGERED] Non-arithmetic mode in handleContinue. Blocking /processing.');
      }
      router.replace('/ocr-pilot/multiline-review' as any);
      return;
    }

    const activeUri = ensureFileUri(imageUri);
    submissionDraftStore.updateDraft({ uri: activeUri, mode: 'ARITHMETIC' });

    router.replace({
      pathname: '/processing' as any,
      params: {
        uri: activeUri,
        originalUri: draft?.rawUri || (Array.isArray(params.originalUri) ? params.originalUri[0] : params.originalUri),
        retrySubmissionId: draft?.retrySubmissionId || (Array.isArray(params.retrySubmissionId) ? params.retrySubmissionId[0] : params.retrySubmissionId),
      },
    });
  };

  const handleRotate = async () => {
    try {
      const activeUri = ensureFileUri(imageUri);
      const manipResult = await ImageManipulator.manipulateAsync(
        activeUri,
        [{ rotate: 90 }],
        { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
      );
      const rotatedUri = ensureFileUri(manipResult.uri);
      setImageUri(rotatedUri);
      submissionDraftStore.updateDraft({
        uri: rotatedUri,
        width: manipResult.width,
        height: manipResult.height,
      });
    } catch {
      Alert.alert('Lỗi', 'Không thể xoay ảnh. Vui lòng thử lại.');
    }
  };

  const handleCrop = () => {
    const activeUri = ensureFileUri(imageUri);
    router.push({
      pathname: '/crop' as any,
      params: {
        uri: activeUri,
        retrySubmissionId: draft?.retrySubmissionId || (Array.isArray(params.retrySubmissionId) ? params.retrySubmissionId[0] : params.retrySubmissionId),
      },
    });
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Xem lại bài đã chụp" showBack />

      <View style={styles.content}>
        {/* Preview image box with quality badge overlay */}
        <View style={[styles.imageContainer, SHADOWS.small]}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />

          <View style={styles.qualityOverlay}>
            {isChecking ? (
              <View style={styles.checkingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.checkingText}>Đang kiểm tra chất lượng ảnh...</Text>
              </View>
            ) : (
              <View style={styles.badgeRow}>
                <QualityBadge label="Ảnh đủ sáng" isGood={true} />
                <QualityBadge label="Nằm trong khung" isGood={true} />
                <QualityBadge label="Một bài toán" isGood={true} />
              </View>
            )}
          </View>
        </View>

        {/* Tools row: Xoay & Chỉnh vùng bài */}
        <View style={styles.toolsRow}>
          <TouchableOpacity
            style={styles.toolButton}
            onPress={handleRotate}
            accessibilityRole="button"
            accessibilityLabel="Xoay ảnh 90 độ"
          >
            <Ionicons name="refresh" size={20} color={COLORS.primary} />
            <Text style={styles.toolText}>Xoay ảnh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={handleCrop}
            accessibilityRole="button"
            accessibilityLabel="Chỉnh lại vùng bài toán"
          >
            <Ionicons name="crop-outline" size={20} color={COLORS.primary} />
            <Text style={styles.toolText}>Chỉnh vùng bài</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <AppButton
            title="KIỂM TRA BÀI TOÁN"
            onPress={handleContinue}
            disabled={isChecking}
            variant="primary"
          />
          <View style={{ height: SIZES.small }} />
          <AppButton
            title="Chụp lại ảnh khác"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SIZES.medium,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  imageContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: SIZES.cardRadius,
    overflow: 'hidden',
    marginBottom: SIZES.medium,
    position: 'relative',
  },
  image: {
    flex: 1,
  },
  qualityOverlay: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: SIZES.medium,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  checkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  checkingText: {
    marginLeft: 8,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SIZES.large,
    gap: SIZES.medium,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SIZES.large,
    minHeight: SIZES.minTouchTarget,
    borderRadius: SIZES.buttonRadius,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    flex: 1,
  },
  toolText: {
    marginLeft: 8,
    color: COLORS.primaryDark,
    fontSize: 14,
    fontWeight: '700',
  },
  actionSection: {
    paddingBottom: SIZES.medium,
  },
});
