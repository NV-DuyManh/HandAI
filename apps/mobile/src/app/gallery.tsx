import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import type * as MediaLibraryTypes from 'expo-media-library/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, SHADOWS } from '../constants/theme';
import { submissionDraftStore, resolveFlowDomain, logFlowDomain } from '../services/draft/submissionDraftStore';
import { normalizeImageDraft, logStageDiagnostic } from '../services/image/imagePipeline';
import { isHandAIMode } from '../config/appMode';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 12;
const GRID_GAP = 8;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const PAGE_SIZE = 30;

// Safe Lazy MediaLibrary loader — prevents fatal import-time crashes in Expo Go
interface MediaLibraryModuleLike {
  getPermissionsAsync: (writeOnly?: boolean, granular?: any) => Promise<any>;
  requestPermissionsAsync: (writeOnly?: boolean, granular?: any) => Promise<any>;
  getAssetsAsync: (options: any) => Promise<any>;
  getAssetInfoAsync?: (id: string) => Promise<any>;
}

function getMediaLibrary(): MediaLibraryModuleLike | null {
  try {
    // Lazy require prevents top-level native module evaluation crashes in Expo Go
    // where Android MediaStore access is restricted by Google Play policy
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-media-library/legacy');
  } catch (error) {
    console.warn('[CustomGallery] expo-media-library native module unavailable:', error);
    return null;
  }
}

interface GalleryItemProps {
  item: MediaLibraryTypes.Asset;
  isSelected: boolean;
  onSelect: (asset: MediaLibraryTypes.Asset) => void;
}

// Memoized grid cell to prevent re-rendering all items on selection change (vercel-react-best-practices)
const GalleryGridItem = React.memo(
  function GalleryGridItem({ item, isSelected, onSelect }: GalleryItemProps) {
    const formattedDate = item.creationTime
      ? new Date(item.creationTime).toLocaleDateString('vi-VN')
      : item.id;

    return (
      <TouchableOpacity
        testID={`gallery-cell-${item.id}`}
        style={[
          styles.gridCell,
          isSelected && styles.gridCellSelected,
        ]}
        onPress={() => onSelect(item)}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel={`Ảnh ngày ${formattedDate} (${item.filename})`}
        accessibilityState={{ selected: isSelected }}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.cellImage}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />

        {/* Selected Overlay & Badge */}
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <View style={styles.selectedCheckBadge}>
              <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" />
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  },
  (prev, next) => prev.item.id === next.item.id && prev.isSelected === next.isSelected
);
GalleryGridItem.displayName = 'GalleryGridItem';

export default function CustomGalleryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [permissionResponse, setPermissionResponse] = useState<MediaLibraryTypes.PermissionResponse | null>(null);
  const [isNativeUnavailable, setIsNativeUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [assets, setAssets] = useState<MediaLibraryTypes.Asset[]>([]);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaLibraryTypes.Asset | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Initial Permission Request and First Page Load
  useEffect(() => {
    let isMounted = true;
    const loadInitialAssets = async () => {
      try {
        const ml = getMediaLibrary();
        if (!ml || typeof ml.getPermissionsAsync !== 'function') {
          if (!isMounted) return;
          setIsNativeUnavailable(true);
          setLoading(false);
          return;
        }

        let perm: any = null;
        try {
          perm = await ml.getPermissionsAsync();
          if (!perm.granted && perm.canAskAgain) {
            perm = await ml.requestPermissionsAsync();
          }
        } catch {
          console.log('[CustomGallery] Native gallery unavailable, falling back silently');
          if (!isMounted) return;
          setIsNativeUnavailable(true);
          setLoading(false);
          return;
        }

        if (!isMounted) return;
        setPermissionResponse(perm);

        if (perm?.granted) {
          try {
            const page = await ml.getAssetsAsync({
              first: PAGE_SIZE,
              mediaType: ['photo'],
              sortBy: ['creationTime'],
            });
            if (!isMounted) return;
            setAssets(page?.assets || []);
            setEndCursor(page?.endCursor);
            setHasNextPage(Boolean(page?.hasNextPage));
          } catch (fetchErr) {
            console.warn('[CustomGallery] getAssetsAsync threw in this environment:', fetchErr);
            if (!isMounted) return;
            setIsNativeUnavailable(true);
          }
        }
      } catch (error: any) {
        console.warn('[CustomGallery] Init error:', error?.message);
        if (isMounted) {
          setIsNativeUnavailable(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialAssets();
    return () => {
      isMounted = false;
    };
  }, []);

  // Pagination: Load more assets incrementally
  const handleLoadMore = useCallback(async () => {
    if (!hasNextPage || loadingMore || loading || !endCursor) return;

    const ml = getMediaLibrary();
    if (!ml || typeof ml.getAssetsAsync !== 'function') return;

    setLoadingMore(true);
    try {
      const nextPage = await ml.getAssetsAsync({
        first: PAGE_SIZE,
        after: endCursor,
        mediaType: ['photo'],
        sortBy: ['creationTime'],
      });

      if (nextPage?.assets && nextPage.assets.length > 0) {
        setAssets((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const uniqueNew = nextPage.assets.filter((a: any) => !existingIds.has(a.id));
          return [...prev, ...uniqueNew];
        });
      }
      setEndCursor(nextPage?.endCursor);
      setHasNextPage(Boolean(nextPage?.hasNextPage));
    } catch (error: any) {
      console.warn('[CustomGallery] Load more error:', error?.message);
    } finally {
      setLoadingMore(false);
    }
  }, [hasNextPage, loadingMore, loading, endCursor]);

  // Selection toggle
  const handleSelectAsset = useCallback((asset: MediaLibraryTypes.Asset) => {
    setSelectedAsset((prev) => (prev?.id === asset.id ? null : asset));
  }, []);

  // Confirm selection and normalize into submission draft
  const handleConfirmSelection = async () => {
    if (!selectedAsset) return;

    setIsConfirming(true);
    try {
      let finalUri = selectedAsset.uri;

      // Resolve native content/asset URI to a usable local path when possible
      if (Platform.OS !== 'web') {
        try {
          const ml = getMediaLibrary();
          if (ml && typeof ml.getAssetInfoAsync === 'function') {
            const info = await ml.getAssetInfoAsync(selectedAsset.id);
            if (info && info.localUri) {
              finalUri = info.localUri;
            }
          }
        } catch {
          // Keep asset.uri if getAssetInfoAsync fails
        }
      }

      logStageDiagnostic('ACQUIRE_GALLERY', {
        uri: finalUri,
        width: selectedAsset.width,
        height: selectedAsset.height,
        source: 'CUSTOM_GALLERY',
      });

      const draft = await normalizeImageDraft(
        finalUri,
        selectedAsset.width,
        selectedAsset.height,
        'GALLERY'
      );
      draft.mode = resolveFlowDomain(null, null); // Defaults to HANDWRITING_TEXT
      logFlowDomain('ACQUIRE', draft.mode);
      draft.originalImageUri = finalUri;
      draft.originalUri = finalUri;
      draft.sourceImageUri = finalUri;
      draft.rawUri = finalUri;
      draft.uri = finalUri;
      if (isHandAIMode()) {
        submissionDraftStore.clearDraft();
        draft.privacyImageUri = undefined;
        draft.isMasked = false;
      }
      submissionDraftStore.setDraft(draft);

      const nextTarget = isHandAIMode() ? '/crop' : '/privacy';
      router.push({
        pathname: nextTarget as any,
        params: isHandAIMode()
          ? { uri: finalUri }
          : { uri: draft.uri },
      });
    } catch {
      Alert.alert(
        'Không thể mở ảnh',
        'Đã xảy ra lỗi khi xử lý ảnh đã chọn. Em hãy thử chọn lại hoặc chọn ảnh khác nhé.'
      );
    } finally {
      setIsConfirming(false);
    }
  };

  // OS System Picker Fallback (FALLBACK ONLY — for permission/edge cases)
  const handleFallbackSystemPicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        logStageDiagnostic('ACQUIRE_GALLERY', {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType,
          source: 'GALLERY_SYSTEM_FALLBACK',
        });

        const draft = await normalizeImageDraft(asset.uri, asset.width, asset.height, 'GALLERY');
        draft.mode = resolveFlowDomain(null, null);
        logFlowDomain('ACQUIRE', draft.mode);
        draft.originalImageUri = asset.uri;
        draft.originalUri = asset.uri;
        draft.sourceImageUri = asset.uri;
        draft.rawUri = asset.uri;
        draft.uri = asset.uri;
        if (isHandAIMode()) {
          submissionDraftStore.clearDraft();
          draft.privacyImageUri = undefined;
          draft.isMasked = false;
        }
        submissionDraftStore.setDraft(draft);

        const nextTarget = isHandAIMode() ? '/crop' : '/privacy';
        router.push({
          pathname: nextTarget as any,
          params: {
            uri: isHandAIMode() ? asset.uri : draft.uri,
            originalImageUri: asset.uri,
          },
        });
      }
    } catch (e: any) {
      console.warn('[CustomGallery] System picker fallback failed:', e?.message);
    }
  };

  const isPermissionDenied = isNativeUnavailable || (permissionResponse !== null && !permissionResponse.granted);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Ảnh gần đây</Text>
          <Text style={styles.headerSubtitle}>Chọn ảnh bài tập từ thư viện</Text>
        </View>

        <View style={styles.headerActionPlaceholder} />
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải ảnh từ thư viện...</Text>
        </View>
      ) : isPermissionDenied ? (
        /* Permission Denied or Expo Go Restriction State */
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconCircle}>
            <Ionicons name="images-outline" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.permissionTitle}>
            {isNativeUnavailable ? 'Bộ chọn ảnh MathVision' : 'Cần quyền truy cập ảnh'}
          </Text>
          <Text style={styles.permissionDesc}>
            {isNativeUnavailable
              ? 'Trên ứng dụng Expo Go Android, MathVision sử dụng bộ chọn ảnh hệ thống để em chọn ảnh bài tập nhanh và an toàn.'
              : 'MathVision cần quyền xem thư viện để em có thể chọn ảnh bài tập viết tay để nhận diện và sửa lỗi trực quan.'}
          </Text>

          <TouchableOpacity
            style={[styles.primaryActionBtn, SHADOWS.small]}
            onPress={isNativeUnavailable ? handleFallbackSystemPicker : () => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel={isNativeUnavailable ? 'Chọn ảnh từ thiết bị' : 'Mở cài đặt cấp quyền'}
            activeOpacity={0.88}
          >
            <Ionicons name={isNativeUnavailable ? 'images' : 'settings-outline'} size={18} color="#FFFFFF" />
            <Text style={styles.primaryActionBtnText}>
              {isNativeUnavailable ? 'Chọn ảnh từ thiết bị' : 'Mở cài đặt cấp quyền'}
            </Text>
          </TouchableOpacity>

          {!isNativeUnavailable && (
            <TouchableOpacity
              style={styles.fallbackBtn}
              onPress={handleFallbackSystemPicker}
              accessibilityRole="button"
              accessibilityLabel="Mở bộ chọn hệ thống (Dự phòng)"
              activeOpacity={0.88}
            >
              <Ionicons name="folder-open-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.fallbackBtnText}>Mở bộ chọn hệ thống (Dự phòng)</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : assets.length === 0 ? (
        /* Empty Gallery State */
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="images-outline" size={44} color={COLORS.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Chưa có ảnh trong thư viện</Text>
          <Text style={styles.emptyDesc}>
            Em hãy chụp ảnh bài tập mới bằng máy ảnh của MathVision nhé!
          </Text>
          <TouchableOpacity
            style={[styles.primaryActionBtn, SHADOWS.small]}
            onPress={() => router.replace('/camera' as any)}
            accessibilityRole="button"
            accessibilityLabel="Chụp ảnh ngay"
            activeOpacity={0.88}
          >
            <Ionicons name="camera" size={18} color="#FFFFFF" />
            <Text style={styles.primaryActionBtnText}>Chụp ảnh ngay</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Photo Grid */
        <FlatList
          data={assets}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GalleryGridItem
              item={item}
              isSelected={selectedAsset?.id === item.id}
              onSelect={handleSelectAsset}
            />
          )}
          contentContainerStyle={[
            styles.gridContent,
            { paddingBottom: insets.bottom + 90 },
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
        />
      )}

      {/* Sticky Bottom Action Bar */}
      {!loading && !isPermissionDenied && assets.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Hủy"
            activeOpacity={0.82}
          >
            <Text style={styles.cancelBtnText}>Hủy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.confirmBtn,
              !selectedAsset && styles.confirmBtnDisabled,
              SHADOWS.small,
            ]}
            disabled={!selectedAsset || isConfirming}
            onPress={handleConfirmSelection}
            accessibilityRole="button"
            accessibilityLabel="Dùng ảnh này"
            activeOpacity={0.88}
          >
            {isConfirming ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.confirmBtnText}>Dùng ảnh này</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  headerActionPlaceholder: {
    width: 48,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 12,
  },
  gridCell: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginRight: GRID_GAP,
    marginBottom: GRID_GAP,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridCellSelected: {
    borderColor: COLORS.primary,
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(37, 99, 235, 0.22)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 6,
  },
  selectedCheckBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  permissionCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  permissionIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    width: '100%',
    maxWidth: 280,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  fallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  fallbackBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginLeft: 6,
    textDecorationLine: 'underline',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    minHeight: 48,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    minHeight: 48,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    paddingHorizontal: 20,
  },
  confirmBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
