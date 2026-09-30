import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { LogBox, View, Text, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';
import { ENV } from '../config/env';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

LogBox.ignoreLogs(['Cannot connect to Expo CLI']);

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 8, textAlign: 'center' }}>
        HandAI Application Error
      </Text>
      <Text style={{ fontSize: 14, color: '#64748B', marginBottom: 20, textAlign: 'center', lineHeight: 20 }}>
        {error?.message || 'An unexpected runtime issue occurred. You can retry safely.'}
      </Text>
      <TouchableOpacity
        onPress={retry}
        style={{ backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>Retry / Reload</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (__DEV__) {
      const checkHealth = async () => {
        try {
          const baseUrl = (ENV.API_BASE_URL || '').replace(/\/api\/v1\/?$/, '');
          if (!baseUrl) return;
          const healthUrl = baseUrl + '/actuator/health';
          const res = await fetch(healthUrl, { method: 'GET' });
          if (!res.ok) {
            console.warn(`[HEALTH_CHECK] Backend health returned ${res.status}`);
          } else {
            console.log(`[HEALTH_CHECK] Backend is UP at ${baseUrl}`);
          }
        } catch (e: any) {
          console.warn(`[HEALTH_CHECK] Backend unreachable:`, e?.message);
        }
      };
      checkHealth();
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="crop" />
          <Stack.Screen name="camera" />
          <Stack.Screen name="preview" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="processing" />
          <Stack.Screen name="results" />
          <Stack.Screen name="handai-analytics" />
          <Stack.Screen name="handai-trial-analytics" />
          <Stack.Screen name="evaluation-history" />
          <Stack.Screen name="gallery" />
          <Stack.Screen name="dev-demo" />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

