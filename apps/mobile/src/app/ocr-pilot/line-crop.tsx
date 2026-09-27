import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Image, PanResponder, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImageManipulator from 'expo-image-manipulator';
import { COLORS, SIZES } from '../../constants/theme';
import { AppHeader } from '../../components/ui/AppHeader';
import { AppButton } from '../../components/ui/AppButton';
import { Ionicons } from '@expo/vector-icons';
import { submissionDraftStore } from '../../services/draft/submissionDraftStore';
import { ensureFileUri, logStageDiagnostic } from '../../services/image/imagePipeline';
import { getAppBranding, isHandAIMode } from '../../config/appMode';

export default function LineCropScreen() {
  const router = useRouter();
  const isHandAI = isHandAIMode();
  const branding = getAppBranding();
  const draft = submissionDraftStore.getDraft();
  const rawUri = isHandAI
    ? (draft?.sourceImageUri || draft?.rawUri || draft?.uri)
    : (draft?.privacyImageUri || draft?.uri);
  const activeUri = rawUri ? ensureFileUri(rawUri) : '';

  React.useEffect(() => {
    if (isHandAI) {
      console.log('HAND_AI IMAGE SOURCE: ORIGINAL');
      console.log('HAND_AI IMAGE SOURCE = ORIGINAL', {
        sourceImageUri: draft?.sourceImageUri,
        rawUri: draft?.rawUri,
        activeUri,
      });
    }
  }, [isHandAI, draft?.sourceImageUri, draft?.rawUri, activeUri]);

  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  React.useEffect(() => {
    // Reset crop state when a new image session starts
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCropRect(null);
  }, [draft?.imageSessionId]);

  const panResponder = useMemo(() => {
    const state = { x: 0, y: 0 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        state.x = evt.nativeEvent.locationX;
        state.y = evt.nativeEvent.locationY;
        setCropRect({ x: state.x, y: state.y, width: 0, height: 0 });
      },
      onPanResponderMove: (evt) => {
        const currentX = evt.nativeEvent.locationX;
        const currentY = evt.nativeEvent.locationY;
        setCropRect({
          x: Math.min(state.x, currentX),
          y: Math.min(state.y, currentY),
          width: Math.abs(currentX - state.x),
          height: Math.abs(currentY - state.y),
        });
      },
      onPanResponderRelease: () => {
        setCropRect(prev => {
          if (prev && (prev.width < 30 || prev.height < 15)) {
            return null;
          }
          return prev;
        });
      },
    });
  }, []);

  const handlePerformCrop = async () => {
    if (!cropRect || cropRect.width < 30 || cropRect.height < 15) {
      Alert.alert(
        isHandAI ? 'No Line Selected' : 'Chưa chọn dòng chữ',
        isHandAI ? 'Please drag a rectangle around a single handwriting line.' : 'Em hãy dùng ngón tay kéo một khung bao quanh một dòng chữ viết tay nhé.'
      );
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Resolve actual image dimensions
      let actualWidth = draft?.width || 0;
      let actualHeight = draft?.height || 0;

      if (!actualWidth || !actualHeight) {
        const manip = await ImageManipulator.manipulateAsync(activeUri, [], {});
        actualWidth = manip.width;
        actualHeight = manip.height;
      }

      // 2. Map container layout to physical image coordinates
      const containerRatio = imageLayout.width / (imageLayout.height || 1);
      const imageRatio = actualWidth / (actualHeight || 1);

      let renderedWidth = imageLayout.width;
      let renderedHeight = imageLayout.height;
      let offsetX = 0;
      let offsetY = 0;

      if (imageRatio > containerRatio) {
        renderedHeight = imageLayout.width / imageRatio;
        offsetY = (imageLayout.height - renderedHeight) / 2;
      } else {
        renderedWidth = imageLayout.height * imageRatio;
        offsetX = (imageLayout.width - renderedWidth) / 2;
      }

      const scale = actualWidth / (renderedWidth || 1);
      const realX = Math.max(0, (cropRect.x - offsetX) * scale);
      const realY = Math.max(0, (cropRect.y - offsetY) * scale);
      const realWidth = Math.min(actualWidth - realX, cropRect.width * scale);
      const realHeight = Math.min(actualHeight - realY, cropRect.height * scale);

      if (realWidth < 20 || realHeight < 10) {
        setIsProcessing(false);
        Alert.alert(
          isHandAI ? 'Selection Box Too Small' : 'Vùng chọn quá nhỏ',
          isHandAI ? 'Please drag a larger box around the handwriting line.' : 'Em hãy vẽ lại khung lớn hơn quanh dòng chữ nhé.'
        );
        return;
      }

      // 3. Crop line
      const result = await ImageManipulator.manipulateAsync(
        activeUri,
        [{ crop: { originX: realX, originY: realY, width: realWidth, height: realHeight } }],
        { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
      );

      const croppedUri = ensureFileUri(result.uri);
      const finalCropWidth = result.width || Math.round(realWidth);
      const finalCropHeight = result.height || Math.round(realHeight);

      submissionDraftStore.updateDraft({
        croppedImageUri: croppedUri,
        uri: croppedUri,
        width: finalCropWidth,
        height: finalCropHeight,
      });

      logStageDiagnostic('CROP_OUTPUT', {
        uri: croppedUri,
        width: finalCropWidth,
        height: finalCropHeight,
        mimeType: 'image/jpeg',
        source: draft?.source,
        extra: 'ocr-pilot line crop',
      });

      setIsProcessing(false);
      router.push('/ocr-pilot/result' as any);
    } catch (err) {
      setIsProcessing(false);
      console.error('[OCR_LINE_CROP] Error cropping line:', err);
      Alert.alert(
        isHandAI ? 'Crop Error' : 'Lỗi cắt ảnh',
        isHandAI ? 'Could not crop the handwriting line. Please try again.' : 'Không thể cắt dòng chữ. Vui lòng thử lại.'
      );
    }
  };

  if (!activeUri) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{isHandAI ? 'No image available' : 'Chưa có ảnh bài tập'}</Text>
        <AppButton title={isHandAI ? 'Back' : 'Quay lại'} onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title={isHandAI ? 'Select Handwriting Line' : 'Chọn dòng chữ viết tay'} showBack />

      {/* Instruction Card */}
      <View style={styles.instructionCard}>
        <View style={styles.instructionHeader}>
          <Ionicons name="scan-outline" size={20} color={COLORS.primary} />
          <Text style={styles.instructionTitle}>
            {isHandAI ? 'Select 1 handwriting line' : 'Chọn 1 dòng chữ viết tay'}
          </Text>
        </View>
        <Text style={styles.instructionText}>
          {isHandAI
            ? `Drag a rectangular box around a single Vietnamese handwriting line for ${branding.name} to recognize.`
            : `Dùng ngón tay kéo một khung chữ nhật bao quanh DUY NHẤT một dòng chữ tiếng Việt để ${branding.name} nhận diện nhé.`}
        </Text>
        <View style={styles.pillContainer}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{isHandAI ? 'Example: Single line' : 'Ví dụ: "hôm nay trời nắng"'}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{isHandAI ? 'Grade 1-5 Handwriting' : '"Em yêu trường em"'}</Text>
          </View>
        </View>
      </View>

      {/* Interactive Crop Canvas */}
      <View style={styles.imageContainer}>
        <View
          style={styles.imageWrapper}
          onLayout={(e) => {
            const { width, height, x, y } = e.nativeEvent.layout;
            setImageLayout({ width, height, x, y });
          }}
          {...panResponder.panHandlers}
        >
          <Image source={{ uri: activeUri }} style={styles.image} resizeMode="contain" />

          {cropRect && (
            <View
              style={[
                styles.cropBox,
                {
                  left: cropRect.x,
                  top: cropRect.y,
                  width: cropRect.width,
                  height: cropRect.height,
                },
              ]}
            >
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
              <View style={styles.lineLabel}>
                <Text style={styles.lineLabelText}>{isHandAI ? 'Line 1' : '1 dòng chữ'}</Text>
              </View>
            </View>
          )}

          {isProcessing && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>
                {isHandAI ? 'Cropping line...' : 'Đang cắt dòng chữ...'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Footer Controls */}
      <View style={styles.footer}>
        <AppButton
          title={
            cropRect
              ? (isHandAI ? "CROP & RECOGNIZE THIS LINE" : "CẮT & NHẬN DIỆN DÒNG NÀY")
              : (isHandAI ? "DRAG BOX TO SELECT LINE" : "KÉO KHUNG ĐỂ CHỌN DÒNG")
          }
          onPress={handlePerformCrop}
          disabled={!cropRect || isProcessing}
          variant="primary"
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>
            {isHandAI ? 'Recapture / Pick Another' : 'Chụp lại / Chọn ảnh khác'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  instructionCard: {
    backgroundColor: COLORS.surface,
    padding: SIZES.medium,
    marginHorizontal: SIZES.large,
    marginTop: SIZES.small,
    marginBottom: SIZES.small,
    borderRadius: SIZES.cardRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginLeft: 6,
  },
  instructionText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 6,
  },
  pill: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: {
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '600',
  },
  imageContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  imageWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  corner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: '#38BDF8',
  },
  tl: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
  lineLabel: {
    position: 'absolute',
    top: -22,
    left: 0,
    backgroundColor: '#38BDF8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lineLabelText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: SIZES.large,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: SIZES.small,
  },
  secondaryButtonText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.large,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginBottom: SIZES.large,
  },
});
