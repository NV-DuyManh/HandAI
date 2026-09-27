import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { LogBox, Alert } from 'react-native';
import { useEffect } from 'react';
import { ENV } from '../config/env';

LogBox.ignoreLogs(['Cannot connect to Expo CLI']);

export default function RootLayout() {
  useEffect(() => {
    if (__DEV__) {
      const checkHealth = async () => {
        const baseUrl = ENV.API_BASE_URL.replace(/\/api\/v1\/?$/, '');
        const healthUrl = baseUrl + '/actuator/health';
        try {
          const res = await fetch(healthUrl, { method: 'GET' });
          if (!res.ok) {
            console.warn(`[HEALTH_CHECK] Backend health returned ${res.status}`);
          } else {
            console.log(`[HEALTH_CHECK] Backend is UP at ${baseUrl}`);
          }
        } catch (e: any) {
          console.warn(`[HEALTH_CHECK] Backend unreachable at ${baseUrl}:`, e.message);
        }
      };
      checkHealth();
    }
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="preview" />
        <Stack.Screen name="processing" />
        <Stack.Screen name="results" />
        <Stack.Screen name="gallery" />
      </Stack>
    </AuthProvider>
  );
}
