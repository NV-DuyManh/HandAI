import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { AuthContext } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import {
  submissionDraftStore,
  logFlowDomain,
  FlowDomain,
} from '../../services/draft/submissionDraftStore';
import { normalizeImageDraft, logStageDiagnostic } from '../../services/image/imagePipeline';
import { getAppBranding, isHandAIMode, getFeatureFlags } from '../../config/appMode';

export default function HomeScreen() {
  const router = useRouter();
  const auth = useContext(AuthContext);
  const userName = auth?.user?.name || 'em';
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [showPrivacyInfoModal, setShowPrivacyInfoModal] = useState(false);
  const isHandAI = isHandAIMode();
  const branding = getAppBranding();
  const featureFlags = getFeatureFlags();

  // Direct Native/System Image Picker — launches system library directly without intermediate custom /gallery
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const activeMode: FlowDomain = 'HANDWRITING_TEXT';
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
        draft.originalImageUri = asset.uri;
        draft.originalUri = asset.uri;
        draft.sourceImageUri = asset.uri;
        draft.rawUri = asset.uri;
        draft.uri = asset.uri;
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
            ? { uri: asset.uri }
            : { uri: draft.uri },
        });
      }
    } catch {
      Alert.alert('Lỗi', `${branding.name} không mở được thư viện ảnh.`);
    }
  };

  const navigateToCamera = (mode: FlowDomain = 'HANDWRITING_TEXT') => {
    submissionDraftStore.clearDraft();
    logFlowDomain('ACQUIRE', mode);
    router.push({ pathname: '/camera' as any, params: { mode } });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {isHandAI ? (
        /* ============================================================
           HAND_AI MODE: PROFESSIONAL BIG DATA RESEARCH DEMO VIEW
           ============================================================ */
        <View style={styles.researchContainer}>
          {/* Research Header */}
          <View style={styles.researchHeader}>
            <View style={styles.researchBadgeRow}>
              <View style={styles.researchLabBadge}>
                <View style={styles.researchPillDot} />
                <Text style={styles.researchLabBadgeText}>AI RESEARCH SYSTEM</Text>
              </View>
              <View style={styles.researchScopePill}>
                <Text style={styles.researchScopePillText}>{branding.detailedSubtitle}</Text>
              </View>
            </View>
            <View style={styles.researchBrandTitleRow}>
              <Image
                source={require('../../../assets/images/handai-icon.png')}
                style={styles.researchHeaderLogo}
                resizeMode="cover"
              />
              <View style={styles.researchTitleCol}>
                <Text style={styles.researchTitle}>HAND_AI</Text>
                <Text style={styles.researchSubtitle}>{branding.subtitle}</Text>
              </View>
            </View>
            <Text style={styles.researchDatasetScope}>
              {branding.datasetScope || 'Grade 1-5 Student Handwriting Dataset'}
            </Text>
          </View>

          {/* Action Execution Buttons */}
          <View style={styles.researchActionRow}>
            <TouchableOpacity
              style={[styles.researchBtnPrimary, SHADOWS.small]}
              onPress={handlePickImage}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Upload Image"
            >
              <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
              <Text style={styles.researchBtnPrimaryText}>Upload Image</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.researchBtnSecondary, SHADOWS.small]}
              onPress={() => navigateToCamera('HANDWRITING_TEXT')}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Capture Image"
            >
              <Ionicons name="camera-outline" size={20} color={COLORS.primary} />
              <Text style={styles.researchBtnSecondaryText}>Capture Image</Text>
            </TouchableOpacity>
          </View>

          {/* Accuracy Analytics Dashboard Access */}
          <TouchableOpacity
            style={[styles.researchBtnAnalytics, SHADOWS.small]}
            onPress={() => router.push('/handai-analytics' as any)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Accuracy Analytics Dashboard"
          >
            <Ionicons name="stats-chart" size={18} color="#FFFFFF" />
            <Text style={styles.researchBtnAnalyticsText}>Recognition Accuracy Analytics</Text>
          </TouchableOpacity>

          {/* AI Pipeline Card (5 Stages) */}
          <View style={[styles.researchCard, SHADOWS.small]}>
            <View style={styles.researchCardHeader}>
              <Ionicons name="hardware-chip-outline" size={18} color={COLORS.primary} />
              <Text style={styles.researchCardTitle}>AI Pipeline</Text>
            </View>
            <View style={styles.pipelineStepsList}>
              {branding.features.map((step, idx) => (
                <View key={idx} style={styles.pipelineStepItem}>
                  <View style={styles.pipelineStepNumBadge}>
                    <Text style={styles.pipelineStepNumText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.pipelineStepName}>{step}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Research Scope Card */}
          <View style={[styles.researchCard, SHADOWS.small]}>
            <View style={styles.researchCardHeader}>
              <Ionicons name="school-outline" size={18} color={COLORS.primary} />
              <Text style={styles.researchCardTitle}>Research Scope</Text>
            </View>
            <View style={styles.researchScopeList}>
              <View style={styles.scopeItemRow}>
                <Text style={styles.scopeItemLabel}>Language:</Text>
                <Text style={styles.scopeItemValue}>Vietnamese</Text>
              </View>
              <View style={styles.scopeItemRow}>
                <Text style={styles.scopeItemLabel}>Dataset:</Text>
                <Text style={styles.scopeItemValue}>Primary Student Handwriting</Text>
              </View>
              <View style={styles.scopeItemRow}>
                <Text style={styles.scopeItemLabel}>Model:</Text>
                <Text style={styles.scopeItemValue}>CRNN + CTC</Text>
              </View>
            </View>
          </View>

          {/* Recognition History Quick Link */}
          <TouchableOpacity
            style={[styles.historyLinkCard, SHADOWS.small]}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Recognition History"
          >
            <View style={styles.historyLinkLeft}>
              <View style={styles.historyIconBadge}>
                <Ionicons name="time-outline" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.historyLinkTitle}>Recognition History</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      ) : (
        /* ============================================================
           MATHVISION_KIDS MODE: 100% PRESERVED ORIGINAL INTERFACE
           ============================================================ */
        <View>
          {/* Brand & Greeting Header */}
          <View style={styles.header}>
            <View style={styles.greetingContainer}>
              <View style={styles.brandRow}>
                <View style={styles.brandBadge}>
                  <Ionicons name="sparkles" size={13} color={COLORS.primary} />
                  <Text style={styles.brandText}>MATHVISION KIDS</Text>
                </View>
              </View>
              <Text style={styles.greeting}>Xin chào, {userName}! 👋</Text>
              <Text style={styles.subtitle}>
                Cùng em nhận diện và rèn luyện chữ viết tay mỗi ngày
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.avatar, SHADOWS.small]}
              onPress={() => router.push('/(tabs)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Trang cá nhân của em"
            >
              <Ionicons name="person" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Main Unified Handwriting Entry Point - Hero Card */}
          <View style={[styles.mainHeroCard, SHADOWS.medium]}>
            {/* Decorative Mascot Art Element */}
            <View style={styles.heroTopBar}>
              <View style={styles.heroBadgePill}>
                <Ionicons name="create" size={14} color="#FFFFFF" />
                <Text style={styles.heroBadgePillText}>Nhận diện bài viết</Text>
              </View>
              <View style={styles.mascotArtContainer}>
                <View style={styles.mascotCircleOuter}>
                  <View style={styles.mascotCircleInner}>
                    <Ionicons name="school" size={24} color="#2563EB" />
                  </View>
                </View>
                <View style={styles.mascotSparkle1}>
                  <Ionicons name="star" size={10} color="#FBBF24" />
                </View>
                <View style={styles.mascotSparkle2}>
                  <Ionicons name="star" size={8} color="#FDE68A" />
                </View>
              </View>
            </View>

            <Text style={styles.heroTitle}>Đọc chữ viết tay</Text>
            <Text style={styles.heroDescription}>
              Chụp hoặc chọn ảnh bài viết tiếng Việt. Hệ thống tự động phân tích từng dòng, nhận diện chữ chuẩn xác và gợi ý sửa lỗi trực quan.
            </Text>

            {/* 2 Primary Direct CTAs — 1-Tap Execution */}
            <View style={styles.heroActionRow}>
              <TouchableOpacity
                style={[styles.ctaPrimaryBtn, SHADOWS.small]}
                onPress={() => navigateToCamera('HANDWRITING_TEXT')}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Chụp ảnh mới"
              >
                <Ionicons name="camera" size={20} color={COLORS.primaryDark} />
                <Text style={styles.ctaPrimaryBtnText}>Chụp ảnh mới</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.ctaSecondaryBtn}
                onPress={handlePickImage}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Chọn từ thư viện"
              >
                <Ionicons name="images-outline" size={19} color="#FFFFFF" />
                <Text style={styles.ctaSecondaryBtnText}>Chọn từ thư viện</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Secondary Features Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Tính năng học tập</Text>
          </View>

          <View style={styles.featureGrid}>
            {/* Feature 1: Arithmetic */}
            <TouchableOpacity
              style={[styles.gridCard, { backgroundColor: '#EFF6FF' }, SHADOWS.small]}
              onPress={() => navigateToCamera('ARITHMETIC')}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Đọc phép tính đặt dọc"
            >
              <View style={[styles.gridIconBadge, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="calculator" size={22} color="#2563EB" />
              </View>
              <Text style={styles.gridCardTitle}>Đọc phép tính</Text>
              <Text style={styles.gridCardSubtitle}>
                Cộng, trừ, nhân, chia đặt tính rồi tính
              </Text>
            </TouchableOpacity>

            {/* Feature 2: Privacy Protection Info */}
            <TouchableOpacity
              style={[styles.gridCard, { backgroundColor: '#F0FDF4' }, SHADOWS.small]}
              onPress={() => setShowPrivacyInfoModal(true)}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Bảo vệ riêng tư"
            >
              <View style={[styles.gridIconBadge, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="shield-checkmark" size={22} color="#16A34A" />
              </View>
              <Text style={styles.gridCardTitle}>Bảo vệ riêng tư</Text>
              <Text style={styles.gridCardSubtitle}>
                Tự động che tên và thông tin học sinh
              </Text>
            </TouchableOpacity>

            {/* Feature 3: Exercise History */}
            <TouchableOpacity
              style={[styles.gridCard, { backgroundColor: '#FAF5FF' }, SHADOWS.small]}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Lịch sử bài tập"
            >
              <View style={[styles.gridIconBadge, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="time" size={22} color="#7C3AED" />
              </View>
              <Text style={styles.gridCardTitle}>Lịch sử bài tập</Text>
              <Text style={styles.gridCardSubtitle}>
                Xem lại các bài viết và kết quả đã lưu
              </Text>
            </TouchableOpacity>

            {/* Feature 4: Photo Capture Tips */}
            <TouchableOpacity
              style={[styles.gridCard, { backgroundColor: '#FFF7ED' }, SHADOWS.small]}
              onPress={() => setShowTipsModal(true)}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Mẹo chụp ảnh nét"
            >
              <View style={[styles.gridIconBadge, { backgroundColor: '#FFEDD5' }]}>
                <Ionicons name="bulb" size={22} color="#EA580C" />
              </View>
              <Text style={styles.gridCardTitle}>Mẹo chụp rõ nét</Text>
              <Text style={styles.gridCardSubtitle}>
                Bí quyết chụp ảnh để AI nhận diện tốt nhất
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal: Helpful Photo Tips */}
      <Modal
        visible={showTipsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTipsModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTipsModal(false)}>
          <Pressable style={[styles.modalCard, SHADOWS.large]} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <View style={[styles.modalHeaderIconBadge, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="bulb" size={22} color="#D97706" />
              </View>
              <Text style={styles.modalTitle}>Mẹo chụp ảnh rõ nét</Text>
              <TouchableOpacity
                onPress={() => setShowTipsModal(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Đóng mẹo chụp ảnh"
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.tipRow}>
              <View style={[styles.tipBullet, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="sunny" size={16} color="#059669" />
              </View>
              <View style={styles.tipTextCol}>
                <Text style={styles.tipTitle}>Đủ ánh sáng</Text>
                <Text style={styles.tipDesc}>
                  Chụp ở nơi có ánh sáng đều, tránh để bóng tay hoặc điện thoại đè lên trang vở.
                </Text>
              </View>
            </View>

            <View style={styles.tipRow}>
              <View style={[styles.tipBullet, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="phone-portrait" size={16} color="#2563EB" />
              </View>
              <View style={styles.tipTextCol}>
                <Text style={styles.tipTitle}>Chụp thẳng góc</Text>
                <Text style={styles.tipDesc}>
                  Giữ điện thoại song song với mặt phẳng vở, không chụp từ góc quá nghiêng.
                </Text>
              </View>
            </View>

            <View style={styles.tipRow}>
              <View style={[styles.tipBullet, { backgroundColor: '#FAF5FF' }]}>
                <Ionicons name="scan" size={16} color="#7C3AED" />
              </View>
              <View style={styles.tipTextCol}>
                <Text style={styles.tipTitle}>Căn trọn khung hình</Text>
                <Text style={styles.tipDesc}>
                  Để bài làm nằm gọn trong khung hình, không để mất chữ ở mép trên hoặc mép dưới.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => setShowTipsModal(false)}
            >
              <Text style={styles.modalPrimaryBtnText}>Đã hiểu rồi</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Student Privacy Information */}
      <Modal
        visible={showPrivacyInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrivacyInfoModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPrivacyInfoModal(false)}>
          <Pressable style={[styles.modalCard, SHADOWS.large]} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <View style={[styles.modalHeaderIconBadge, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="shield-checkmark" size={22} color="#16A34A" />
              </View>
              <Text style={styles.modalTitle}>Bảo vệ thông tin cá nhân</Text>
              <TouchableOpacity
                onPress={() => setShowPrivacyInfoModal(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Đóng thông tin bảo mật"
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.privacyModalIntro}>
              {branding.name} cam kết giữ an toàn tối đa cho học sinh:
            </Text>

            <View style={styles.tipRow}>
              <View style={[styles.tipBullet, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="eye-off" size={16} color="#16A34A" />
              </View>
              <View style={styles.tipTextCol}>
                <Text style={styles.tipTitle}>Che phần thông tin nhạy cảm</Text>
                <Text style={styles.tipDesc}>
                  Trước khi nhận diện, em có thể dùng ngón tay kéo thả các ô màu đen để che tên, trường lớp hoặc số điện thoại.
                </Text>
              </View>
            </View>

            <View style={styles.tipRow}>
              <View style={[styles.tipBullet, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="lock-closed" size={16} color="#2563EB" />
              </View>
              <View style={styles.tipTextCol}>
                <Text style={styles.tipTitle}>Bảo mật trên thiết bị</Text>
                <Text style={styles.tipDesc}>
                  Vùng che được xử lý trực tiếp trước khi gửi ảnh, đảm bảo không ai thấy được thông tin bị ẩn.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => setShowPrivacyInfoModal(false)}
            >
              <Text style={styles.modalPrimaryBtnText}>Đã hiểu rồi</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 40,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greetingContainer: {
    flex: 1,
    paddingRight: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  brandText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Hero Card */
  mainHeroCard: {
    backgroundColor: '#1D4ED8',
    borderRadius: SIZES.radiusXl,
    padding: 22,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2563EB',
    overflow: 'hidden',
  },
  heroTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroBadgePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mascotArtContainer: {
    position: 'relative',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotCircleOuter: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotCircleInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotSparkle1: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  mascotSparkle2: {
    position: 'absolute',
    bottom: 0,
    left: -2,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.90)',
    lineHeight: 20,
    marginBottom: 20,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ctaPrimaryBtn: {
    flex: 1.15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    minHeight: SIZES.minTouchTarget,
  },
  ctaPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  ctaSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    minHeight: SIZES.minTouchTarget,
  },
  ctaSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Feature Grid */
  sectionHeaderRow: {
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: SIZES.radiusLg,
    padding: 16,
    minHeight: 136,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  gridIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  gridCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  gridCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 480,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalHeaderIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 6,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  tipBullet: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  tipTextCol: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  tipDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  privacyModalIntro: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 14,
  },
  modalPrimaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  modalPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  /* HandAI Professional Research Demo Styles */
  researchContainer: {
    width: '100%',
  },
  researchHeader: {
    marginBottom: 20,
  },
  researchBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  researchLabBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  researchPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4F46E5',
  },
  researchLabBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.8,
  },
  researchScopePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  researchScopePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  researchBrandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  researchHeaderLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    backgroundColor: '#0B192C',
  },
  researchTitleCol: {
    flex: 1,
  },
  researchTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  researchSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 22,
  },
  researchDatasetScope: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    marginTop: 4,
  },
  researchMainCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: SIZES.radiusXl,
    padding: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#312E81',
  },
  researchCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pipelineTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pipelineTitleBadgeText: {
    color: '#E0E7FF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  pipelineVersionText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  pipelineChecklist: {
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pipelineStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  pipelineStepIconWrapper: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipelineStepTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  researchActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  researchBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 14,
  },
  researchBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  researchBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  researchBtnSecondaryText: {
    color: '#1E40AF',
    fontSize: 14,
    fontWeight: '700',
  },
  researchBtnAnalytics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#123B7A',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  researchBtnAnalyticsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  researchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: SIZES.radiusLg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  researchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  researchCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  pipelineStepsList: {
    gap: 8,
  },
  pipelineStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  pipelineStepNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pipelineStepNumText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E40AF',
  },
  pipelineStepName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  researchScopeList: {
    gap: 8,
  },
  scopeItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  scopeItemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  scopeItemValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyLinkCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  historyLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyLinkTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
});
