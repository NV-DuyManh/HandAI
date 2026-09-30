/// <reference types="jest" />

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import HandAiAnalyticsScreen from '../app/handai-analytics';
import HandAiTrialAnalyticsScreen from '../app/handai-trial-analytics';
import {
  StatusBadge,
  ReportCard,
  SectionHeader,
  MetricCard,
  ComparisonCard,
  PerformanceCard,
  HistoryCard,
  ErrorInsightCard,
  DatasetCard,
} from '../components/report';
import { handAiAnalyticsStore } from '../services/analytics/handAiAnalyticsStore';

export const mockPush = jest.fn();
export const mockReplace = jest.fn();
export const mockBack = jest.fn();

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({
    trialId: 'session_benchmark_1',
  }),
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock AppHeader
jest.mock('../components/ui/AppHeader', () => ({
  AppHeader: (props: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="mock-app-header">
        <Text>{props.title}</Text>
        {props.subtitle ? <Text>{props.subtitle}</Text> : null}
      </View>
    );
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
  let renderer: any;

  beforeEach(() => {
    act(() => {
      renderer = TestRenderer.create(<HandAiAnalyticsScreen />);
    });
    const allTexts = extractText(renderer.root);
    combinedText = allTexts.join(' ').replace(/\s+/g, ' ');
  });

  it('renders Header with academic identity badges', () => {
    expect(combinedText).toContain('HandAI Research Dashboard');
    expect(combinedText).toContain('Vietnamese Handwriting Recognition System');
    expect(combinedText).toContain('Research Prototype');
    expect(combinedText).toContain('CRNN + AI Correction');
    expect(combinedText).toContain('Version 1.2');
  });

  it('renders live metric cards without fallback percentages', () => {
    expect(combinedText).toContain('System Accuracy Evaluation');
    expect(combinedText).toContain('Verified Line Accuracy');
    expect(combinedText).toContain('Raw OCR Character Accuracy');
    expect(combinedText).toContain('Raw OCR Word Accuracy');
    expect(combinedText).toContain('Assisted Workflow Improvement');
    expect(combinedText).toContain('Awaiting Verified Data');
    expect(combinedText).not.toContain('88.2%');
    expect(combinedText).not.toContain('97.6%');
    expect(combinedText).not.toContain('94.1%');
  });

  it('renders Evaluation Summary block with latency and confidence', () => {
    expect(combinedText).toContain('Evaluation Summary');
    expect(combinedText).toContain('0 verified lines');
    expect(combinedText).toContain('0 lines');
    expect(combinedText).toContain('Correct OCR lines');
    expect(combinedText).not.toContain('2.3s / image');
    expect(combinedText).not.toContain('91.4%');
  });

  it('renders Model Configuration compact card and expandable Technical Architecture', () => {
    // 1. Compact card check (Section 5)
    expect(combinedText).toContain('MODEL CONFIGURATION');
    expect(combinedText).toContain('CRNN-v1.2 + AI Linguistic Correction Layer');
    expect(combinedText).toContain(
      'Hybrid OCR architecture combining handwriting recognition and Vietnamese language post-processing.'
    );
    expect(combinedText).toContain('View Technical Architecture');

    // 2. Expand Technical Architecture by pressing the button
    const buttons = renderer.root.findAllByProps({ accessibilityLabel: 'View Technical Architecture' });
    expect(buttons.length).toBeGreaterThan(0);

    act(() => {
      buttons[0].props.onPress();
    });

    const updatedText = extractText(renderer.root).join(' ');
    expect(updatedText).toContain('Hide Technical Architecture');
    expect(updatedText).toContain('Input Image');
    expect(updatedText).toContain('Feature Extraction (CNN)');
    expect(updatedText).toContain('Sequence Modeling (BiLSTM)');
    expect(updatedText).toContain('CTC Decoding');
    expect(updatedText).toContain('AI Correction Layer');
    expect(updatedText).toContain('Vietnamese Language Context Post-processing');
    expect(updatedText).toContain('Final Output');
  });

  it('renders an honest empty state until a verified before-and-after comparison exists', () => {
    expect(combinedText).toContain('Assistance and Review Impact');
    expect(combinedText).toContain('No Verified Comparison');
    expect(combinedText).toContain('No verified comparison yet');
    expect(combinedText).toContain('Confirm at least one recognition result with reference text');
    expect(combinedText).not.toContain('+12% improvement');
    expect(combinedText).not.toContain('92%');
  });

  it('renders the live evaluation source and excludes bundled sample data', () => {
    expect(combinedText).toContain('Live Evaluation Overview');
    expect(combinedText).toContain('On-device recognition history');
    expect(combinedText).toContain('Processed Lines');
    expect(combinedText).toContain('Evaluated Lines');
    expect(combinedText).toContain('Sample Data Excluded');
    expect(combinedText).toContain(
      'Metrics use completed non-sample sessions only.'
    );
    expect(combinedText).not.toContain('59,747 Total Handwriting Samples');
  });

  it('does not invent error categories without verified live lines', () => {
    expect(combinedText).toContain('Recognition Error Summary');
    expect(combinedText).toContain('No verified error analysis yet');
    expect(combinedText).not.toContain('Missing Character Error');
    expect(combinedText).not.toContain('Vietnamese Tone Error');
    expect(combinedText).not.toContain('Image Quality Issue');
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

  it('correctly renders reusable report components directly', () => {
    let compRenderer: any;
    act(() => {
      compRenderer = TestRenderer.create(
        <ReportCard>
          <SectionHeader label="TEST LABEL" title="Test Title" />
          <StatusBadge label="TEST BADGE" variant="green" showDot />
          <MetricCard
            value="99.9%"
            title="Test Metric"
            explanation="Test Explanation"
            color="blue"
            icon="analytics"
          />
          <ComparisonCard
            beforeTitle="Raw Model"
            beforeValue="50%"
            afterTitle="AI Enhanced"
            afterValue="99%"
          />
        </ReportCard>
      );
    });

    const text = extractText(compRenderer.root).join(' ');
    expect(text).toContain('TEST LABEL');
    expect(text).toContain('Test Title');
    expect(text).toContain('TEST BADGE');
    expect(text).toContain('99.9%');
    expect(text).toContain('Test Metric');
    expect(text).toContain('Raw Model');
    expect(text).toContain('AI Enhanced');
  });

  it('renders empty live Recognition History without seeded benchmark sessions', () => {
    expect(combinedText).toContain('Recognition History');
    expect(combinedText).toContain('No live recognition history');
    expect(combinedText).toContain('0 Results');
    expect(combinedText).not.toContain('Recognition #001');
    expect(renderer.root.findAllByProps({ testID: 'history-card-session_benchmark_1' })).toHaveLength(0);
  });

  it('renders Dataset Transparency with Total evaluation sessions and Total evaluated samples', () => {
    expect(combinedText).toContain('Total evaluation sessions');
    expect(combinedText).toContain('0 sessions');
    expect(combinedText).toContain('Total evaluated samples');
    expect(combinedText).toContain('0 lines');
    expect(combinedText).toContain(
      'Metrics use completed non-sample sessions only.'
    );
  });

  it('rejects bundled sample entries instead of fabricating a recognition analysis', async () => {
    let trialRenderer: any;
    await act(async () => {
      trialRenderer = TestRenderer.create(<HandAiTrialAnalyticsScreen />);
    });

    const trialText = extractText(trialRenderer.root).join(' ');

    expect(trialText).toContain('Recognition Detail');
    expect(trialText).toContain('No live session data');
    expect(trialText).toContain('no stored non-sample recognition result');
    expect(trialText).not.toContain('CRNN-v1.2 Benchmark Trial');
    expect(trialText).not.toContain('BENCHMARK SAMPLES');
    expect(trialText).not.toContain('Em hái im ăn');
    expect(trialText).not.toContain('Missing Character Error');
    expect(trialText).not.toContain('Image Quality Issue');
    expect(trialText).not.toContain('+11%');
  });

  it('renders the stored image and metrics from the selected live session only', async () => {
    const sessionsSpy = jest.spyOn(handAiAnalyticsStore, 'getSessions').mockReturnValue([
      {
        sessionId: 'session_benchmark_1',
        formattedSessionId: 'Recognition #LIVE',
        timestamp: new Date('2026-09-30T10:32:00+07:00').getTime(),
        dateStr: 'Live session',
        status: 'COMPLETED',
        isSampleData: false,
        imageUri: 'file:///real-handwriting-input.jpg',
        imageResolution: '800x701',
        totalLines: 1,
        confirmedLines: 1,
        rawCorrectLines: 0,
        correctLines: 1,
        rawAccuracy: 0,
        accuracy: 100,
        averageConfidence: 93,
        processingTimeSeconds: 1.7,
        modelVersion: 'live-crnn-checkpoint',
        datasetVersion: 'live-evaluation-set',
        experimentId: 'live-run-001',
        ocrEngine: 'Live OCR engine',
        aiEngine: 'Live correction engine',
        crnnRawCount: 0,
        aiCorrectionCount: 1,
        manualEditCount: 0,
        lineMetrics: [
          {
            lineIndex: 0,
            lineId: 'live-line-1',
            modelOutput: 'xin chao',
            ocrOutput: 'xin chao',
            aiSuggestion: 'xin chào',
            aiCandidate: 'xin chào',
            finalText: 'xin chào',
            groundTruth: 'xin chào',
            evaluationStatus: 'EVALUATED',
            cer: 0,
            characterAccuracy: 100,
            referenceWords: ['xin', 'chào'],
            predictedWords: ['xin', 'chào'],
            wer: 0,
            wordAccuracy: 100,
            source: 'AI_CORRECTION',
            sourceDecision: 'AI_CORRECTION',
            decisionSource: 'AI_CORRECTION',
            confidence: 93,
            isCorrect: true,
            correctionType: 'AI_CORRECTED',
            status: 'Corrected',
            ocrText: 'xin chao',
            text: 'xin chào',
            isRawCorrect: false,
            isFinalCorrect: true,
            groundTruthStatus: 'EXPLICIT',
            errorAnalysis: {
              errorType: 'VIETNAMESE_TONE_ERROR',
              severity: 'LOW',
              examples: ['xin chao → xin chào'],
              characterPairs: [{ wrongCharacter: 'a', correctCharacter: 'à', count: 1 }],
            },
          },
        ],
      },
    ]);

    let trialRenderer: any;
    await act(async () => {
      trialRenderer = TestRenderer.create(<HandAiTrialAnalyticsScreen />);
    });

    const trialText = extractText(trialRenderer.root).join(' ');
    const images = trialRenderer.root.findAllByProps({
      accessibilityLabel: 'Input image used for this recognition session',
    });

    expect(images.length).toBeGreaterThan(0);
    expect(images.some((image: any) => image.props.source?.uri === 'file:///real-handwriting-input.jpg')).toBe(true);
    expect(trialText).toContain('Recognition #LIVE');
    expect(trialText).toContain('xin chao');
    expect(trialText).toContain('xin chào');
    expect(trialText).toContain('live-crnn-checkpoint');
    expect(trialText).toContain('live-evaluation-set');
    expect(trialText).toContain('Vietnamese Tone Error');
    expect(trialText).not.toContain('Em hái im ăn');
    expect(trialText).not.toContain('BENCHMARK SAMPLES');
    expect(trialText).not.toContain('margin glare');

    sessionsSpy.mockRestore();
  });

  it('correctly renders PerformanceCard, HistoryCard, ErrorInsightCard, DatasetCard independently', () => {
    let customRenderer: any;
    const testOnPress = jest.fn();

    act(() => {
      customRenderer = TestRenderer.create(
        <ReportCard>
          <PerformanceCard
            value="88.2%"
            title="CRNN Recognition Accuracy"
            description="Automatic handwriting recognition performance before post-processing."
            categoryTag="Recognition Performance"
          />
          <HistoryCard
            sessionId="Recognition #001"
            date="29/09/2026"
            time="10:15"
            sampleCount="500 benchmark samples"
            modelVersion="CRNN-v1.2"
            rawOcrAccuracy={63}
            aiImprovement={18}
            rawOcrPreview="Bản OCR thật"
            aiSuggestionPreview="Gợi ý thật"
            duration="2.3s"
            onPress={testOnPress}
            testID="unit-history-card"
          />
          <ErrorInsightCard />
          <DatasetCard
            trainingSamples="59,462"
            benchmarkSamples="500"
            totalSessions="3 sessions"
            totalEvaluatedLines="500"
          />
        </ReportCard>
      );
    });

    const customText = extractText(customRenderer.root).join(' ');
    expect(customText).toContain('88.2%');
    expect(customText).toContain('CRNN Recognition Accuracy');
    expect(customText).toContain('Recognition #001');
    // HistoryCard metadata is now collapsed — verify pipeline previews exist
    expect(customText).toContain('Raw OCR');
    expect(customText).toContain('2.3s');
    // ErrorInsightCard with no errors shows clean state
    expect(customText).toContain('No recognition issues detected');
    expect(customText).toContain('Training Corpus');
    expect(customText).toContain('59,462');
    expect(customText).toContain('Evaluation Benchmark');
    expect(customText).toContain('500');

    // Verify history onPress
    const btn = customRenderer.root.findByProps({ testID: 'unit-history-card' });
    btn.props.onPress();
    expect(testOnPress).toHaveBeenCalled();
  });

  it('validates ErrorInsightCard under three distinct recognition scenarios', () => {
    // Scenario 1: Clean handwriting (0 errors)
    let cleanRenderer: any;
    act(() => {
      cleanRenderer = TestRenderer.create(<ErrorInsightCard errors={[]} />);
    });
    const cleanText = extractText(cleanRenderer.root).join(' ');
    expect(cleanText).toContain('No recognition issues detected');
    expect(cleanText).toContain('All characters and tones matched correctly in this recognition result.');
    expect(cleanText).not.toContain('Missing Character Error');
    expect(cleanText).not.toContain('Tone Error');
    expect(cleanText).not.toContain('Image Quality Issue');

    // Scenario 2: Missing stroke handwriting
    let missingRenderer: any;
    act(() => {
      missingRenderer = TestRenderer.create(
        <ErrorInsightCard
          errors={[
            {
              id: 'err_missing_1',
              errorType: 'Missing Character Error',
              originalText: '"Em hái im ăn"',
              suggestedText: '"Em hái sim ăn"',
              explanation: "Initial consonant 's' missing in rapid pen stroke, recovered by vocabulary model.",
              color: '#DC2626',
            },
          ]}
        />
      );
    });
    const missingText = extractText(missingRenderer.root).join(' ');
    expect(missingText).toContain('Missing Character Error');
    expect(missingText).toContain('"Em hái im ăn"');
    expect(missingText).toContain('"Em hái sim ăn"');
    expect(missingText).toContain("Initial consonant 's' missing in rapid pen stroke");
    expect(missingText).toContain('1 Detected');
    expect(missingText).not.toContain('No recognition issues detected');
    expect(missingText).not.toContain('Tone Error');
    expect(missingText).not.toContain('Image Quality Issue');

    // Scenario 3: Poor image quality
    let poorRenderer: any;
    act(() => {
      poorRenderer = TestRenderer.create(
        <ErrorInsightCard
          errors={[
            {
              id: 'err_tone_1',
              errorType: 'Tone Error',
              characterSnippet: 'e → ẹ, ơ → ợ',
              explanation: 'Tone diacritics faint due to low image contrast, restored from language context.',
              color: '#D97706',
            },
            {
              id: 'err_quality_1',
              errorType: 'Image Quality Issue',
              explanation: 'Low contrast or glare causing character boundary detection failures.',
              color: '#64748B',
            },
          ]}
        />
      );
    });
    const poorText = extractText(poorRenderer.root).join(' ');
    expect(poorText).toContain('Tone Error');
    expect(poorText).toContain('e → ẹ, ơ → ợ');
    expect(poorText).toContain('Image Quality Issue');
    expect(poorText).toContain('2 Detected');
    expect(poorText).not.toContain('No recognition issues detected');
    expect(poorText).not.toContain('Missing Character Error');
  });
});
