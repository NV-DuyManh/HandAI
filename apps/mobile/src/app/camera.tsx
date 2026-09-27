import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SIZES } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '../components/ui/AppButton';
import { ScanFrame } from '../components/domain/ScanFrame';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { submissionDraftStore, FlowDomain, isHandwritingDomain, resolveFlowDomain, logFlowDomain } from '../services/draft/submissionDraftStore';
import { normalizeImageDraft, logStageDiagnostic } from '../services/image/imagePipeline';
import { isHandAIMode, getAppBranding, getFeatureFlags } from '../config/appMode';

export default function CameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const isHandAI = isHandAIMode();
  const branding = getAppBranding();
  const featureFlags = getFeatureFlags();

  const resolveInitialMode = (): FlowDomain => {
    if (isHandAI) return 'HANDWRITING_TEXT';
    return resolveFlowDomain(params.mode, submissionDraftStore.getDraft()?.mode);
  };

  const [mode, setModeState] = useState<FlowDomain>(resolveInitialMode);
  const setMode = (newMode: FlowDomain) => {
    const effectiveMode = isHandAI ? 'HANDWRITING_TEXT' : newMode;
    setModeState(effectiveMode);
    submissionDraftStore.updateDraft({ mode: effectiveMode });
  };

  const isHandwriting = isHandwritingDomain(mode);

  const facing = 'back';
  const [flash, setFlash] = useState<'off' | 'on'>('off');

  if (!permission) {
    return <View style={styles.container} />;
  }

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const activeMode = resolveFlowDomain(mode, null);
        logStageDiagnostic('ACQUIRE_GALLERY', {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType,
          source: 'GALLERY',
          extra: `mode=${activeMode}`,
        });
        logFlowDomain('ACQUIRE', activeMode);
        const draft = await normalizeImageDraft(asset.uri, asset.width, asset.height, 'GALLERY');
        draft.mode = activeMode;
        if (isHandAI) {
          submissionDraftStore.clearDraft();
          draft.privacyImageUri = undefined;
          draft.isMasked = false;
          draft.sourceImageUri = asset.uri;
          draft.uri = asset.uri;
          console.log(`[HAND_AI DEBUG]\nCurrent mode:\nHAND_AI\n\nIncoming image URI:\n${asset.uri}\n\nSelected crop URI:\n${asset.uri}\n\nPrivacy URI:\nundefined\n`);
        }
        submissionDraftStore.setDraft(draft);
        const nextTarget = isHandAI ? '/crop' : '/privacy';
        router.push({ pathname: nextTarget as any, params: { uri: isHandAI ? asset.uri : draft.uri } });
      }
    } catch {
      Alert.alert(
        isHandAI ? 'Error' : 'Lỗi',
        isHandAI ? `${branding.name} could not open image gallery.` : `${branding.name} không mở được thư viện ảnh.`
      );
    }
  };

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <View style={styles.permissionIconBadge}>
          <Ionicons name="camera-outline" size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.permissionTitle}>{branding.name} cần mở máy ảnh</Text>
        <Text style={styles.permissionText}>
          {isHandAI
            ? 'Em hãy cho phép ứng dụng truy cập máy ảnh để chụp và nhận diện bài viết tay nhé.'
            : 'Em hãy cho phép ứng dụng truy cập máy ảnh để chụp và kiểm tra bài toán nhé.'}
        </Text>
        <View style={styles.permissionActions}>
          <AppButton title="Cho phép mở máy ảnh" onPress={requestPermission} />
          <View style={{ height: SIZES.medium }} />
          <AppButton
            title="Chọn ảnh từ thư viện"
            variant="secondary"
            onPress={handlePickImage}
          />
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Quay lại trang chủ"
          >
            <Text style={styles.backButtonText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 1, base64: false });
        if (photo) {
          const activeMode = resolveFlowDomain(mode, null);
          logStageDiagnostic('ACQUIRE_CAMERA', {
            uri: photo.uri,
            width: photo.width,
            height: photo.height,
            mimeType: 'image/jpeg',
            source: 'CAMERA',
            extra: `mode=${activeMode}`,
          });
          logFlowDomain('ACQUIRE', activeMode);
          const draft = await normalizeImageDraft(photo.uri, photo.width, photo.height, 'CAMERA');
          draft.mode = activeMode;
          draft.originalImageUri = photo.uri;
          draft.originalUri = photo.uri;
          draft.sourceImageUri = photo.uri;
          draft.rawUri = photo.uri;
          draft.uri = photo.uri;
          if (isHandAI) {
            submissionDraftStore.clearDraft();
            draft.privacyImageUri = undefined;
            draft.isMasked = false;
          }
          submissionDraftStore.setDraft(draft);
          const nextTarget = isHandAI ? '/crop' : '/privacy';
          router.push({
            pathname: nextTarget as any,
            params: isHandAI
              ? { uri: photo.uri }
              : { uri: draft.uri },
          });
        }
      } catch {
        Alert.alert('Lỗi', 'Không thể chụp ảnh, vui lòng thử lại.');
      }
    }
  };

  const toggleFlash = () => {
    setFlash((f) => (f === 'off' ? 'on' : 'off'));
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={facing}
        enableTorch={flash === 'on'}
        ref={cameraRef}
      />
      <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
        {/* Header Controls */}
        <View style={[styles.header, { marginTop: Math.max(insets.top, SIZES.small) }]}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)' as any);
              }
            }}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Đóng máy ảnh, quay lại"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Mode Selector Tab Bar or Single Mode Badge */}
          {featureFlags.showArithmeticMode ? (
            <View style={styles.modeTabBar}>
              <TouchableOpacity
                style={[
                  styles.modeTab,
                  isHandwriting && styles.modeTabActive,
                ]}
                onPress={() => setMode('HANDWRITING_TEXT')}
                accessibilityRole="tab"
                accessibilityState={{ selected: isHandwriting }}
                accessibilityLabel="Chế độ chữ viết tay tiếng Việt"
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={isHandwriting ? '#FFFFFF' : '#CBD5E1'}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    isHandwriting && styles.modeTabTextActive,
                  ]}
                >
                  Chữ viết tay
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeTab,
                  !isHandwriting && styles.modeTabActive,
                ]}
                onPress={() => setMode('ARITHMETIC')}
                accessibilityRole="tab"
                accessibilityState={{ selected: !isHandwriting }}
                accessibilityLabel="Chế độ phép tính đặt dọc"
              >
                <Ionicons
                  name="calculator-outline"
                  size={16}
                  color={!isHandwriting ? '#FFFFFF' : '#CBD5E1'}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    !isHandwriting && styles.modeTabTextActive,
                  ]}
                >
                  Phép tính
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.singleModeBadge}>
              <Ionicons name="create-outline" size={16} color="#FFFFFF" />
              <Text style={styles.singleModeBadgeText}>
                {isHandAI ? 'Vietnamese Handwriting Recognition' : 'Nhận diện chữ viết tay'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() =>
              Alert.alert(
                isHandAI
                  ? 'Handwriting Capture Guidelines'
                  : (isHandwriting ? 'Hướng dẫn chụp chữ viết tay' : 'Hướng dẫn chụp bài toán'),
                isHandAI
                  ? '1. Align notebook handwriting lines in frame.\n2. Ensure adequate lighting.\n3. Hold steady for clear focus.'
                  : (isHandwriting
                    ? '1. Đặt dòng chữ hoặc đoạn văn viết tay vào khung.\n2. Chụp trong không gian đủ ánh sáng.\n3. Giữ chắc tay để ảnh rõ nét.'
                    : '1. Đặt trọn vẹn phép tính vào khung.\n2. Chụp trong không gian đủ ánh sáng.\n3. Giữ chắc tay để ảnh không bị mờ.')
              )
            }
            accessibilityRole="button"
            accessibilityLabel={isHandAI ? 'View capture guidelines' : 'Xem hướng dẫn chụp ảnh'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="help-circle-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Central Scan Frame */}
        <ScanFrame />

        {/* Bottom Controls */}
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom + 8, SIZES.large) },
          ]}
        >
          <TouchableOpacity
            style={styles.footerAction}
            onPress={handlePickImage}
            accessibilityRole="button"
            accessibilityLabel={isHandAI ? 'Upload image from gallery' : 'Chọn ảnh từ thư viện'}
          >
            <View style={styles.footerIconCircle}>
              <Ionicons name="images-outline" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.footerActionText}>{isHandAI ? 'Upload' : 'Thư viện'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
            accessibilityRole="button"
            accessibilityLabel={
              isHandAI
                ? 'Capture notebook handwriting image'
                : (isHandwriting ? 'Chụp ảnh chữ viết tay tiếng Việt' : 'Chụp ảnh bài toán')
            }
          >
            <View style={styles.captureInner} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerAction}
            onPress={toggleFlash}
            accessibilityRole="button"
            accessibilityLabel={flash === 'on' ? (isHandAI ? 'Turn off torch' : 'Tắt đèn pin') : (isHandAI ? 'Turn on torch' : 'Bật đèn pin')}
          >
            <View
              style={[
                styles.footerIconCircle,
                flash === 'on' && styles.footerIconCircleActive,
              ]}
            >
              <Ionicons
                name={flash === 'on' ? 'flash' : 'flash-off-outline'}
                size={24}
                color={flash === 'on' ? COLORS.warning : '#FFFFFF'}
              />
            </View>
            <Text style={styles.footerActionText}>
              {flash === 'on' ? (isHandAI ? 'Torch' : 'Tắt đèn') : (isHandAI ? 'Torch' : 'Bật đèn')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xlarge,
    backgroundColor: COLORS.background,
  },
  permissionIconBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.surfaceSubdued,
    borderWidth: 2,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.large,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: SIZES.small,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: SIZES.xxlarge,
    color: COLORS.textSecondary,
    lineHeight: 22,
    maxWidth: 320,
  },
  permissionActions: {
    width: '100%',
    maxWidth: 320,
  },
  backButton: {
    marginTop: SIZES.medium,
    alignItems: 'center',
    padding: SIZES.medium,
    minHeight: SIZES.minTouchTarget,
  },
  backButtonText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.medium,
    zIndex: 20,
  },
  modeTabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 24,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modeTabActive: {
    backgroundColor: COLORS.primary,
  },
  modeTabText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  modeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  iconButton: {
    width: SIZES.minTouchTarget,
    height: SIZES.minTouchTarget,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: SIZES.minTouchTarget / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 20,
    paddingTop: SIZES.large,
  },
  footerAction: {
    alignItems: 'center',
    width: 80,
    minHeight: SIZES.minTouchTarget,
  },
  footerIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerIconCircleActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1.5,
    borderColor: COLORS.warning,
  },
  footerActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  singleModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  singleModeBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
