/* eslint-disable react-hooks/immutability, react-hooks/purity, react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { AppHeader } from '../components/ui/AppHeader';
import { AppButton } from '../components/ui/AppButton';
import { Ionicons } from '@expo/vector-icons';
import { submissionDraftStore, resolveFlowDomain, logFlowDomain } from '../services/draft/submissionDraftStore';
import { ensureFileUri, logStageDiagnostic } from '../services/image/imagePipeline';
import { isHandAIMode } from '../config/appMode';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  calculateMaskMove,
  calculateMaskResizeBR,
  calculateMaskDraw,
  isPointInsideMask,
  isPointInsideResizeHandle,
  MIN_MASK_SIZE,
  MaskRect,
} from '../utils/privacyGeometry';

interface Mask {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function PrivacyGateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ uri?: string; retrySubmissionId?: string }>();
  const draft = submissionDraftStore.getDraft();

  const rawUri = draft?.sourceImageUri || draft?.uri || (Array.isArray(params.uri) ? params.uri[0] : params.uri);
  const activeUri = rawUri ? ensureFileUri(rawUri) : '';
  const retrySubmissionId = draft?.retrySubmissionId || (Array.isArray(params.retrySubmissionId) ? params.retrySubmissionId[0] : params.retrySubmissionId);

  const [masks, setMasks] = useState<Mask[]>([]);
  const [selectedMaskId, setSelectedMaskId] = useState<number | null>(null);
  const [movingMaskId, setMovingMaskId] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const viewShotRef = useRef<any>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const getFittedStyle = () => {
    if (!containerSize.width || !containerSize.height || !draft?.width || !draft?.height) {
      return { width: '100%', height: '100%' } as any;
    }
    const containerRatio = containerSize.width / containerSize.height;
    const imageRatio = draft.width / draft.height;
    if (imageRatio > containerRatio) {
      return { width: containerSize.width, height: containerSize.width / imageRatio };
    }
    return { width: containerSize.height * imageRatio, height: containerSize.height };
  };
  const fittedStyle = getFittedStyle();

  const effectiveMode = resolveFlowDomain(null, draft?.mode);

  useEffect(() => {
    if (isHandAIMode()) {
      console.log('[HAND_AI DEBUG] Privacy screen bypassed completely. Redirecting to /crop');
      const origUri = draft?.sourceImageUri || draft?.rawUri || activeUri;
      submissionDraftStore.updateDraft({
        privacyImageUri: undefined,
        isMasked: false,
        sourceImageUri: origUri,
        uri: origUri,
        mode: 'HANDWRITING_TEXT',
      });
      router.replace({ pathname: '/crop' as any, params: { retrySubmissionId, uri: origUri } });
      return;
    }
    logFlowDomain('PRIVACY', effectiveMode);
    if (activeUri) {
      logStageDiagnostic('PRIVACY_INPUT', {
        uri: activeUri,
        width: draft?.width,
        height: draft?.height,
        mimeType: draft?.mimeType,
        source: draft?.source,
        extra: `mode=${effectiveMode}`,
      });
    }
  }, [activeUri, draft?.width, draft?.height, draft?.mimeType, draft?.source, effectiveMode]);

  if (isHandAIMode()) {
    return null; // HAND_AI must NEVER mount privacy screen or render ViewShot
  }

  // =========================================================================
  // Reanimated Shared Values for Native UI-Thread Worklet Gesture Recognition
  // =========================================================================
  const containerW = useSharedValue(0);
  const containerH = useSharedValue(0);

  useEffect(() => {
    const w = typeof fittedStyle.width === 'number' ? fittedStyle.width : containerSize.width;
    const h = typeof fittedStyle.height === 'number' ? fittedStyle.height : containerSize.height;
    containerW.value = w;
    containerH.value = h;
  }, [fittedStyle.width, fittedStyle.height, containerSize.width, containerSize.height]);

  const allMasksShared = useSharedValue<Mask[]>([]);
  useEffect(() => {
    allMasksShared.value = masks;
  }, [masks]);

  // Gesture action mode: 0 = NONE, 1 = MOVE, 2 = RESIZE, 3 = DRAW
  const gestureAction = useSharedValue(0);
  const activeMaskId = useSharedValue<number | null>(null);

  // Active mask rectangle values (driven by worklets at native 60-120Hz for MOVE / RESIZE)
  const activeX = useSharedValue(0);
  const activeY = useSharedValue(0);
  const activeW = useSharedValue(0);
  const activeH = useSharedValue(0);
  const activeOpacity = useSharedValue(0);

  // Dedicated draft mask rectangle values for drawing new masks (100% independent from selection)
  const draftX = useSharedValue(0);
  const draftY = useSharedValue(0);
  const draftW = useSharedValue(0);
  const draftH = useSharedValue(0);
  const draftOpacity = useSharedValue(0);

  // Initial anchors on gesture start
  const initBoxX = useSharedValue(0);
  const initBoxY = useSharedValue(0);
  const initBoxW = useSharedValue(0);
  const initBoxH = useSharedValue(0);

  // Synchronize Reanimated shared values when user selects mask from React UI buttons
  useEffect(() => {
    // Never disrupt an ongoing UI-thread gesture (DRAW, MOVE, RESIZE)
    if (gestureAction.value !== 0) return;

    if (selectedMaskId !== null) {
      const found = masks.find(m => m.id === selectedMaskId);
      if (found) {
        activeMaskId.value = found.id;
        activeX.value = found.x;
        activeY.value = found.y;
        activeW.value = found.width;
        activeH.value = found.height;
        activeOpacity.value = 1;
      }
    } else {
      activeMaskId.value = null;
      activeOpacity.value = 0;
    }
  }, [selectedMaskId, masks]);

  // =========================================================================
  // JS-Thread Commit Callbacks — Executed ONLY via runOnJS on Gesture End
  // (Zero React setState during per-frame movement)
  // =========================================================================
  const commitMaskUpdate = (targetId: number, rect: MaskRect) => {
    setMasks(prev =>
      prev.map(m => (m.id === targetId ? { ...m, ...rect } : m))
    );
  };

  const commitNewMask = (rect: MaskRect) => {
    const newId = Date.now();
    setMasks(prev => [...prev, { id: newId, ...rect }]);
    setSelectedMaskId(newId);
  };

  const commitSelectMask = (id: number) => {
    setSelectedMaskId(id);
  };

  const commitDeselect = () => {
    setSelectedMaskId(null);
  };

  // =========================================================================
  // UI-Thread Worklet Gesture Pipeline via react-native-gesture-handler
  // =========================================================================
  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onStart((e) => {
      'worklet';
      const touchX = e.x;
      const touchY = e.y;
      const cW = containerW.value;
      const cH = containerH.value;

      // 1. Check if touch hit the active selected mask's resize handle (bottom-right 40px zone)
      const currentActiveId = activeMaskId.value;
      if (currentActiveId !== null && activeOpacity.value > 0) {
        const bX = activeX.value;
        const bY = activeY.value;
        const bW = activeW.value;
        const bH = activeH.value;

        if (
          isPointInsideResizeHandle(touchX, touchY, { x: bX, y: bY, width: bW, height: bH }, 40)
        ) {
          gestureAction.value = 2; // RESIZE
          initBoxX.value = bX;
          initBoxY.value = bY;
          initBoxW.value = bW;
          initBoxH.value = bH;
          runOnJS(setMovingMaskId)(currentActiveId);
          return;
        }
      }

      // 2. Check if touch hit any mask (top-to-bottom search in allMasksShared)
      const list = allMasksShared.value;
      let hitMask: Mask | null = null;
      for (let i = list.length - 1; i >= 0; i--) {
        const m = list[i];
        if (isPointInsideMask(touchX, touchY, m)) {
          hitMask = m;
          break;
        }
      }

      if (hitMask !== null) {
        gestureAction.value = 1; // MOVE
        activeMaskId.value = hitMask.id;

        initBoxX.value = hitMask.x;
        initBoxY.value = hitMask.y;
        initBoxW.value = hitMask.width;
        initBoxH.value = hitMask.height;

        activeX.value = hitMask.x;
        activeY.value = hitMask.y;
        activeW.value = hitMask.width;
        activeH.value = hitMask.height;
        activeOpacity.value = 1;

        runOnJS(setMovingMaskId)(hitMask.id);
        runOnJS(commitSelectMask)(hitMask.id);
      } else {
        // 3. Touch landed on empty canvas: initiate DRAW with dedicated draft values
        gestureAction.value = 3; // DRAW
        activeMaskId.value = null;
        activeOpacity.value = 0;

        const clampedX = Math.max(0, Math.min(touchX, cW));
        const clampedY = Math.max(0, Math.min(touchY, cH));

        initBoxX.value = clampedX;
        initBoxY.value = clampedY;
        initBoxW.value = 0;
        initBoxH.value = 0;

        draftX.value = clampedX;
        draftY.value = clampedY;
        draftW.value = 0;
        draftH.value = 0;
        draftOpacity.value = 1;

        runOnJS(setMovingMaskId)(null);
        runOnJS(commitDeselect)();
      }
    })
    .onUpdate((e) => {
      'worklet';
      const act = gestureAction.value;
      if (act === 0) return;

      const cW = containerW.value;
      const cH = containerH.value;

      if (act === 1) {
        // MOVE: strictly clamped to container boundaries
        const next = calculateMaskMove(
          initBoxX.value,
          initBoxY.value,
          initBoxW.value,
          initBoxH.value,
          e.translationX,
          e.translationY,
          cW,
          cH
        );
        activeX.value = next.x;
        activeY.value = next.y;
      } else if (act === 2) {
        // RESIZE: strictly clamped to container boundaries, minimum 28px, non-inverting
        const next = calculateMaskResizeBR(
          initBoxW.value,
          initBoxH.value,
          e.translationX,
          e.translationY,
          initBoxX.value,
          initBoxY.value,
          cW,
          cH,
          MIN_MASK_SIZE
        );
        activeW.value = next.width;
        activeH.value = next.height;
      } else if (act === 3) {
        // DRAW: strictly clamped to container boundaries via dedicated draft values
        const next = calculateMaskDraw(
          initBoxX.value,
          initBoxY.value,
          initBoxX.value + e.translationX,
          initBoxY.value + e.translationY,
          cW,
          cH
        );
        draftX.value = next.x;
        draftY.value = next.y;
        draftW.value = next.width;
        draftH.value = next.height;
        draftOpacity.value = 1;
      }
    })
    .onEnd(() => {
      'worklet';
      const act = gestureAction.value;

      if (act === 1 || act === 2) {
        // MOVE or RESIZE: Commit final coordinates once
        const targetId = activeMaskId.value;
        if (targetId !== null) {
          const finalRect: MaskRect = {
            x: activeX.value,
            y: activeY.value,
            width: activeW.value,
            height: activeH.value,
          };
          runOnJS(commitMaskUpdate)(targetId, finalRect);
        }
      } else if (act === 3) {
        // DRAW: Only commit if rectangle is at least 24x24; otherwise discard as empty tap
        const finalW = draftW.value;
        const finalH = draftH.value;
        if (finalW >= 24 && finalH >= 24) {
          const finalRect: MaskRect = {
            x: draftX.value,
            y: draftY.value,
            width: finalW,
            height: finalH,
          };
          runOnJS(commitNewMask)(finalRect);
        } else {
          // Discard tiny accidental touch and deselect
          runOnJS(commitDeselect)();
        }
        draftOpacity.value = 0;
        draftW.value = 0;
        draftH.value = 0;
      }

      runOnJS(setMovingMaskId)(null);
      gestureAction.value = 0;
    })
    .onFinalize((success) => {
      'worklet';
      runOnJS(setMovingMaskId)(null);
      draftOpacity.value = 0;
      if (!success && gestureAction.value !== 0) {
        activeOpacity.value = 0;
        gestureAction.value = 0;
        activeMaskId.value = null;
        runOnJS(commitDeselect)();
      }
    });

  const animatedActiveStyle = useAnimatedStyle(() => {
    return {
      opacity: activeOpacity.value,
      left: activeX.value,
      top: activeY.value,
      width: activeW.value,
      height: activeH.value,
      position: 'absolute',
      backgroundColor: '#000000',
      borderRadius: 4,
      borderWidth: 2,
      borderColor: '#F59E0B',
      zIndex: 99,
    };
  });

  const animatedDraftStyle = useAnimatedStyle(() => {
    return {
      opacity: draftOpacity.value,
      left: draftX.value,
      top: draftY.value,
      width: draftW.value,
      height: draftH.value,
      position: 'absolute',
      backgroundColor: '#000000',
      borderRadius: 4,
      borderWidth: 2,
      borderColor: '#F59E0B',
      zIndex: 100,
    };
  });

  const undoLastMask = () => {
    setMasks(prev => prev.slice(0, -1));
    setSelectedMaskId(null);
  };

  const clearAllMasks = () => {
    setMasks([]);
    setSelectedMaskId(null);
  };

  const handleDone = async () => {
    if (!confirmed) return;

    setSelectedMaskId(null);
    activeOpacity.value = 0;
    activeMaskId.value = null;

    try {
      const postPrivacyMode = resolveFlowDomain(null, draft?.mode);
      logFlowDomain('POST_PRIVACY', postPrivacyMode);

      // If no masks were drawn, do NOT rasterize via ViewShot!
      if (masks.length === 0) {
        submissionDraftStore.updateDraft({ privacyImageUri: activeUri, isMasked: false, mode: postPrivacyMode });
        logStageDiagnostic('PRIVACY_OUTPUT', {
          uri: activeUri,
          width: draft?.width,
          height: draft?.height,
          mimeType: draft?.mimeType || 'image/jpeg',
          source: draft?.source,
          extra: `zero-mask bypass mode=${postPrivacyMode}`,
        });
        router.push({
          pathname: '/crop' as any,
          params: { retrySubmissionId },
        });
        return;
      }

      await new Promise(r => setTimeout(r, 120));

      if (viewShotRef.current && viewShotRef.current.capture) {
        const captured = await viewShotRef.current.capture();
        const finalMaskedUri = ensureFileUri(captured);

        let outputWidth = draft?.width || 0;
        let outputHeight = draft?.height || 0;
        try {
          const manip = await ImageManipulator.manipulateAsync(finalMaskedUri, [], {});
          if (manip.width > 0 && manip.height > 0) {
            outputWidth = manip.width;
            outputHeight = manip.height;
          }
        } catch (inspectErr) {
          console.warn('[PRIVACY] Could not inspect ViewShot dimensions:', inspectErr);
        }

        submissionDraftStore.updateDraft({
          privacyImageUri: finalMaskedUri,
          uri: finalMaskedUri,
          width: outputWidth,
          height: outputHeight,
          masks,
          isMasked: true,
          mode: postPrivacyMode,
        });

        logStageDiagnostic('PRIVACY_OUTPUT', {
          uri: finalMaskedUri,
          width: outputWidth,
          height: outputHeight,
          mimeType: 'image/jpeg',
          source: draft?.source,
          extra: `masked count=${masks.length} mode=${postPrivacyMode}`,
        });

        router.push({
          pathname: '/crop' as any,
          params: { retrySubmissionId },
        });
      }
    } catch (e) {
      console.error('[PRIVACY] Rasterization error:', e);
      Alert.alert('Lỗi', 'Không thể lưu ảnh đã che.');
    }
  };

  if (isHandAIMode()) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!activeUri) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Chưa có ảnh bài tập</Text>
        <AppButton title="Quay lại" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <AppHeader title="Bảo vệ thông tin riêng tư" showBack />

        {/* Child-friendly explanation */}
        <View style={styles.instructionCard}>
          <View style={styles.instructionHeader}>
            <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
            <Text style={styles.instructionTitle}>Giữ an toàn cho em</Text>
          </View>
          <Text style={styles.instructionText}>
            Dùng ngón tay vẽ hộp đen che tên của em, tên trường hoặc khuôn mặt nếu có trong ảnh trước khi gửi bài nhé.
          </Text>
        </View>

        {/* Micro-UX hint bar */}
        <View style={styles.hintBar}>
          <Ionicons name="information-circle-outline" size={15} color="#94A3B8" />
          <Text style={styles.hintText}>
            Chạm để chọn • Kéo để di chuyển • Kéo góc dưới phải để đổi cỡ
          </Text>
        </View>

        {/* Interactive Mask Canvas */}
        <View 
          style={styles.imageContainer}
          onLayout={(e) => setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'jpg', quality: 0.95 }}
              style={fittedStyle}
            >
              <GestureDetector gesture={panGesture}>
                <View
                  style={styles.imageWrapper}
                  collapsable={false}
                >
                  <Image
                    source={{ uri: activeUri }}
                    style={styles.image}
                    resizeMode="contain"
                    onLoadStart={() => {
                      setImageLoaded(false);
                      setImageLoadError(false);
                    }}
                    onLoad={() => {
                      setImageLoaded(true);
                      setImageLoadError(false);
                    }}
                    onError={(e) => {
                      console.error('[PRIVACY] Image render failed:', e.nativeEvent.error);
                      setImageLoadError(true);
                    }}
                  />

                  {!imageLoaded && !imageLoadError && (
                    <View style={styles.loadingOverlay} pointerEvents="none">
                      <ActivityIndicator size="large" color={COLORS.primary} />
                      <Text style={styles.loadingText}>Đang tải ảnh bài tập...</Text>
                    </View>
                  )}

                  {imageLoadError && (
                    <View style={styles.errorOverlay}>
                      <Ionicons name="alert-circle" size={40} color={COLORS.error} />
                      <Text style={styles.errorTitle}>Không thể hiển thị ảnh</Text>
                      <Text style={styles.errorSub}>Vui lòng chụp lại hoặc chọn ảnh khác từ thư viện.</Text>
                      <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
                        <Text style={styles.retryButtonText}>Quay lại chụp ảnh</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Committed Masks: ALWAYS rendered as persistent visible blocks; only the actively moved mask is hidden during MOVE/RESIZE */}
                  {masks.map(mask => {
                    const isSelected = mask.id === selectedMaskId;
                    const isMoving = mask.id === movingMaskId;
                    return (
                      <View
                        key={mask.id}
                        pointerEvents="none"
                        style={[
                          styles.maskBlock,
                          {
                            left: mask.x,
                            top: mask.y,
                            width: mask.width,
                            height: mask.height,
                            borderWidth: isSelected ? 2 : 0,
                            borderColor: '#F59E0B',
                            opacity: isMoving ? 0 : 1,
                          },
                        ]}
                      >
                        {isSelected && movingMaskId === null && (
                          <View style={styles.resizeHandleBadge}>
                            <View style={styles.resizeHandleDot} />
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* Live Reanimated Active Mask Overlay (runs at 60-120Hz on UI thread worklets for MOVE / RESIZE) */}
                  <Animated.View
                    pointerEvents="none"
                    style={animatedActiveStyle}
                  >
                    <View style={styles.resizeHandleBadge}>
                      <View style={styles.resizeHandleDot} />
                    </View>
                  </Animated.View>

                  {/* Dedicated Live Draft Mask Overlay for active DRAW gesture (100% visible on region 1, 2, 3, 4+) */}
                  <Animated.View
                    pointerEvents="none"
                    style={animatedDraftStyle}
                  />
                </View>
              </GestureDetector>
            </ViewShot>

            {/* Floating Mask Control Buttons */}
            <View style={styles.floatingControls}>
              {selectedMaskId && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    setMasks(prev => prev.filter(m => m.id !== selectedMaskId));
                    setSelectedMaskId(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Xóa vùng che đang chọn"
                >
                  <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.floatingButtonText}>Xóa vùng này</Text>
                </TouchableOpacity>
              )}

              {masks.length > 0 && (
                <View style={styles.rightControlsRow}>
                  <TouchableOpacity
                    style={styles.resetButton}
                    onPress={clearAllMasks}
                    accessibilityRole="button"
                    accessibilityLabel="Xóa tất cả vùng che"
                  >
                    <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.floatingButtonText}>Xóa tất cả</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.undoButton}
                    onPress={undoLastMask}
                    accessibilityRole="button"
                    accessibilityLabel="Hoàn tác vùng che vừa vẽ"
                  >
                    <Ionicons name="arrow-undo-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.floatingButtonText}>Hoàn tác</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Footer Confirmation & Actions */}
        <View style={[styles.footer, SHADOWS.medium]}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setConfirmed(!confirmed)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmed }}
            accessibilityLabel="Tôi đã kiểm tra và che thông tin riêng tư trong ảnh"
          >
            <Ionicons
              name={confirmed ? 'checkbox' : 'square-outline'}
              size={26}
              color={confirmed ? COLORS.primary : COLORS.textSecondary}
            />
            <Text style={styles.checkboxText}>
              Em đã kiểm tra và che hết thông tin riêng tư trong ảnh.
            </Text>
          </TouchableOpacity>

          <AppButton
            title="Tiếp tục xem lại"
            onPress={handleDone}
            disabled={!confirmed || imageLoadError}
            variant="primary"
          />
          <View style={{ height: SIZES.small }} />
          <AppButton
            title="Chụp lại ảnh khác"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.large,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SIZES.large,
  },
  instructionCard: {
    paddingHorizontal: SIZES.medium,
    paddingVertical: SIZES.small,
    backgroundColor: COLORS.surfaceSubdued,
    borderBottomWidth: 1,
    borderColor: '#BFDBFE',
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  instructionTitle: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  instructionText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  hintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#1E293B',
  },
  hintText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 6,
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
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.large,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  errorSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: SIZES.large,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.large,
    paddingVertical: 10,
    borderRadius: SIZES.buttonRadius,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  maskBlock: {
    position: 'absolute',
    backgroundColor: '#000000',
    borderRadius: 4,
  },
  resizeHandleBadge: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  resizeHandleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  floatingControls: {
    position: 'absolute',
    bottom: SIZES.medium,
    left: SIZES.medium,
    right: SIZES.medium,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  rightControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(71, 85, 105, 0.88)',
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  floatingButtonText: {
    color: '#FFFFFF',
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    padding: SIZES.large,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    marginBottom: SIZES.medium,
    paddingRight: SIZES.small,
  },
  checkboxText: {
    marginLeft: SIZES.small,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flexShrink: 1,
    lineHeight: 20,
  },
});
