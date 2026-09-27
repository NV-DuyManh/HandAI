import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';

export interface ImageSourceModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectGallery: () => void;
  title?: string;
  subtitle?: string;
}

/**
 * ImageSourceModal: App-owned bottom sheet source chooser.
 *
 * Guarantees:
 * 1. Tapping the backdrop outside content dismisses the modal.
 * 2. Tapping inside the sheet content does NOT dismiss the modal.
 * 3. Android hardware back button cleanly dismisses the modal via BackHandler.
 * 4. Touch targets >= 48px for easy mobile interaction.
 */
export const ImageSourceModal: React.FC<ImageSourceModalProps> = ({
  visible,
  onClose,
  onSelectCamera,
  onSelectGallery,
  title = 'Tải ảnh bài tập',
  subtitle = 'Em muốn chụp ảnh mới hay chọn ảnh có sẵn trong máy?',
}) => {
  useEffect(() => {
    if (!visible) return;

    const onBackPress = () => {
      onClose();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );
    return () => backHandler.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        testID="modal-backdrop"
        accessibilityRole="button"
        accessibilityLabel="Đóng bảng chọn ảnh"
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => {
            // Prevent outside-tap dismiss when touching the content area
            e.stopPropagation?.();
          }}
          style={[styles.sheet, SHADOWS.medium]}
          testID="modal-content"
          accessibilityRole="none"
        >
          {/* Header pill indicator */}
          <View style={styles.handleBar} />

          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          {/* Option: Camera */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              onClose();
              onSelectCamera();
            }}
            activeOpacity={0.85}
            testID="option-camera"
            accessibilityRole="button"
            accessibilityLabel="Chụp ảnh mới bằng máy ảnh"
          >
            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="camera" size={22} color={COLORS.primaryDark} />
            </View>
            <View style={styles.actionTextWrapper}>
              <Text style={styles.actionTitle}>Chụp ảnh mới</Text>
              <Text style={styles.actionSubtitle}>Mở máy ảnh để chụp trực tiếp trang bài tập</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Option: Gallery */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              onClose();
              onSelectGallery();
            }}
            activeOpacity={0.85}
            testID="option-gallery"
            accessibilityRole="button"
            accessibilityLabel="Chọn ảnh từ thư viện thiết bị"
          >
            <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="images" size={22} color="#059669" />
            </View>
            <View style={styles.actionTextWrapper}>
              <Text style={styles.actionTitle}>Chọn từ thư viện</Text>
              <Text style={styles.actionSubtitle}>Chọn ảnh bài viết đã chụp từ thư viện máy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.8}
            testID="option-cancel"
            accessibilityRole="button"
            accessibilityLabel="Hủy bỏ, đóng bảng chọn"
          >
            <Text style={styles.cancelButtonText}>Hủy</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 18,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    minHeight: 56,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionTextWrapper: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  cancelButton: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
});
