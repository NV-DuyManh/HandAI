import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { AppHeader } from '../../components/ui/AppHeader';
import { AppCard } from '../../components/ui/AppCard';
import { AuthContext } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { OcrPilotService } from '../../services/api/OcrPilotService';
import { isHandAIMode } from '../../config/appMode';

export default function ProfileScreen() {
  const router = useRouter();
  const isHandAI = isHandAIMode();
  const auth = useContext(AuthContext);
  const user = auth?.user;

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Em có chắc chắn muốn đăng xuất không?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: () => auth?.logout() },
      ]
    );
  };

  if (isHandAI) {
    const trials = OcrPilotService.getAllCachedTrials();

    // Compute metrics
    const totalSessions = trials.length;
    const totalLines = trials.reduce((sum, t) => sum + (t.lines?.length || 0), 0);
    const totalCorrections = trials.reduce(
      (sum, t) =>
        sum +
        (t.lines?.filter(
          (l) =>
            l.verdict === 'CORRECTED' ||
            l.correctionApplied ||
            (l.correctedText && l.correctedText !== l.rawOcrText)
        ).length || 0),
      0
    );

    let avgConfText = 'N/A';
    if (totalLines > 0) {
      const confSum = trials.reduce(
        (sum, t) =>
          sum +
          (t.lines?.reduce((lSum, l) => lSum + (l.rawOcrConfidence ?? l.confidence ?? 0.85), 0) || 0),
        0
      );
      avgConfText = `${Math.round((confSum / totalLines) * 100)}%`;
    }

    return (
      <View style={styles.container}>
        <AppHeader title="Recognition History" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Research Sessions Summary Stats */}
          <View style={[styles.historyStatsCard, SHADOWS.small]}>
            <View style={styles.historyStatsHeader}>
              <Ionicons name="analytics" size={18} color={COLORS.primary} />
              <Text style={styles.historyStatsTitle}>Research Metrics</Text>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{totalSessions}</Text>
                <Text style={styles.statBoxLabel}>Sessions</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{totalLines}</Text>
                <Text style={styles.statBoxLabel}>Detected Lines</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{avgConfText}</Text>
                <Text style={styles.statBoxLabel}>Avg Confidence</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{totalCorrections}</Text>
                <Text style={styles.statBoxLabel}>AI Corrections</Text>
              </View>
            </View>
          </View>

          {/* Section: Recent Recognition */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeadingTitle}>Recent Recognition</Text>
            <Text style={styles.sessionCountTag}>{trials.length} trials</Text>
          </View>

          {trials.length === 0 ? (
            /* Professional Research Empty State */
            <View style={[styles.emptyResearchCard, SHADOWS.small]}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="document-text-outline" size={38} color="#64748B" />
              </View>
              <Text style={styles.emptyResearchTitle}>No Recognition Sessions Yet</Text>
              <Text style={styles.emptyResearchSubtitle}>
                Acquire or upload notebook handwriting images from Home or Scan. Processed trials with line metrics, confidence scores, and AI correction analytics will appear here.
              </Text>
              <TouchableOpacity
                style={[styles.emptyStartBtn, SHADOWS.small]}
                onPress={() => router.push('/camera' as any)}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Start New Scan"
              >
                <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
                <Text style={styles.emptyStartBtnText}>Start New Scan</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.trialsList}>
              {trials.map((trial, index) => {
                const linesCount = trial.lines?.length || 0;
                const correctionCount =
                  trial.lines?.filter(
                    (l) =>
                      l.verdict === 'CORRECTED' ||
                      l.correctionApplied ||
                      (l.correctedText && l.correctedText !== l.rawOcrText)
                  ).length || 0;
                const confSum =
                  trial.lines?.reduce((s, l) => s + (l.rawOcrConfidence ?? l.confidence ?? 0.85), 0) || 0;
                const meanConf = linesCount > 0 ? `${Math.round((confSum / linesCount) * 100)}%` : 'N/A';

                return (
                  <TouchableOpacity
                    key={trial.trialId || index}
                    style={[styles.sessionCard, SHADOWS.small]}
                    onPress={() =>
                      router.push({
                        pathname: '/ocr-pilot/multiline-result' as any,
                        params: { trialId: trial.trialId },
                      })
                    }
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel={`Session ${index + 1}: ${linesCount} lines`}
                  >
                    <View style={styles.sessionCardTop}>
                      <View style={styles.sessionBadge}>
                        <Ionicons name="document-text" size={14} color="#1E40AF" />
                        <Text style={styles.sessionBadgeText}>Session #{index + 1}</Text>
                      </View>
                      <View style={styles.confidenceChip}>
                        <Text style={styles.confidenceChipText}>Confidence: {meanConf}</Text>
                      </View>
                    </View>

                    <View style={styles.sessionMetricsRow}>
                      <View style={styles.sessionMetricItem}>
                        <Text style={styles.sessionMetricLabel}>Images</Text>
                        <Text style={styles.sessionMetricValue}>1 image</Text>
                      </View>
                      <View style={styles.sessionMetricItem}>
                        <Text style={styles.sessionMetricLabel}>Detected Lines</Text>
                        <Text style={styles.sessionMetricValue}>{linesCount} lines</Text>
                      </View>
                      <View style={styles.sessionMetricItem}>
                        <Text style={styles.sessionMetricLabel}>AI Corrections</Text>
                        <Text style={styles.sessionMetricValue}>{correctionCount}</Text>
                      </View>
                    </View>

                    <View style={styles.sessionCardFooter}>
                      <Text style={styles.viewResultText}>View Recognition Details</Text>
                      <Ionicons name="chevron-forward" size={16} color="#1E40AF" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  const menuItems = [
    {
      icon: 'shield-checkmark-outline' as const,
      label: 'Bảo mật & Dữ liệu riêng tư',
      sublabel: 'Ảnh được bảo vệ theo chuẩn riêng tư',
    },
    {
      icon: 'language-outline' as const,
      label: 'Ngôn ngữ hiển thị',
      sublabel: 'Tiếng Việt',
    },
    {
      icon: 'help-circle-outline' as const,
      label: 'Hướng dẫn sử dụng',
      sublabel: 'Cách chụp bài rõ nét',
    },
    {
      icon: 'information-circle-outline' as const,
      label: 'Thông tin ứng dụng',
      sublabel: 'MathVision Kids v1.0.0',
    },
  ];

  return (
    <View style={styles.container}>
      <AppHeader title="Hồ sơ của em" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Student identity card */}
        <AppCard style={styles.card} variant="elevated">
          <View style={[styles.avatarBadge, SHADOWS.small]}>
            <Ionicons name="school" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.name}>{user?.name || user?.email || 'Học sinh'}</Text>
          <View style={styles.gradePill}>
            <Text style={styles.gradeText}>
              {user?.grade ? `Học sinh Lớp ${user.grade}` : 'Học sinh Tiểu học'}
            </Text>
          </View>
        </AppCard>

        {/* Menu items card */}
        <AppCard style={styles.menuCard} variant="outlined">
          {menuItems.map((item, index) => (
            <View key={item.label}>
              <View style={styles.menuItem}>
                <View style={styles.menuIconContainer}>
                  <Ionicons name={item.icon} size={22} color={COLORS.primary} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuSublabel}>{item.sublabel}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </View>
              {index < menuItems.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </AppCard>

        {/* Logout button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Đăng xuất khỏi ứng dụng"
        >
          <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SIZES.medium,
    paddingBottom: SIZES.xxlarge,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    alignItems: 'center',
    paddingVertical: SIZES.xxlarge,
    marginBottom: SIZES.large,
  },
  avatarBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surfaceSubdued,
    borderWidth: 2,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.medium,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: 6,
  },
  gradePill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: SIZES.medium,
    paddingVertical: 4,
    borderRadius: SIZES.pillRadius,
  },
  gradeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: SIZES.xlarge,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.medium,
    minHeight: SIZES.minTouchTarget,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSubdued,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.medium,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  menuSublabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 56,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZES.minTouchTarget,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: SIZES.buttonRadius,
    paddingHorizontal: SIZES.large,
  },
  logoutText: {
    marginLeft: SIZES.small,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.error,
  },
  // HandAI Research Demo V4 styles
  historyStatsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 20,
  },
  historyStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyStatsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
  },
  statBoxValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E40AF',
  },
  statBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeadingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sessionCountTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyResearchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyResearchTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyResearchSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    maxWidth: 320,
  },
  emptyStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  emptyStartBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  trialsList: {
    gap: 12,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sessionCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  confidenceChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  confidenceChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  sessionMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  sessionMetricItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sessionMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  sessionMetricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  sessionCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  viewResultText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  // Legacy styles preserved for safe fallback
  researchCard: {
    marginBottom: SIZES.large,
    padding: SIZES.large,
  },
});
