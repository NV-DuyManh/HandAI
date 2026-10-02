/// <reference types="jest" />
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import EvaluationHistoryScreen from '../app/evaluation-history';
import {
  HandAiAnalyticsStore,
  handAiAnalyticsStore,
  type RecognitionSession,
  type TrialAnalytics,
} from '../services/analytics/handAiAnalyticsStore';
import { OcrPilotService, type MultilineTrialResult } from '../services/api/OcrPilotService';
import { buildHandAiDashboardMetrics } from '../services/analytics/handAiDashboardMetrics';
import { StoredLineReview } from '../components/report/StoredLineReview';

const mockFiles: Record<string, string> = {};
const mockLegacy: Record<string, string> = {};
const mockPush = jest.fn();
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: jest.fn(async (uri: string) => ({ exists: uri.endsWith('.json')
    ? mockFiles[uri] !== undefined : !uri.includes('missing-photo') })),
  readAsStringAsync: jest.fn(async (uri: string) => mockFiles[uri]),
  writeAsStringAsync: jest.fn(async (uri: string, value: string) => { mockFiles[uri] = value; }),
  makeDirectoryAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => { mockFiles[to] = mockFiles[from] || 'image'; }),
  deleteAsync: jest.fn(async (uri: string) => { delete mockFiles[uri]; }),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockLegacy[key] ?? null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(async (key: string) => { delete mockLegacy[key]; }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../components/ui/AppHeader', () => ({ AppHeader: (props: any) => {
  const { Text } = require('react-native'); return <Text>{props.title}</Text>;
} }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: ({ children }: any) => <View>{children}</View>, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const historyPath = 'file:///documents/handai-history/handai_recognition_history_v3.json';
const detailPath = (id: string) => `file:///documents/handai-history/trial_analytics_${id}.json`;
const session = (id: string): RecognitionSession => ({
  sessionId: id, formattedSessionId: `Attempt ${id}`, timestamp: 1,
  status: 'COMPLETED', isSampleData: false, totalLines: 1, confirmedLines: 1,
  imageUri: 'file:///cache/input.jpg', rawOcrPreview: 'Trên cao lưng đồi',
  lineMetrics: [{ lineId: 'line-1', lineIndex: 1, modelOutput: 'Trên cao lưng đôi', ocrOutput: 'Trên cao lưng đôi',
    aiSuggestion: 'Trên cao lưng đồi', aiCandidate: 'Trên cao lưng đồi', finalText: 'Trên cao lưng đồi',
    confidence: 83, confidenceSource: 'CRNN_CTC_SOFTMAX', groundTruth: '', groundTruthStatus: 'MISSING',
    evaluationStatus: 'PENDING', status: 'Corrected', isRawCorrect: false, isFinalCorrect: false }],
}) as RecognitionSession;

const renderedText = (renderer: any): string => {
  const collect = (node: any): string => typeof node === 'string' || typeof node === 'number'
    ? String(node) : (node?.children || []).map(collect).join(' ');
  return [renderer.toJSON()].flat().map(collect).join(' ');
};

describe('Recognition history persistence', () => {
  beforeEach(() => {
    Object.keys(mockFiles).forEach((key) => { delete mockFiles[key]; });
    Object.keys(mockLegacy).forEach((key) => { delete mockLegacy[key]; });
    OcrPilotService.removeCachedTrials(OcrPilotService.getAllCachedTrials().map((trial) => trial.trialId));
    jest.clearAllMocks();
  });
  afterEach(() => jest.restoreAllMocks());

  it('cleans only broken stored entries and retains available legacy previews without inventing lines', async () => {
    const valid = session('valid');
    const previewOnly = { ...session('preview'), lineMetrics: undefined };
    const noImage = { ...session('no-image'), imageUri: undefined };
    const noResult = { ...session('no-result'), rawOcrPreview: '', lineMetrics: [] };
    const missingPhoto = { ...session('missing'), imageUri: 'file:///missing-photo.jpg' };
    mockFiles[historyPath] = JSON.stringify([valid, previewOnly, noImage, noResult, missingPhoto]);
    mockFiles[detailPath('no-image')] = JSON.stringify({ trialId: 'no-image' });
    const store = new HandAiAnalyticsStore();
    await store.init();
    expect(store.getSessions().map((item) => item.sessionId)).toEqual(['valid', 'preview']);
    expect(store.getSessions()[1].lineMetrics).toBeUndefined();
    expect(JSON.parse(mockFiles[historyPath])).toHaveLength(2);
    expect(mockFiles[detailPath('no-image')]).toBeUndefined();
  });

  it('deletes selected sessions from archive, detail cache and runtime OCR cache; updates subscribers', async () => {
    mockFiles[historyPath] = JSON.stringify([session('keep'), session('delete')]);
    mockFiles[detailPath('delete')] = JSON.stringify({ trialId: 'delete' });
    OcrPilotService.cacheTrial({ trialId: 'delete' } as MultilineTrialResult);
    const store = new HandAiAnalyticsStore();
    await store.init();
    store.setCurrentTrialAnalytics({ trialId: 'delete' } as TrialAnalytics);
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    await store.deleteSessions(['delete']);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(OcrPilotService.getCachedTrial('delete')).toBeUndefined();
    expect(await store.getCurrentTrialAnalytics('delete')).toBeNull();
    expect(mockFiles[detailPath('delete')]).toBeUndefined();
    const restarted = new HandAiAnalyticsStore();
    await restarted.init();
    expect(restarted.getSessions().map((item) => item.sessionId)).toEqual(['keep']);
    unsubscribe();
  });

  it('keeps an empty archive after deleting all and restarting', async () => {
    mockFiles[historyPath] = JSON.stringify([session('one')]);
    const store = new HandAiAnalyticsStore();
    await store.clearAllSessions();
    expect(mockFiles[historyPath]).toBe('[]');
    const restarted = new HandAiAnalyticsStore();
    await restarted.init();
    expect(restarted.getSessions()).toEqual([]);
  });

  it('preserves selections while independently saving and removing reference text', async () => {
    mockFiles[historyPath] = JSON.stringify([session('reference')]);
    const store = new HandAiAnalyticsStore();
    await store.setReferenceText('reference', 'line-1', 'Trên cao lưng đồi');
    const updated = store.getSessions()[0].lineMetrics![0];
    expect(updated).toMatchObject({ groundTruthStatus: 'EXPLICIT', referenceSource: 'EXPLICIT_REFERENCE',
      evaluationStatus: 'EVALUATED', isRawCorrect: false, isFinalCorrect: true,
      ocrOutput: 'Trên cao lưng đôi', aiCandidate: 'Trên cao lưng đồi', finalText: 'Trên cao lưng đồi' });
    const restarted = new HandAiAnalyticsStore();
    await restarted.init();
    expect(restarted.getSessions()[0].lineMetrics![0].groundTruth).toBe('Trên cao lưng đồi');
    await restarted.setReferenceText('reference', 'line-1', '  ');
    expect(restarted.getSessions()[0].lineMetrics![0]).toMatchObject({ groundTruth: '', groundTruthStatus: 'MISSING', evaluationStatus: 'PENDING' });
  });

  it('moves the actual native photo into persistent storage and stores JSON outside SecureStore', async () => {
    mockFiles[historyPath] = '[]';
    const store = new HandAiAnalyticsStore();
    const trial = {
      trialId: 'photo', imageUri: 'file:///cache/actual-photo.png', source: 'CAMERA', lines: [{
        lineId: 'line-1', rawOcrText: 'Một dòng', predictedText: 'Một dòng', currentText: 'Một dòng',
        confidence: 0.83, rawOcrConfidence: 0.83, rawOcrConfidenceSource: 'CRNN_CTC_SOFTMAX', selectedSource: 'OCR',
      }],
    } as unknown as MultilineTrialResult;
    const { session: saved } = await store.completeTrial(trial);
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({ from: 'file:///cache/actual-photo.png', to: 'file:///documents/handai-history/image_photo.png' });
    expect(saved.imageUri).toBe('file:///documents/handai-history/image_photo.png');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(mockFiles[historyPath].length).toBeGreaterThan(2048);
    const restarted = new HandAiAnalyticsStore();
    await restarted.init();
    expect(restarted.getSessions()[0].imageUri).toBe(saved.imageUri);
  });

  it('keeps archive and caches intact when deletion cannot be persisted', async () => {
    mockFiles[historyPath] = JSON.stringify([session('keep')]);
    const store = new HandAiAnalyticsStore();
    await store.init();
    OcrPilotService.cacheTrial({ trialId: 'keep' } as MultilineTrialResult);
    (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('Storage full'));
    await expect(store.deleteSessions(['keep'])).rejects.toThrow('Storage full');
    expect(store.getSessions()).toHaveLength(1);
    expect(OcrPilotService.getCachedTrial('keep')).toBeDefined();
  });

  it('does not publish a new recognition when its archive cannot be saved', async () => {
    mockFiles[historyPath] = '[]';
    const store = new HandAiAnalyticsStore();
    await store.init();
    const listener = jest.fn();
    store.subscribe(listener);
    (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('Storage full'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(store.completeTrial({ trialId: 'unsaved', imageUri: 'file:///cache/image.jpg', lines: [{
      lineId: 'line-1', predictedText: 'Một dòng', selectedSource: 'OCR',
    }] } as unknown as MultilineTrialResult)).rejects.toThrow('Storage full');
    expect(store.getSessions()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
    expect(mockFiles[historyPath]).toBe('[]');
  });

  it('keeps real model confidence separate from independently referenced accuracy through completion and restart', async () => {
    mockFiles[historyPath] = '[]';
    const store = new HandAiAnalyticsStore();
    const trial = (id: string, reference?: string, tagged = true) => ({
      trialId: id, imageUri: 'file:///cache/input.jpg', lines: [{
        lineId: 'line-1', rawOcrText: 'Trên cao lưng đôi', predictedText: 'Trên cao lưng đôi',
        currentText: 'Trên cao lưng đồi', finalText: 'Trên cao lưng đồi', selectedSource: 'MANUAL_EDIT',
        verdict: 'CONFIRMED', confidence: 0.99, rawOcrConfidence: tagged ? 0.83 : undefined,
        rawOcrConfidenceSource: tagged ? 'CRNN_CTC_SOFTMAX' : undefined, groundTruth: reference,
      }],
    }) as unknown as MultilineTrialResult;
    const unverified = await store.completeTrial(trial('unverified'));
    expect(buildHandAiDashboardMetrics([unverified.session])).toMatchObject({
      averageConfidence: 83, confidenceLineCount: 1, evaluatedLines: 0, rawAccuracy: null,
      finalAccuracy: null, aiAccuracy: null,
    });
    const referenced = await store.completeTrial(trial('referenced', 'Trên cao lưng đồi'));
    expect(buildHandAiDashboardMetrics([referenced.session])).toMatchObject({
      averageConfidence: 83, evaluatedLines: 1, rawAccuracy: 0, finalAccuracy: 100, aiAccuracy: null,
    });
    const legacy = await store.completeTrial(trial('legacy-score', undefined, false));
    expect(buildHandAiDashboardMetrics([legacy.session])).toMatchObject({
      averageConfidence: null, confidenceLineCount: 0, rawAccuracy: null, finalAccuracy: null,
    });
    const restarted = new HandAiAnalyticsStore();
    await restarted.init();
    expect(buildHandAiDashboardMetrics(restarted.getSessions())).toMatchObject({
      totalSessions: 3, averageConfidence: 83, confidenceLineCount: 2, evaluatedLines: 1,
      rawAccuracy: 0, finalAccuracy: 100, manualEditedLines: 3, aiAccuracy: null,
    });
  });

  it('records no correctness or calibration evidence for accepted text without reference', () => {
    const store = new HandAiAnalyticsStore();
    const analytics = store.computeTrialAnalytics({ trialId: 'no-ref', lines: [{
      lineId: 'line-1', rawOcrText: 'Một dòng', predictedText: 'Một dòng', currentText: 'Một dòng',
      selectedSource: 'OCR', verdict: 'CORRECT', rawOcrConfidence: 0.97,
      rawOcrConfidenceSource: 'CRNN_CTC_SOFTMAX',
    }] } as unknown as MultilineTrialResult, true);
    expect(analytics.rawCorrect).toBe(0);
    expect(analytics.finalCorrect).toBe(0);
    expect(analytics.lineMetrics[0]).toMatchObject({ isRawCorrect: false, isFinalCorrect: false,
      evaluationStatus: 'PENDING', groundTruthStatus: 'MISSING' });
    expect(Number.isNaN(analytics.rawAccuracy)).toBe(true);
    expect(Number.isNaN(analytics.finalAccuracy)).toBe(true);
    expect(analytics.avgConfidence).toBe(97);
    expect(analytics.confidenceCalibration.reduce((sum, bin) => sum + bin.samples, 0)).toBe(0);
    expect(analytics.confidenceReliability.reduce((sum, bin) => sum + bin.samples, 0)).toBe(0);
    expect(analytics.errorRecords).toEqual([]);
  });

  it('calibrates tagged OCR confidence against raw correctness even when final text was corrected', async () => {
    mockFiles[historyPath] = '[]';
    const store = new HandAiAnalyticsStore();
    const trial = { trialId: 'calibration', imageUri: 'file:///cache/input.jpg', lines: [{
      lineId: 'wrong-raw', rawOcrText: 'đôi', currentText: 'đồi', groundTruth: 'đồi',
      selectedSource: 'MANUAL_EDIT', rawOcrConfidence: 0.97, rawOcrConfidenceSource: 'CRNN_CTC_SOFTMAX',
    }, {
      lineId: 'untagged', rawOcrText: 'đồi', currentText: 'đồi', groundTruth: 'đồi', confidence: 0.99,
    }] } as unknown as MultilineTrialResult;
    const result = await store.completeTrial(trial);
    const highBin = result.analytics.confidenceCalibration.find((bin) => bin.range === '90-100%')!;
    expect(highBin).toMatchObject({ samples: 1, correctSamples: 0, accuracy: 0 });
    const global = store.getGlobalAnalytics();
    expect(global.confidenceCalibration.find((bin) => bin.range === '90-100%')).toMatchObject({ samples: 1, correctSamples: 0, accuracy: 0 });
    expect(global.confidenceReliability.reduce((sum, bin) => sum + bin.samples, 0)).toBe(1);
    expect(global.averageConfidence).toBe(97);
    expect(global.rootCauseAnalysis.totalClassified).toBeLessThanOrEqual(global.errorAnalysis.totalErrors);
  });

  it('uses case and punctuation preserving NFC comparison for explicit references', () => {
    const store = new HandAiAnalyticsStore();
    const analytics = store.computeTrialAnalytics({ trialId: 'case', lines: [{
      lineId: 'case-different', rawOcrText: 'Đồi', currentText: 'Đồi', groundTruth: 'đồi',
    }, {
      lineId: 'unicode-equivalent', rawOcrText: 'đồi'.normalize('NFD'), currentText: 'đồi', groundTruth: 'đồi',
    }] } as unknown as MultilineTrialResult, true);
    expect(analytics.lineMetrics[0].isRawCorrect).toBe(false);
    expect(analytics.lineMetrics[1].isRawCorrect).toBe(true);
    expect(analytics.rawAccuracy).toBe(50);
    expect(analytics.finalAccuracy).toBe(50);
  });
});

describe('Recognition history controls', () => {
  let renderer: any;
  beforeEach(() => {
    jest.spyOn(handAiAnalyticsStore, 'init').mockResolvedValue();
    jest.spyOn(handAiAnalyticsStore, 'cleanupIncompleteSessions').mockResolvedValue(0);
    jest.spyOn(handAiAnalyticsStore, 'subscribe').mockImplementation(() => () => {});
    jest.spyOn(handAiAnalyticsStore, 'getSessions').mockReturnValue([session('one'), session('two')]);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(async () => {
    if (renderer) await act(async () => { renderer.unmount(); });
    renderer = null;
    jest.restoreAllMocks();
  });

  it('opens stored attempt details and displays measured line scores with their scope', async () => {
    await act(async () => { renderer = TestRenderer.create(<EvaluationHistoryScreen />); });
    const text = renderedText(renderer);
    expect(text).toContain('OCR score (uncalibrated):');
    expect(text).toContain('83');
    expect(text).toContain('scored lines');
    expect(text).not.toContain('Mean Confidence');
    await act(async () => { renderer.root.findAllByProps({ testID: 'history-card-one' })[0].props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/handai-trial-analytics', params: { trialId: 'one' } });
  });

  it('requires confirmation before selected attempts are deleted', async () => {
    const deleteSessions = jest.spyOn(handAiAnalyticsStore, 'deleteSessions').mockResolvedValue();
    await act(async () => { renderer = TestRenderer.create(<EvaluationHistoryScreen />); });
    await act(async () => { renderer.root.findAllByProps({ accessibilityLabel: 'Select recognition attempts' })[0].props.onPress(); });
    await act(async () => { renderer.root.findAllByProps({ testID: 'history-select-one' })[0].props.onPress(); });
    await act(async () => { renderer.root.findAllByProps({ testID: 'history-delete-selected' })[0].props.onPress(); });
    expect(deleteSessions).not.toHaveBeenCalled();
    const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)![2];
    expect(buttons[0]).toMatchObject({ text: 'Cancel', style: 'cancel' });
    await act(async () => { buttons[1].onPress(); });
    expect(deleteSessions).toHaveBeenCalledWith(['one']);
  });

  it('requires confirmation before the full archive is cleared', async () => {
    const clearAll = jest.spyOn(handAiAnalyticsStore, 'clearAllSessions').mockResolvedValue();
    await act(async () => { renderer = TestRenderer.create(<EvaluationHistoryScreen />); });
    await act(async () => { renderer.root.findAllByProps({ testID: 'history-delete-all' })[0].props.onPress(); });
    expect(clearAll).not.toHaveBeenCalled();
    const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)![2];
    await act(async () => { buttons[1].onPress(); });
    expect(clearAll).toHaveBeenCalledTimes(1);
  });
});

describe('Stored score display boundaries', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 101])('hides invalid tagged OCR and AI scores (%s)', async (invalid) => {
    let renderer: any;
    const line = { ...session('scores').lineMetrics![0], confidence: invalid,
      aiSuggestions: [{ text: 'Trên cao lưng đồi', confidence: invalid, confidenceSource: 'AI_SELF_REPORTED' }] };
    await act(async () => { renderer = TestRenderer.create(<StoredLineReview sessionId="scores" line={line as any} />); });
    const text = renderedText(renderer);
    expect(text).toContain('Score not recorded');
    expect(text).not.toContain('AI self-reported score');
    expect(text).toContain('Trên cao lưng đồi');
    await act(async () => { renderer.unmount(); });
  });
});
