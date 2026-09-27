import React, { useEffect, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';

import { getAppBranding, isHandAIMode } from '../config/appMode';

export default function SplashScreen() {
  const router = useRouter();
  const auth = useContext(AuthContext);
  const isHandAI = isHandAIMode();
  const branding = getAppBranding();

  useEffect(() => {
    // S00 - SPLASH logic
    const timer = setTimeout(() => {
      if (isHandAI) {
        // HAND_AI mode: Direct startup to Home (no login, no permissions)
        router.replace('/(tabs)' as any);
      } else if (auth?.isAuthenticated) {
        router.replace('/(tabs)' as any);
      } else {
        router.replace('/login');
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [router, auth?.isAuthenticated, isHandAI]);

  return (
    <View style={styles.container}>
      <Ionicons
        name={isHandAI ? 'hardware-chip-outline' : 'scan-circle'}
        size={80}
        color={COLORS.primary}
        style={styles.icon}
      />
      <Text style={styles.title}>{branding.name}</Text>
      <Text style={styles.subtitle}>{branding.subtitle}</Text>
      {isHandAI && (
        <View style={styles.scopeBadge}>
          <Text style={styles.scopeBadgeText}>{branding.detailedSubtitle}</Text>
        </View>
      )}
      {!isHandAI && <Text style={styles.tagline}>{branding.tagline}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  scopeBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  scopeBadgeText: {
    fontSize: 13,
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
});
