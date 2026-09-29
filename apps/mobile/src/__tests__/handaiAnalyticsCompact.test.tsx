/// <reference types="jest" />

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import HandAiAnalyticsScreen from '../app/handai-analytics';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock AppHeader
jest.mock('../components/ui/AppHeader', () => ({
  AppHeader: ({ title }: { title: string }) => {
    const { Text } = require('react-native');
    return <Text testID="mock-app-header">{title}</Text>;
  },
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: any) => <View style={style}>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

function extractText(node: any): string[] {
  let result: string[] = [];
  if (!node) return result;

  const children = node.props?.children;
  if (typeof children === 'string') {
    result.push(children);
  } else if (Array.isArray(children)) {
    for (const child of children) {
      if (typeof child === 'string' || typeof child === 'number') {
        result.push(String(child));
      }
    }
  }

  if (node.children && Array.isArray(node.children)) {
    for (const childNode of node.children) {
      if (typeof childNode === 'object') {
        result = result.concat(extractText(childNode));
      } else if (typeof childNode === 'string' || typeof childNode === 'number') {
        result.push(String(childNode));
      }
    }
  }

  return result;
}

describe('HandAI Research Dashboard — Final Defense Mobile First Edition', () => {
  let combinedText: string;

  beforeEach(() => {
    let renderer: any;
    act(() => {
      renderer = TestRenderer.create(<HandAiAnalyticsScreen />);
    });
    const allTexts = extractText(renderer.root);
    combinedText = allTexts.join(' ');
  });

  it('renders Header with Final Defense, Active Model, and Verified Data badges', () => {
    expect(combinedText).toContain('HandAI Research Dashboard');
    expect(combinedText).toContain('Vietnamese Handwriting Recognition System');
    expect(combinedText).toContain('FINAL DEFENSE');
    expect(combinedText).toContain('ACTIVE MODEL');
    expect(combinedText).toContain('VERIFIED DATA');
  });

  it('renders Hero Summary with explicit 4 mobile metric cards', () => {
    expect(combinedText).toContain('HandAI System Overview');
    expect(combinedText).toContain('Recognition Accuracy (System Evaluation)');
    expect(combinedText).toContain('88.2%');

    expect(combinedText).toContain('Baseline Improvement (Before vs After AI Correction)');
    expect(combinedText).toContain('+37%');

    expect(combinedText).toContain('Global Char Accuracy');
    expect(combinedText).toContain('97.6%');

    expect(combinedText).toContain('Global Word Accuracy');
    expect(combinedText).toContain('94.1%');
  });

  it('renders Evaluation Summary block with latency and confidence', () => {
    expect(combinedText).toContain('Evaluation Summary');
    expect(combinedText).toContain('500 lines');
    expect(combinedText).toContain('315 (63.0%)');
    expect(combinedText).toContain('185 (37.0%)');
    expect(combinedText).toContain('500 (100%)');
    expect(combinedText).toContain('2.3s / image');
    expect(combinedText).toContain('91.4%');
  });

  it('renders Model Architecture as a Vertical Stepper with context post-processing layer', () => {
    expect(combinedText).toContain('Model Architecture');
    expect(combinedText).toContain('Input Image');
    expect(combinedText).toContain('Feature Extraction (CNN)');
    expect(combinedText).toContain('Sequence Modeling (BiLSTM)');
    expect(combinedText).toContain('CTC Decoding');
    expect(combinedText).toContain('AI Correction Layer');
    expect(combinedText).toContain('Vietnamese Language Context Post-processing');
    expect(combinedText).toContain('Final Output');
  });

  it('renders AI Contribution Analysis with batch footnote and gain stats', () => {
    expect(combinedText).toContain('AI Contribution Analysis');
    expect(combinedText).toContain('Raw CRNN OCR');
    expect(combinedText).toContain('63%');
    expect(combinedText).toContain('Baseline Evaluation');

    expect(combinedText).toContain('CRNN + AI Correction');
    expect(combinedText).toContain('100%');
    expect(combinedText).toContain('Evaluation Batch Result');

    expect(combinedText).not.toContain('Overall Accuracy 100%');

    expect(combinedText).toContain(
      'Measured on manually verified evaluation samples, not the complete dataset.'
    );

    expect(combinedText).toContain('Accuracy Gain');
    expect(combinedText).toContain('Error Recovery Rate');
    expect(combinedText).toContain('Rescued Samples');
  });

  it('renders Dataset Section with Training Corpus and Evaluation Benchmark breakdown', () => {
    expect(combinedText).toContain('Dataset Overview');
    expect(combinedText).toContain('Viet-Handwriting-OCR-v2');
    expect(combinedText).toContain('59,747 Total Handwriting Samples');
    expect(combinedText).toContain('Training Corpus');
    expect(combinedText).toContain('59,462');
    expect(combinedText).toContain('Evaluation Benchmark');
    expect(combinedText).toContain('500');
    expect(combinedText).toContain(
      'Evaluation samples are manually verified benchmark cases used for final performance assessment.'
    );
  });

  it('renders Error Analysis with Sample Visualization and 4 failure modes', () => {
    expect(combinedText).toContain('Error Analysis & Mitigation');
    expect(combinedText).toContain('Sample Visualization (Benchmark Case)');
    expect(combinedText).toContain('Original Handwriting');
    expect(combinedText).toContain('Raw OCR Result');
    expect(combinedText).toContain('AI Corrected Result');
    expect(combinedText).toContain('Em hái im ăn');
    expect(combinedText).toContain('Em hái sim ăn');

    expect(combinedText).toContain('Missing Character Errors');
    expect(combinedText).toContain('Vietnamese Tone Errors');
    expect(combinedText).toContain('Similar Character Confusion');
    expect(combinedText).toContain('Low Quality Image Errors');

    expect(combinedText).toContain(
      'Improve handwriting segmentation and character boundary detection.'
    );
  });

  it('renders Advanced Research Appendix and Standardized Action Buttons', () => {
    expect(combinedText).toContain('Advanced Research Appendix');
    expect(combinedText).toContain('Refresh Metrics');
    expect(combinedText).toContain('Validate Defense');
  });

  it('renders Footer with Final Defense Edition badge', () => {
    expect(combinedText).toContain('Powered by CRNN + AI Correction Technology');
    expect(combinedText).toContain('Research Version 1.2 — Final Defense Edition');
  });
});
