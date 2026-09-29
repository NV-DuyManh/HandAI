import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type OcrPhase =
  | 'IDLE'
  | 'UPLOADING_IMAGE'
  | 'DETECTING_LINES'
  | 'OCR_PROCESSING'
  | 'AI_CORRECTION'
  | 'DONE'
  | 'ERROR';

export interface OCRProgressLoaderProps {
  phase: OcrPhase;
  progress: number; // 0 - 100
  title?: string;
  error?: { title: string; message: string; isTimeout?: boolean } | null;
  onRetry?: () => void;
  onCancel?: () => void;
  isHandAI?: boolean;
}

interface StepDef {
  key: string;
  labelVi: string;
  labelEn: string;
  minProgress: number;
  maxProgress: number;
}

const STEPS: StepDef[] = [
  { key: 'PREP', labelVi: 'Chuẩn bị ảnh', labelEn: 'Image preprocessing', minProgress: 0, maxProgress: 20 },
  { key: 'DETECT', labelVi: 'Tìm dòng chữ', labelEn: 'Line detection', minProgress: 20, maxProgress: 55 },
  { key: 'OCR', labelVi: 'Nhận dạng ký tự', labelEn: 'OCR recognition', minProgress: 55, maxProgress: 85 },
  { key: 'AI', labelVi: 'Kiểm tra AI', labelEn: 'AI verification', minProgress: 85, maxProgress: 95 },
  { key: 'DONE', labelVi: 'Hoàn tất kết quả', labelEn: 'Finalize result', minProgress: 95, maxProgress: 100 },
];

export const OCRProgressLoader: React.FC<OCRProgressLoaderProps> = ({
  phase,
  progress,
  title,
  error,
  onRetry,
  onCancel,
  isHandAI = false,
}) => {
  const animatedProgress = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: Math.min(100, Math.max(0, progress)),
      duration: progress >= 95 ? 250 : 400,
      useNativeDriver: false,
    }).start();
  }, [progress, animatedProgress]);

  const progressInterpolate = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const displayPercent = Math.round(Math.min(100, Math.max(0, progress)));

  if (phase === 'ERROR' && error) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="alert-circle" size={44} color="#EF4444" />
          </View>
          <Text style={styles.errorTitle}>{error.title}</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>

          <View style={styles.buttonGroup}>
            {onCancel && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelButtonText}>{isHandAI ? 'Cancel' : 'Hủy'}</Text>
              </TouchableOpacity>
            )}
            {onRetry && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="Retry"
              >
                <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.retryButtonText}>{isHandAI ? 'Retry' : 'Thử lại'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.mainTitle}>
          {title || (isHandAI ? 'Recognizing Handwriting' : 'Đang nhận diện chữ viết')}
        </Text>

        {/* Progress Bar & Percentage */}
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>
            {displayPercent < 100 ? `${displayPercent}%` : (isHandAI ? 'Completed' : 'Hoàn tất')}
          </Text>
        </View>

        <View style={styles.progressBarTrack}>
          <Animated.View style={[styles.progressBarFill, { width: progressInterpolate }]} />
        </View>

        {/* Step Indicator */}
        <View style={styles.stepList}>
          {STEPS.map((step) => {
            const isCompleted = progress >= step.maxProgress;
            const isCurrent = progress >= step.minProgress && progress < step.maxProgress;
            const label = isHandAI ? step.labelEn : step.labelVi;

            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={styles.stepIconBox}>
                  {isCompleted ? (
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  ) : isCurrent ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : (
                    <View style={styles.pendingDot} />
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    isCompleted && styles.stepLabelCompleted,
                    isCurrent && styles.stepLabelCurrent,
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        {onCancel && (
          <TouchableOpacity
            style={styles.inlineCancelBtn}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.inlineCancelText}>{isHandAI ? 'Cancel' : 'Hủy'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressHeader: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  progressBarTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 6,
  },
  stepList: {
    width: '100%',
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  stepIconBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pendingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  stepLabelCurrent: {
    color: '#0F172A',
    fontWeight: '700',
  },
  stepLabelCompleted: {
    color: '#10B981',
    fontWeight: '600',
  },
  inlineCancelBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  inlineCancelText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  errorIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonGroup: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  retryButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
