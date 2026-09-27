import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { AppHeader } from '../components/ui/AppHeader';
import { ENV } from '../config/env';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

export default function DevDemoScreen() {
  const router = useRouter();
  const [connStatus, setConnStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [connDetail, setConnDetail] = useState<string>('');

  const handleMock = (mockName: string) => {
    router.push({ pathname: '/preview', params: { uri: `file://${mockName}.jpg` } });
  };

  const testConnection = async () => {
    setConnStatus('TESTING');
    setConnDetail('');
    try {
      const healthUrl = ENV.API_BASE_URL.replace(/\/api\/v1\/?$/, '') + '/actuator/health';
      const res = await axios.get(healthUrl, { timeout: 5000 });
      setConnStatus('SUCCESS');
      setConnDetail(JSON.stringify(res.data));
    } catch (e: any) {
      setConnStatus('ERROR');
      setConnDetail(e.message || 'Không thể kết nối tới máy chủ');
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="QA & Chẩn đoán Thiết bị" showBack />
      
      <ScrollView style={styles.content}>
        {/* Network & API Diagnostic Box */}
        <View style={[styles.diagCard, SHADOWS.small]}>
          <View style={styles.diagHeader}>
            <Ionicons name="hardware-chip-outline" size={20} color={COLORS.primary} />
            <Text style={styles.diagTitle}>Chẩn đoán kết nối thiết bị</Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Môi trường:</Text>
            <Text style={styles.diagValue}>{Platform.OS.toUpperCase()} {__DEV__ ? '(Development)' : '(Release)'}</Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>API Base URL:</Text>
            <Text style={[styles.diagValue, styles.diagUrl]}>{ENV.API_BASE_URL}</Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Chế độ Mock:</Text>
            <Text style={styles.diagValue}>{ENV.USE_MOCK ? 'Bật (Mock Mode)' : 'Tắt (Real Spring Boot)'}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.testBtn} 
            onPress={testConnection}
            disabled={connStatus === 'TESTING'}
          >
            {connStatus === 'TESTING' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="pulse" size={18} color="#FFFFFF" />
            )}
            <Text style={styles.testBtnText}>
              {connStatus === 'TESTING' ? ' Đang kiểm tra...' : ' Kiểm tra kết nối Backend'}
            </Text>
          </TouchableOpacity>

          {connStatus === 'SUCCESS' && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
              <Text style={styles.successText}>Kết nối thành công! {connDetail}</Text>
            </View>
          )}
          {connStatus === 'ERROR' && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={COLORS.error} />
              <Text style={styles.errorText}>Kết nối thất bại: {connDetail}</Text>
            </View>
          )}
        </View>

        <Text style={styles.instruction}>Chỉ dành cho QA/Developer test luồng UI.</Text>
        
        <View style={styles.grid}>
          {[
            { label: 'Correct (Flow A)', key: 'mock-correct' },
            { label: 'Earliest Error (Flow B)', key: 'mock-earliest-error' },
            { label: 'Needs Confirmation (Flow C)', key: 'mock-confirm' },
            { label: 'Needs Retake (Flow D)', key: 'mock-blur' },
            { label: 'Crop Required', key: 'mock-crop' },
            { label: 'Out of Scope (Flow E)', key: 'mock-out-of-scope' },
            { label: 'Review Required (Flow F)', key: 'mock-review' },
          ].map(mock => (
            <TouchableOpacity 
              key={mock.key}
              style={styles.demoPill}
              onPress={() => handleMock(mock.key)}
            >
              <Text style={styles.demoPillText}>{mock.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
  },
  diagCard: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
    padding: SIZES.medium,
    marginBottom: SIZES.large,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  diagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.small,
  },
  diagTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginLeft: 8,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  diagLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  diagValue: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  diagUrl: {
    color: COLORS.primary,
    fontWeight: '700',
    maxWidth: '65%',
    textAlign: 'right',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: SIZES.buttonRadius,
    marginTop: SIZES.small,
  },
  testBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: SIZES.inputRadius,
    padding: 8,
    marginTop: 8,
  },
  successText: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: SIZES.inputRadius,
    padding: 8,
    marginTop: 8,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  instruction: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SIZES.large,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  demoPill: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: SIZES.cardRadius,
    width: '100%',
  },
  demoPillText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.surface,
    textAlign: 'center',
  }
});
