import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SIZES } from '../../constants/theme';
import { AppHeader } from '../../components/ui/AppHeader';
import { AppButton } from '../../components/ui/AppButton';
import { StatusCard } from '../../components/domain/StatusCard';

export default function OutOfScopeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <AppHeader title="Chưa hỗ trợ dạng bài" showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.spacerTop} />

        <StatusCard
          status="info"
          title="Dạng bài này MathVision đang học thêm"
          subtitle="Hiện tại MathVision hỗ trợ tốt nhất các phép tính cộng, trừ số tự nhiên đặt tính dọc (lớp 1 - lớp 5)."
        />

        <View style={styles.spacer} />

        <View style={styles.actions}>
          <AppButton
            title="Chụp phép tính đặt dọc khác"
            variant="primary"
            onPress={() => router.replace({ pathname: '/camera' as any, params: { mode: 'ARITHMETIC' } })}
          />
          <View style={{ height: SIZES.small }} />
          <AppButton
            title="Về trang chủ"
            variant="secondary"
            onPress={() => router.replace('/(tabs)')}
          />
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
    padding: SIZES.large,
    flexGrow: 1,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  spacerTop: {
    height: SIZES.large,
  },
  spacer: {
    flex: 1,
    minHeight: SIZES.xlarge,
  },
  actions: {
    paddingBottom: SIZES.medium,
  },
});
