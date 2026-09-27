import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { SIZES } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export function ScanFrame() {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.overlay}>
        <View style={styles.topMask}>
          <View style={styles.instructionPill}>
            <Ionicons name="scan-outline" size={18} color="#FFFFFF" style={styles.instructionIcon} />
            <Text style={styles.instruction}>Đặt toàn bộ phép tính vào khung</Text>
          </View>
        </View>
        
        <View style={styles.centerRow}>
          <View style={styles.sideMask} />
          <View style={styles.frame}>
            {/* Corner Markers */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <View style={styles.sideMask} />
        </View>
        
        <View style={styles.bottomMask}>
          <View style={styles.secondaryPill}>
            <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.9)" style={styles.instructionIcon} />
            <Text style={styles.secondaryInstruction}>Chỉ chụp một bài toán mỗi lần</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');
const frameWidth = Math.min(width * 0.82, 340);
const frameHeight = frameWidth * 1.18;
const cornerLength = 36;
const cornerWidth = 4;
const cornerColor = '#FFFFFF';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  overlay: {
    flex: 1,
  },
  topMask: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: SIZES.medium,
  },
  centerRow: {
    flexDirection: 'row',
    height: frameHeight,
  },
  sideMask: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  frame: {
    width: frameWidth,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  bottomMask: {
    flex: 1.2,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    paddingTop: SIZES.large,
  },
  corner: {
    position: 'absolute',
    borderColor: cornerColor,
  },
  topLeft: {
    top: 0,
    left: 0,
    width: cornerLength,
    height: cornerLength,
    borderTopWidth: cornerWidth,
    borderLeftWidth: cornerWidth,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    width: cornerLength,
    height: cornerLength,
    borderTopWidth: cornerWidth,
    borderRightWidth: cornerWidth,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    width: cornerLength,
    height: cornerLength,
    borderBottomWidth: cornerWidth,
    borderLeftWidth: cornerWidth,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    width: cornerLength,
    height: cornerLength,
    borderBottomWidth: cornerWidth,
    borderRightWidth: cornerWidth,
    borderBottomRightRadius: 16,
  },
  instructionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: SIZES.medium,
    paddingVertical: 10,
    borderRadius: SIZES.pillRadius,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  instructionIcon: {
    marginRight: 6,
  },
  instruction: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  secondaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: SIZES.medium,
    paddingVertical: 8,
    borderRadius: SIZES.pillRadius,
  },
  secondaryInstruction: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '500',
  },
});
