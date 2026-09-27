import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { OcrPilotService, LineBox, normalizeOcrError } from '../../services/api/OcrPilotService';
import { submissionDraftStore } from '../../services/draft/submissionDraftStore';
import { isHandAIMode } from '../../config/appMode';
import { normalizeLocalFileUri } from '../../services/image/imagePipeline';

const SCREEN_WIDTH = Dimensions.get('window').width;

type RequestStatus = 'IDLE' | 'SUBMITTING' | 'SUCCESS' | 'ERROR' | 'CANCELLED';

export default function MultilineReviewScreen() {
  const router = useRouter();
  const isHandAI = isHandAIMode();
  const params = useLocalSearchParams();
  const draft = submissionDraftStore.getDraft();
  const rawImageUri = draft?.croppedImageUri || draft?.uri || (params.uri as string) || '';
  const imageUri = normalizeLocalFileUri(rawImageUri);
  const originalUri = isHandAI
    ? (draft?.originalImageUri || draft?.originalUri || draft?.sourceImageUri || (params.originalImageUri as string) || '')
    : ((params.originalImageUri as string) || draft?.originalImageUri || draft?.originalUri || draft?.sourceImageUri || '');
  const cropInputUri = originalUri;
  const activeRecognitionUri = imageUri;
  const imageSessionId = draft?.imageSessionId || imageUri;

  useEffect(() => {
    console.log(`[IMAGE_FLOW]\noriginalUri=${originalUri}\nprivacyUri=${draft?.privacyImageUri || 'undefined'}\ncropInputUri=${cropInputUri}\nactiveRecognitionUri=${activeRecognitionUri}\n`);
  }, [originalUri, draft?.privacyImageUri, cropInputUri, activeRecognitionUri]);

  const [loading, setLoading] = useState(true);
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('IDLE');
  const [origWidth, setOrigWidth] = useState(draft?.width || 800);
  const [origHeight, setOrigHeight] = useState(draft?.height || 600);
  const [displayHeight, setDisplayHeight] = useState(300);
  const [boxes, setBoxes] = useState<LineBox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [editMode, setEditMode] = useState<'MOVE' | 'RESIZE'>('MOVE');

  const displayWidth = SCREEN_WIDTH - 32;
  const detectRequestIdRef = useRef(0);
  const initialLoadDoneRef = useRef<string | null>(null);
  const operationGenerationRef = useRef(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const hasNavigatedRef = useRef(false);

  // Invalidate any in-flight request and ensure clean state on blur / focus
  useFocusEffect(
    useCallback(() => {
      // On screen focus: ensure fresh IDLE state
      setRequestStatus('IDLE');
      hasNavigatedRef.current = false;
      return () => {
        // On screen blur or navigation away: cancel in-flight request and bump generation
        operationGenerationRef.current += 1;
        activeAbortControllerRef.current?.abort();
        activeAbortControllerRef.current = null;
        setRequestStatus('IDLE');
      };
    }, [])
  );

  const handleBack = () => {
    operationGenerationRef.current += 1;
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    setRequestStatus('IDLE');
    router.back();
  };

  useEffect(() => {
    if (isHandAI) {
      console.log('HAND_AI IMAGE SOURCE: ORIGINAL');
      console.log('HAND_AI IMAGE SOURCE = ORIGINAL', {
        imageUri,
        sourceImageUri: draft?.sourceImageUri,
        croppedImageUri: draft?.croppedImageUri,
        isMasked: draft?.isMasked,
      });
    }
    console.log('[MULTILINE_PAGE_SOURCE] MULTILINE_PAGE_SOURCE=POST_CROP_ACTIVE_URI', {
      uri: imageUri,
      isMasked: draft?.isMasked,
      rawUriPresent: !!draft?.rawUri,
      draftWidth: draft?.width,
      draftHeight: draft?.height,
      timestamp: new Date().toISOString(),
    });
  }, [imageUri, draft?.isMasked, draft?.rawUri, draft?.width, draft?.height, draft?.sourceImageUri, draft?.croppedImageUri, isHandAI]);

  const loadAutoDetection = useCallback(async (uri: string, force: boolean = false) => {
    const currentReqId = ++detectRequestIdRef.current;
    console.log(`[MULTILINE] Starting loadAutoDetection (reqId=${currentReqId})`, {
      uri,
      force,
      timestamp: new Date().toISOString(),
    });
    try {
      setLoading(true);
      setIsNetworkError(false);
      const res = await OcrPilotService.detectLines(uri, true, force);

      // Stale response guard: ignore if a newer request was dispatched
      if (currentReqId !== detectRequestIdRef.current) {
        console.warn(`[MULTILINE] Discarding stale detection response (reqId=${currentReqId}, active=${detectRequestIdRef.current})`);
        return;
      }

      console.log(`[MULTILINE] Detection response received (reqId=${currentReqId})`, {
        width: res.width,
        height: res.height,
        lineCount: res.lines?.length || 0,
        detectorVersion: (res as any).detector_version,
        lines: res.lines?.map(l => ({ id: l.line_id, y: l.y, height: l.height }))
      });

      if (res.width) setOrigWidth(res.width);
      if (res.height) {
        setOrigHeight(res.height);
        const calculatedH = (res.height / res.width) * displayWidth;
        setDisplayHeight(Math.min(calculatedH, 450));
      }

      const incomingLines = res.lines || [];
      console.log(`[LINE_DETECTION_DEBUG]
Detected Lines: ${incomingLines.length}
image dimensions: ${res.width}x${res.height}
crop path: ${uri}
preprocessing result: detectorVersion=${(res as any).detector_version || (res as any).detectorVersion || 'default'}, lines=${incomingLines.length}
server response: status=200, lineCount=${incomingLines.length}
`);

      setBoxes((prev) => {
        // Prevent accidental overwrite of valid boxes with 0 on background retry
        if (!force && prev.length > 0 && incomingLines.length === 0) {
          console.warn('[MULTILINE] Preserving existing boxes; ignoring 0-count response on non-force load');
          return prev;
        }
        return incomingLines;
      });

      if (incomingLines.length > 0) {
        setSelectedId(incomingLines[0].line_id);
      } else if (force) {
        setSelectedId(null);
      }
    } catch (err: any) {
      if (currentReqId !== detectRequestIdRef.current) return;
      console.warn(`[LINE_DETECTION_DEBUG] FAILURE
image dimensions: ${origWidth}x${origHeight}
crop path: ${uri}
preprocessing result: N/A (detection failed)
server response: status=${err?.response?.status || 'No response'}, error=${err?.message || 'unknown'}
`);

      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        if (isHandAI) {
          Alert.alert(
            'Recognition Service Unavailable',
            'The handwriting recognition service is currently unavailable. Would you like to retry?',
            [
              { text: 'Retry', onPress: () => loadAutoDetection(uri, true) },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        } else {
          Alert.alert(
            'Phiên đăng nhập đã hết hạn',
            'Vui lòng đăng nhập lại để tiếp tục.',
            [
              { text: 'Đăng nhập', onPress: () => router.replace('/login') }
            ]
          );
        }
      } else if (!err?.response && (err?.message?.includes('Network Error') || err?.message?.includes('Network request failed') || err?.message?.toLowerCase().includes('failed to fetch'))) {
        setIsNetworkError(true);
        Alert.alert(
          isHandAI ? 'Connection Error' : 'Lỗi kết nối',
          isHandAI ? 'Unable to connect to the recognition server. Please check your network.' : 'Không thể kết nối đến máy chủ nhận diện. Vui lòng kiểm tra lại mạng.'
        );
      } else {
        Alert.alert(
          isHandAI ? 'Detection Warning' : 'Lỗi nhận diện',
          isHandAI ? 'Could not automatically detect text lines. Please retry or add manually.' : 'Không thể tự động phát hiện dòng chữ. Vui lòng thử lại hoặc thêm thủ công.'
        );
      }

      // Empty lines on detection failure only if user explicitly forced refresh or no boxes exist
      setBoxes((prev) => (force ? [] : prev));
      if (force) setSelectedId(null);
    } finally {
      if (currentReqId === detectRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [displayWidth, router, isHandAI]);

  useEffect(() => {
    if (!imageUri) {
      Alert.alert(
        isHandAI ? 'Error' : 'Lỗi',
        isHandAI ? 'Image not found for recognition.' : 'Không tìm thấy ảnh để nhận diện.',
        [
          { text: isHandAI ? 'Back' : 'Quay lại', onPress: () => router.back() },
        ]
      );
      return;
    }

    if (initialLoadDoneRef.current === imageSessionId) return;
    
    // Clear old state before starting new detection on a new image
    if (initialLoadDoneRef.current !== null) {
      setBoxes([]);
      setSelectedId(null);
    }
    
    initialLoadDoneRef.current = imageSessionId;

    // Inspect real image dimensions if not present
    Image.getSize(
      imageUri,
      (w, h) => {
        setOrigWidth(w);
        setOrigHeight(h);
        const calculatedH = (h / w) * displayWidth;
        setDisplayHeight(Math.min(calculatedH, 450));
        loadAutoDetection(imageUri, true);
      },
      () => {
        loadAutoDetection(imageUri, true);
      }
    );
  }, [imageUri, displayWidth, router, loadAutoDetection, imageSessionId]);

  const scaleX = displayWidth / (origWidth || 1);
  const scaleY = displayHeight / (origHeight || 1);

  const selectedBox = boxes.find((b) => b.line_id === selectedId);

  const updateSelectedBox = (updater: (prev: LineBox) => LineBox) => {
    if (!selectedId) return;
    setBoxes((prev) => {
      const next = prev.map((b) => (b.line_id === selectedId ? updater(b) : b));
      // Re-sort top-to-bottom and renumber
      next.sort((a, b) => a.y - b.y);
      return next.map((b, idx) => ({ ...b, order: idx + 1 }));
    });
  };

  const handleMove = (dx: number, dy: number) => {
    updateSelectedBox((b) => {
      const stepX = Math.round(origWidth * 0.02) * dx;
      const stepY = Math.round(origHeight * 0.02) * dy;
      const newX = Math.max(0, Math.min(b.x + stepX, origWidth - b.width));
      const newY = Math.max(0, Math.min(b.y + stepY, origHeight - b.height));
      return { ...b, x: newX, y: newY };
    });
  };

  const handleResize = (dw: number, dh: number) => {
    updateSelectedBox((b) => {
      const stepW = Math.round(origWidth * 0.03) * dw;
      const stepH = Math.round(origHeight * 0.02) * dh;
      const newW = Math.max(30, Math.min(b.width + stepW, origWidth - b.x));
      const newH = Math.max(15, Math.min(b.height + stepH, origHeight - b.y));
      return { ...b, width: newW, height: newH };
    });
  };

  const handleDelete = () => {
    if (!selectedId) return;
    setBoxes((prev) => {
      const remaining = prev.filter((b) => b.line_id !== selectedId);
      remaining.sort((a, b) => a.y - b.y);
      const renumbered = remaining.map((b, idx) => ({ ...b, order: idx + 1 }));
      if (renumbered.length > 0) {
        setSelectedId(renumbered[0].line_id);
      } else {
        setSelectedId(null);
      }
      return renumbered;
    });
  };

  const handleAddLine = () => {
    const newId = `line_${Date.now()}`;
    const defaultW = Math.round(origWidth * 0.85);
    const defaultH = Math.round(origHeight * 0.1);
    const defaultX = Math.round((origWidth - defaultW) / 2);
    const defaultY = Math.round(origHeight * 0.4);

    const newBox: LineBox = {
      line_id: newId,
      x: defaultX,
      y: defaultY,
      width: defaultW,
      height: defaultH,
      order: boxes.length + 1,
    };

    setBoxes((prev) => {
      const combined = [...prev, newBox];
      combined.sort((a, b) => a.y - b.y);
      return combined.map((b, idx) => ({ ...b, order: idx + 1 }));
    });
    setSelectedId(newId);
  };

  const handleConfirmLines = async () => {
    // Double-tap protection
    if (requestStatus === 'SUBMITTING') return;

    if (boxes.length === 0) {
      Alert.alert(
        isHandAI ? 'No Lines Detected' : 'Chưa có dòng nào',
        isHandAI ? 'Please add at least 1 line box before running recognition.' : 'Vui lòng thêm ít nhất 1 dòng chữ trước khi nhận diện.'
      );
      return;
    }

    const currentGen = ++operationGenerationRef.current;
    activeAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    setRequestStatus('SUBMITTING');

    try {
      // Deterministically sort top-to-bottom
      const sorted = [...boxes].sort((a, b) => a.y - b.y);
      const renumbered = sorted.map((b, idx) => ({ ...b, order: idx + 1 }));

      const trial = await OcrPilotService.createMultilineTrial(
        imageUri,
        renumbered,
        (draft?.source as any) || 'CAMERA',
        true,   // Privacy confirmed
        abortController.signal
      );

      // Verify this request is still the active generation (not cancelled/superseded by back/blur)
      if (currentGen !== operationGenerationRef.current) {
        console.log('[MULTILINE] In-flight request was superseded or cancelled; discarding result');
        return;
      }

      setRequestStatus('SUCCESS');

      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        router.push({
          pathname: '/ocr-pilot/multiline-result' as any,
          params: { trialId: trial.trialId },
        });
      }
    } catch (e: any) {
      if (currentGen !== operationGenerationRef.current) {
        return; // Ignore error from superseded / cancelled request
      }
      setRequestStatus('ERROR');
      if (!e?.name?.includes('Abort') && !e?.message?.includes('canceled') && !e?.message?.includes('aborted')) {
        const errInfo = normalizeOcrError(e);
        console.error('[MULTILINE] Submit error details:', errInfo.technical);
        Alert.alert(
          errInfo.title,
          errInfo.message,
          isHandAI
            ? [
                { text: 'Retry', onPress: () => handleConfirmLines() },
                { text: 'Cancel', style: 'cancel' },
              ]
            : [
                { text: 'Đóng', style: 'cancel' },
              ]
        );
      }
    } finally {
      if (currentGen === operationGenerationRef.current) {
        // Always reset to IDLE so the button never stays permanently spinning!
        setRequestStatus('IDLE');
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>
          {isHandAI ? 'Automatically detecting text lines...' : 'Đang tự động phát hiện các dòng chữ...'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Sleek App Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={isHandAI ? 'Back' : 'Quay lại'}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isHandAI ? 'Review Detected Lines' : 'Kiểm tra các dòng chữ'}
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (boxes.length > 0) {
              Alert.alert(
                isHandAI ? 'Re-detect Lines' : 'Phát hiện lại',
                isHandAI
                  ? 'Re-detecting will recalculate line segmentation boxes. Continue?'
                  : 'Phát hiện lại sẽ thay thế các khung hiện tại. Bạn có chắc chắn muốn tiếp tục?',
                [
                  { text: isHandAI ? 'Cancel' : 'Hủy', style: 'cancel' },
                  { text: isHandAI ? 'Confirm' : 'Đồng ý', onPress: () => loadAutoDetection(imageUri, true) }
                ]
              );
            } else {
              loadAutoDetection(imageUri, true);
            }
          }}
          style={styles.resetButton}
          accessibilityRole="button"
          accessibilityLabel={isHandAI ? 'Re-detect lines' : 'Phát hiện lại'}
        >
          <Ionicons name="refresh" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.instruction}>
        {isHandAI
          ? `Detected Lines: ${boxes.length}. Tap a line box on the image to edit.`
          : `Đã tìm thấy ${boxes.length} dòng. Chạm vào một khung để chỉnh lại nếu cần.`}
      </Text>

      {/* Dominant Image Canvas Area */}
      <View style={[styles.imageContainer, SHADOWS.small, { width: displayWidth, height: displayHeight }]}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: displayWidth, height: displayHeight }}
          resizeMode="contain"
          onError={(e) => {
            console.error('[MULTILINE] Image load failed:', e.nativeEvent.error);
          }}
        />

        {boxes.map((box) => {
          const isSelected = box.line_id === selectedId;
          const left = box.x * scaleX;
          const top = box.y * scaleY;
          const w = box.width * scaleX;
          const h = box.height * scaleY;

          return (
            <TouchableOpacity
              key={box.line_id}
              activeOpacity={0.9}
              onPress={() => setSelectedId(box.line_id)}
              style={[
                styles.boxOverlay,
                {
                  left,
                  top,
                  width: Math.max(w, 20),
                  height: Math.max(h, 15),
                  borderColor: isSelected ? '#10B981' : '#3B82F6',
                  backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.22)' : 'rgba(59, 130, 246, 0.15)',
                  borderWidth: isSelected ? 2.5 : 1.5,
                },
              ]}
            >
              <View style={[styles.orderTag, { backgroundColor: isSelected ? '#10B981' : '#3B82F6' }]}>
                <Text style={styles.orderTagText}>{box.order}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Box Editing Controls or Blank State Card */}
      {isNetworkError && boxes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="wifi-outline" size={36} color="#DC2626" style={{ marginBottom: 8 }} />
          <Text style={styles.emptyTitle}>
            {isHandAI ? 'Server Connection Error' : 'Lỗi kết nối máy chủ'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isHandAI
              ? 'Unable to connect to the recognition system. Ensure backend is running and network is active.'
              : 'Không thể kết nối đến hệ thống nhận diện. Hãy đảm bảo máy chủ đang hoạt động và kết nối mạng ổn định.'}
          </Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={[styles.emptyBtn, styles.emptyBtnOutline]}
              onPress={() => loadAutoDetection(imageUri, true)}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={18} color={COLORS.primary} />
              <Text style={[styles.emptyBtnText, { color: COLORS.primary }]}>
                {isHandAI ? 'Retry Connection' : 'Thử kết nối lại'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.emptyBtn, styles.emptyBtnOutline]}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={18} color={COLORS.textSecondary} />
              <Text style={[styles.emptyBtnText, { color: COLORS.textSecondary }]}>
                {isHandAI ? 'Go Back' : 'Quay lại'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : boxes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="alert-circle-outline" size={36} color={COLORS.textSecondary} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyTitle}>
            {isHandAI ? 'No text lines detected' : 'Chưa phát hiện được dòng chữ nào.'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isHandAI
              ? 'No handwriting detected on image, or text is faint/small. You can add lines manually, re-detect, or pick a different image.'
              : 'Không tìm thấy văn bản trên ảnh, hoặc chữ viết quá mờ/nhỏ. Bạn có thể tự thêm dòng, thử phát hiện lại hoặc chụp/chọn ảnh khác.'}
          </Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={handleAddLine}
              accessibilityRole="button"
              accessibilityLabel={isHandAI ? 'Add line manually' : 'Thêm dòng thủ công'}
            >
              <Ionicons name="add-circle" size={18} color="#FFFFFF" />
              <Text style={styles.emptyBtnText}>
                {isHandAI ? 'Add Line Manually' : 'Thêm dòng thủ công'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.emptyBtn, styles.emptyBtnOutline]}
              onPress={() => loadAutoDetection(imageUri, true)}
              accessibilityRole="button"
              accessibilityLabel={isHandAI ? 'Re-detect lines' : 'Phát hiện lại'}
            >
              <Ionicons name="refresh" size={18} color={COLORS.primary} />
              <Text style={[styles.emptyBtnText, { color: COLORS.primary }]}>
                {isHandAI ? 'Re-detect Lines' : 'Phát hiện lại'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.emptyBtn, styles.emptyBtnOutline]}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={isHandAI ? 'Pick another image' : 'Chụp hoặc chọn ảnh khác'}
            >
              <Ionicons name="camera-outline" size={18} color={COLORS.textSecondary} />
              <Text style={[styles.emptyBtnText, { color: COLORS.textSecondary }]}>
                {isHandAI ? 'Pick Another Image' : 'Chụp/chọn ảnh khác'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : selectedBox ? (
        <View style={[styles.controlCard, SHADOWS.small]}>
          {/* Card Header: Selected Line Tag & Delete Button */}
          <View style={styles.controlHeaderRow}>
            <View style={styles.selectedLinePill}>
              <Text style={styles.controlTitle}>
                {isHandAI ? 'Selected Line: ' : 'Dòng đang chọn: '}
                <Text style={{ color: COLORS.primary, fontWeight: '800' }}>
                  {isHandAI ? `Line ${selectedBox.order}` : selectedBox.order}
                </Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel={isHandAI ? 'Delete Line' : 'Xóa dòng'}
            >
              <Ionicons name="trash-outline" size={15} color="#DC2626" />
              <Text style={styles.deleteButtonText}>{isHandAI ? 'Delete Line' : 'Xóa dòng'}</Text>
            </TouchableOpacity>
          </View>

          {/* Gauth-Inspired Segmented Tool Switcher */}
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[styles.segmentBtn, editMode === 'MOVE' && styles.segmentBtnActive]}
              onPress={() => setEditMode('MOVE')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isHandAI ? 'Move mode' : 'Chế độ di chuyển'}
            >
              <Ionicons name="move-outline" size={15} color={editMode === 'MOVE' ? '#1D4ED8' : '#64748B'} />
              <Text style={[styles.segmentBtnText, editMode === 'MOVE' && styles.segmentBtnTextActive]}>
                {isHandAI ? 'Move' : 'Di chuyển'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, editMode === 'RESIZE' && styles.segmentBtnActive]}
              onPress={() => setEditMode('RESIZE')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isHandAI ? 'Resize mode' : 'Chế độ kích thước'}
            >
              <Ionicons name="expand-outline" size={15} color={editMode === 'RESIZE' ? '#1D4ED8' : '#64748B'} />
              <Text style={[styles.segmentBtnText, editMode === 'RESIZE' && styles.segmentBtnTextActive]}>
                {isHandAI ? 'Resize' : 'Kích thước'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tactile Control Buttons */}
          <View style={styles.controlsRow}>
            {editMode === 'MOVE' ? (
              <View style={styles.controlGroup}>
                <Text style={styles.groupLabel}>
                  {isHandAI ? 'Move box position:' : 'Di chuyển vị trí khung:'}
                </Text>
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.ctrlBtn} onPress={() => handleMove(0, -1)} accessibilityLabel={isHandAI ? 'Move up' : 'Di chuyển lên'}>
                    <Ionicons name="arrow-up" size={18} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ctrlBtn} onPress={() => handleMove(0, 1)} accessibilityLabel={isHandAI ? 'Move down' : 'Di chuyển xuống'}>
                    <Ionicons name="arrow-down" size={18} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ctrlBtn} onPress={() => handleMove(-1, 0)} accessibilityLabel={isHandAI ? 'Move left' : 'Di chuyển sang trái'}>
                    <Ionicons name="arrow-back" size={18} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ctrlBtn} onPress={() => handleMove(1, 0)} accessibilityLabel={isHandAI ? 'Move right' : 'Di chuyển sang phải'}>
                    <Ionicons name="arrow-forward" size={18} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.controlGroup}>
                <Text style={styles.groupLabel}>
                  {isHandAI ? 'Resize line box:' : 'Kích thước khung chữ:'}
                </Text>
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.resizeBtn} onPress={() => handleResize(-1, 0)} accessibilityLabel={isHandAI ? 'Reduce width' : 'Giảm chiều rộng'}>
                    <Text style={styles.resizeBtnText}>{isHandAI ? '− Width' : '− Rộng'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.resizeBtn} onPress={() => handleResize(1, 0)} accessibilityLabel={isHandAI ? 'Increase width' : 'Tăng chiều rộng'}>
                    <Text style={styles.resizeBtnText}>{isHandAI ? '+ Width' : '+ Rộng'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.resizeBtn} onPress={() => handleResize(0, -1)} accessibilityLabel={isHandAI ? 'Reduce height' : 'Giảm chiều cao'}>
                    <Text style={styles.resizeBtnText}>{isHandAI ? '− Height' : '− Cao'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.resizeBtn} onPress={() => handleResize(0, 1)} accessibilityLabel={isHandAI ? 'Increase height' : 'Tăng chiều cao'}>
                    <Text style={styles.resizeBtnText}>{isHandAI ? '+ Height' : '+ Cao'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.noSelectCard}>
          <Ionicons name="hand-left-outline" size={20} color="#94A3B8" style={{ marginBottom: 4 }} />
          <Text style={styles.noSelectText}>
            {isHandAI ? 'Tap a line box on the image to edit.' : 'Chạm vào một khung chữ trên ảnh để chỉnh sửa.'}
          </Text>
        </View>
      )}

      {/* Confident Bottom Action Bar */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleAddLine}
          accessibilityRole="button"
          accessibilityLabel={isHandAI ? 'Add Line' : 'Thêm dòng'}
        >
          <Ionicons name="add-circle-outline" size={19} color={COLORS.primary} />
          <Text style={styles.secondaryBtnText}>{isHandAI ? 'Add Line' : 'Thêm dòng'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, (requestStatus === 'SUBMITTING' || boxes.length === 0) && { opacity: 0.5 }]}
          onPress={handleConfirmLines}
          disabled={requestStatus === 'SUBMITTING' || boxes.length === 0}
          accessibilityRole="button"
          accessibilityLabel={isHandAI ? 'Run Recognition' : 'Nhận diện chữ'}
        >
          {requestStatus === 'SUBMITTING' ? (
            <View style={styles.ctaLoadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>
                {isHandAI ? 'Running recognition...' : 'Đang xử lý...'}
              </Text>
            </View>
          ) : (
            <View style={styles.ctaColumn}>
              <View style={styles.ctaTextRow}>
                <Text style={styles.primaryBtnText}>
                  {isHandAI ? 'Run Recognition' : 'Nhận diện chữ'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.ctaSupportText}>
                {isHandAI
                  ? `${boxes.length} lines ready for recognition`
                  : `${boxes.length} dòng đã sẵn sàng`}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: SIZES.medium,
    paddingTop: 52,
    paddingBottom: 40,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  instruction: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  imageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    alignSelf: 'center',
    marginBottom: 16,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  boxOverlay: {
    position: 'absolute',
    borderRadius: 6,
  },
  orderTag: {
    position: 'absolute',
    top: -10,
    left: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  /* Control Card */
  controlCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  controlHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedLinePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  controlTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },

  /* Segmented Tool Switcher */
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.small,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },

  controlsRow: {
    flexDirection: 'row',
  },
  controlGroup: {
    flex: 1,
  },
  groupLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ctrlBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resizeBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resizeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  btnSub: {
    fontSize: 8,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginTop: -2,
  },
  noSelectCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginBottom: 16,
  },
  noSelectText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  /* Action Row */
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  primaryBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    ...SHADOWS.small,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  emptyActions: {
    width: '100%',
    gap: 10,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnOutline: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  emptyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ctaLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaColumn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaSupportText: {
    fontSize: 11,
    color: '#BFDBFE',
    fontWeight: '500',
    marginTop: 1,
  },
});

