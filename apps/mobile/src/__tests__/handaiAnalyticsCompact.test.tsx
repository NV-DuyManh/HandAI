/// <reference types="jest" />
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import HandAiAnalyticsScreen from '../app/handai-analytics';
import HandAiTrialAnalyticsScreen from '../app/handai-trial-analytics';
import { handAiAnalyticsStore, type RecognitionSession } from '../services/analytics/handAiAnalyticsStore';

const mockPush = jest.fn();
let mockParams: Record<string, string> = { trialId: 'live-poem' };
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../components/ui/AppHeader', () => ({ AppHeader: (props: any) => { const { Text } = require('react-native'); return <Text>{props.title}</Text>; } }));
jest.mock('react-native-safe-area-context', () => { const { View } = require('react-native'); return { SafeAreaView: ({ children }: any) => <View>{children}</View>, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }; });

const session = (verified = false): RecognitionSession => ({
  sessionId: 'live-poem', formattedSessionId: 'Recognition #021', timestamp: 1,
  status: 'COMPLETED', isSampleData: false, totalLines: 12,
  imageUri: 'file:///actual-poem.jpg', imageResolution: '800x880',
  lineMetrics: [{ lineId: 'line-1', lineIndex: 1, confidence: 79, confidenceSource: 'CRNN_CTC_SOFTMAX', groundTruthStatus: verified ? 'EXPLICIT' : 'MISSING', evaluationStatus: verified ? 'EVALUATED' : 'PENDING', groundTruth: verified ? 'Em yeu mua he' : '', ocrOutput: 'CCm yeu mua he', finalText: 'Em yeu mua he', isRawCorrect: false, isFinalCorrect: verified, decisionSource: 'AI_CORRECTION', status: 'Corrected' }],
}) as RecognitionSession;
const renderedText = (renderer: any): string => {
  const collect = (node: any): string => typeof node === 'string' || typeof node === 'number'
    ? String(node)
    : (node?.children || []).map(collect).join(' ');
  return (renderer.toJSON() ? [renderer.toJSON()].flat().map(collect).join(' ') : '');
};

async function renderScreen(Component: React.ComponentType) {
  let renderer: any;
  await act(async () => { renderer = TestRenderer.create(<Component />); });
  return renderer;
}

describe('Compact live recognition reports', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockParams = { trialId: 'live-poem' };
    jest.spyOn(handAiAnalyticsStore, 'init').mockResolvedValue();
  });
  afterEach(() => { jest.restoreAllMocks(); });

  it('shows unverified activity and confidence without blank accuracy cards or redundant sections', async () => {
    jest.spyOn(handAiAnalyticsStore, 'getSessions').mockReturnValue([session()]);
    const renderer = await renderScreen(HandAiTrialAnalyticsScreen);
    const text = renderedText(renderer);
    expect(text).toContain('79%');
    expect(text).toContain('Processed lines');
    expect(text).toContain('AI text changes');
    expect(text).toContain('Not recorded');
    expect(text).toContain('Review the filled final text');
    expect(text).not.toContain('Recognition Transformation');
    expect(text).not.toContain('Error Insights');
    expect(text).not.toContain('Technical Information');
    expect(text).not.toContain('Final Line Accuracy');
    const image = renderer.root.findAllByProps({ accessibilityLabel: 'Input image used for this recognition session' });
    expect(image.some((node: any) => node.props.source.uri === 'file:///actual-poem.jpg')).toBe(true);
  });

  it('shows verified raw/final metrics and measured time when available', async () => {
    jest.spyOn(handAiAnalyticsStore, 'getSessions').mockReturnValue([{ ...session(true), processingTimeSeconds: 1.7 }]);
    const renderer = await renderScreen(HandAiTrialAnalyticsScreen);
    const text = renderedText(renderer);
    expect(text).toContain('Raw Line Accuracy');
    expect(text).toContain('AI-Assisted Line Accuracy');
    expect(text).toContain('1.7s');
    expect(text).toContain('No recorded AI response is available on reviewed lines');
    expect(text).not.toContain('100%');
    expect(text).not.toContain('Review the filled final text');
  });

  it('keeps aggregate activity/history while excluding sample data and empty research panels', async () => {
    jest.spyOn(handAiAnalyticsStore, 'getSessions').mockReturnValue([session(), { ...session(), sessionId: 'sample', isSampleData: true }]);
    const renderer = await renderScreen(HandAiAnalyticsScreen);
    const text = renderedText(renderer);
    expect(text).toContain('Recognition Summary');
    expect(text).toContain('79%');
    expect(text).toContain('Final text review needed for accuracy');
    expect(text).not.toContain('Recognition #021');
    expect(text).toContain('Open Recognition History');
    expect(renderer.root.findAllByProps({ testID: 'history-card-sample' })).toHaveLength(0);
    for (const removed of ['Recognition Error', 'Advanced Research Appendix', 'Model Architecture', 'Workflow Improvement Trend', 'Assistance and Review Impact']) expect(text).not.toContain(removed);
  });

  it('does not create a live report for a sample entry', async () => {
    jest.spyOn(handAiAnalyticsStore, 'getSessions').mockReturnValue([{ ...session(), isSampleData: true }]);
    const renderer = await renderScreen(HandAiTrialAnalyticsScreen);
    expect(renderedText(renderer)).toContain('No live session data');
  });

  it('explains saved activity with no references and opens an actual session for reference entry', async () => {
    const saved = Array.from({ length: 6 }, (_, index) => ({
      ...session(), sessionId: `live-${index}`, totalLines: index === 5 ? 8 : 12,
      imageUri: `file:///saved-${index}.jpg`,
    }));
    jest.spyOn(handAiAnalyticsStore, 'getSessions').mockReturnValue(saved);
    const renderer = await renderScreen(HandAiAnalyticsScreen);
    const text = renderedText(renderer);
    expect(text).toContain('6 sessions · 6 saved images · 68 recognized lines');
    expect(text).toContain('68 recognized lines · 6 recorded OCR scores');
    expect(text).toContain('OCR lines recorded');
    expect(text).toContain('AI responses recorded');
    expect(text).not.toContain('0/0 reference lines matched');
    expect(text).not.toContain('100%');
    await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Review final results from saved recognition' }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/handai-trial-analytics', params: { trialId: 'live-0', reviewReferences: '1' } });
  });

  it('reuses the current final text, supports one-tap confirmation, and edits only wrong lines', async () => {
    mockParams = { trialId: 'live-poem', reviewReferences: '1' };
    jest.spyOn(handAiAnalyticsStore, 'getSessions').mockReturnValue([session()]);
    const save = jest.spyOn(handAiAnalyticsStore, 'reviewFinalText').mockResolvedValue();
    const confirmAll = jest.spyOn(handAiAnalyticsStore, 'confirmAllFinalTexts').mockResolvedValue(1);
    const renderer = await renderScreen(HandAiTrialAnalyticsScreen);
    const text = renderedText(renderer);
    expect(text).toContain('Review Final Results');
    expect(text.indexOf('Confirm Final Results')).toBeLessThan(text.indexOf('Session Metrics'));
    expect(text).toContain('Em yeu mua he');
    expect(renderer.root.findByProps({ accessibilityLabel: 'Edit final text for line 1' })).toBeTruthy();
    await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Confirm final text for line 1' }).props.onPress());
    expect(save).toHaveBeenCalledWith('live-poem', 'line-1', 'Em yeu mua he');
    await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Confirm all current final text as correct' }).props.onPress());
    expect(confirmAll).toHaveBeenCalledWith('live-poem');
    await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Edit final text for line 1' }).props.onPress());
    const input = renderer.root.findByProps({ accessibilityLabel: 'Edit final text for line 1' });
    expect(input.props.value).toBe('Em yeu mua he');
    await act(async () => input.props.onChangeText('Corrected final line'));
    await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Save and confirm final text for line 1' }).props.onPress());
    expect(save).toHaveBeenLastCalledWith('live-poem', 'line-1', 'Corrected final line');
    await act(async () => renderer.root.findByProps({ accessibilityLabel: 'View updated recognition summary' }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/handai-analytics');
  });

  it('explains missing AI responses separately when reference text is already available', async () => {
    jest.spyOn(handAiAnalyticsStore, 'getSessions').mockReturnValue([session(true)]);
    const renderer = await renderScreen(HandAiAnalyticsScreen);
    const text = renderedText(renderer);
    expect(text).toContain('No recorded AI response on reviewed lines');
    expect(text).toContain('OCR measurements are available');
    expect(text).not.toContain('0/0 reference lines matched');
    expect(renderer.root.findAllByProps({ testID: 'reference-setup-prompt' })).toHaveLength(0);
  });
});
