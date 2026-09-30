import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, ViewStyle, Animated } from 'react-native';

export interface ReportCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  radius?: number;
  padding?: number;
  borderColor?: string;
  backgroundColor?: string;
  accentTopColor?: string;
  accentTopWidth?: number;
  animateEntrance?: boolean;
  delayMs?: number;
  testID?: string;
}

export const ReportCard: React.FC<ReportCardProps> = ({
  children,
  style,
  radius = 22,
  padding = 20,
  borderColor = '#E2E8F0',
  backgroundColor = '#FFFFFF',
  accentTopColor,
  accentTopWidth = 3.5,
  animateEntrance = true,
  delayMs = 0,
  testID,
}) => {
  const fadeAnim = useRef(new Animated.Value(animateEntrance ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(animateEntrance ? 6 : 0)).current;

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
    if (animateEntrance) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          delay: delayMs,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          delay: delayMs,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [animateEntrance, fadeAnim, slideAnim, delayMs]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          borderRadius: radius,
          padding: padding,
          borderColor: borderColor,
          backgroundColor: backgroundColor,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        accentTopColor
          ? {
              borderTopWidth: accentTopWidth,
              borderTopColor: accentTopColor,
            }
          : null,
        style,
      ]}
      testID={testID}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginBottom: 24, // Section spacing: 24px
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
      } as any,
    }),
  },
});

export default ReportCard;
