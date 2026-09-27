import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { Platform, View, StyleSheet } from 'react-native';
import { logFlowDomain } from '../../services/draft/submissionDraftStore';
import { isHandAIMode } from '../../config/appMode';

export default function TabLayout() {
  const isHandAI = isHandAIMode();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isHandAI ? 'Home' : 'Trang chủ',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: isHandAI ? 'Scan' : 'Chụp',
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.cameraIconContainer}>
              <Ionicons
                name={focused ? 'scan-circle' : 'scan-circle-outline'}
                size={34}
                color={COLORS.primary}
              />
            </View>
          ),
        }}
        listeners={{
          tabPress: () => {
            logFlowDomain('ACQUIRE', 'HANDWRITING_TEXT');
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: isHandAI ? 'Recognition History' : 'Của em',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={isHandAI ? (focused ? 'time' : 'time-outline') : (focused ? 'person' : 'person-outline')}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  cameraIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -4,
  },
});
