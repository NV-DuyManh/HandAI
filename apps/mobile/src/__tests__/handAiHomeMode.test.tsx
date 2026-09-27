import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useRouter } from 'expo-router';
import HomeScreen from '../app/(tabs)/index';
import CameraScreen from '../app/camera';
import { getAppMode, isHandAIMode, getAppBranding, getFeatureFlags } from '../config/appMode';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
  SafeAreaView: 'SafeAreaView',
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));

describe('HAND_AI Mode Integration & Presentation Tests', () => {
  const originalEnv = process.env.EXPO_PUBLIC_APP_MODE;
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_APP_MODE = originalEnv;
  });

  describe('HandAI Home Screen Presentation (EXPO_PUBLIC_APP_MODE=HAND_AI)', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_APP_MODE = 'HAND_AI';
    });

    it('displays HandAI research branding, subtitle, pipeline checklist, and action buttons', () => {
      expect(isHandAIMode()).toBe(true);

      let renderer: any;
      act(() => {
        renderer = TestRenderer.create(<HomeScreen />);
      });

      const textNodes = renderer.root.findAllByType('Text').map((node: any) =>
        Array.isArray(node.props.children)
          ? node.props.children.join('')
          : String(node.props.children || '')
      );

      const allText = textNodes.join(' ');

      // HandAI Identity & Research Subtitle
      expect(allText).toContain('HAND_AI');
      expect(allText).toContain('Vietnamese Handwriting Recognition System');
      expect(allText).toContain('Primary Students Grade 1-5');

      // Primary Action Buttons
      expect(allText).toContain('Upload Image');
      expect(allText).toContain('Capture Image');

      // AI Pipeline Checklist (5 Stages)
      expect(allText).toContain('AI Pipeline');
      expect(allText).toContain('Image Acquisition');
      expect(allText).toContain('Preprocessing');
      expect(allText).toContain('Line Segmentation');
      expect(allText).toContain('Handwriting Recognition');
      expect(allText).toContain('Result Analysis');

      // Research Scope Card
      expect(allText).toContain('Research Scope');
      expect(allText).toContain('Vietnamese');
      expect(allText).toContain('Primary Student Handwriting');
      expect(allText).toContain('CRNN + CTC');

      // Math-specific calculation card is hidden
      expect(allText).not.toContain('Đọc phép tính');
      expect(allText).not.toContain('Cộng, trừ, nhân, chia đặt tính rồi tính');

      // Privacy masking workflow is hidden in HandAI mode
      expect(allText).not.toContain('Bảo vệ riêng tư');
    });

    it('CameraScreen locks to handwriting and hides arithmetic tab in HAND_AI mode', () => {
      let renderer: any;
      act(() => {
        renderer = TestRenderer.create(<CameraScreen />);
      });

      const textNodes = renderer.root.findAllByType('Text').map((node: any) =>
        Array.isArray(node.props.children)
          ? node.props.children.join('')
          : String(node.props.children || '')
      );
      const cameraText = textNodes.join(' ');

      // Single badge indicating handwriting recognition, arithmetic tab hidden
      expect(cameraText).toContain('Vietnamese Handwriting Recognition');
      expect(cameraText).not.toContain('Phép tính');
    });
  });

  describe('MathVision Kids Mode Preservation (EXPO_PUBLIC_APP_MODE=MATHVISION_KIDS)', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_APP_MODE = 'MATHVISION_KIDS';
    });

    it('preserves full original MathVision Kids interface and arithmetic card', () => {
      expect(isHandAIMode()).toBe(false);

      let renderer: any;
      act(() => {
        renderer = TestRenderer.create(<HomeScreen />);
      });

      const textNodes = renderer.root.findAllByType('Text').map((node: any) =>
        Array.isArray(node.props.children)
          ? node.props.children.join('')
          : String(node.props.children || '')
      );

      const allText = textNodes.join(' ');

      // Original branding
      expect(allText).toContain('MATHVISION KIDS');
      expect(allText).toContain('Đọc chữ viết tay');

      // Arithmetic card is present
      expect(allText).toContain('Đọc phép tính');
      expect(allText).toContain('Cộng, trừ, nhân, chia đặt tính rồi tính');

      // HandAI features block is not shown
      expect(allText).not.toContain('Upload handwriting image');
      expect(allText).not.toContain('Detect handwriting lines');
    });

    it('CameraScreen shows arithmetic tab in MATHVISION_KIDS mode', () => {
      let renderer: any;
      act(() => {
        renderer = TestRenderer.create(<CameraScreen />);
      });

      const textNodes = renderer.root.findAllByType('Text').map((node: any) =>
        Array.isArray(node.props.children)
          ? node.props.children.join('')
          : String(node.props.children || '')
      );
      const cameraText = textNodes.join(' ');

      expect(cameraText).toContain('Chữ viết tay');
      expect(cameraText).toContain('Phép tính');
    });
  });
});
