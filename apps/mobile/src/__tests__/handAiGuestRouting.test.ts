import * as appModeModule from '../config/appMode';
import { OcrPilotService } from '../services/api/OcrPilotService';
import apiClient from '../services/api/apiClient';

jest.mock('../services/api/apiClient', () => {
  return {
    defaults: { baseURL: 'http://127.0.0.1:8080/api/v1', headers: { common: {} } },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    post: jest.fn(),
    get: jest.fn(),
  };
});

describe('HandAI Guest API Routing (Fix V7)', () => {
  const originalEnv = process.env.EXPO_PUBLIC_APP_MODE;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_APP_MODE = originalEnv;
    jest.restoreAllMocks();
  });

  it('in HAND_AI mode: routes detectLines to /handai/ocr/multiline/detect without auth', async () => {
    process.env.EXPO_PUBLIC_APP_MODE = 'HAND_AI';
    jest.spyOn(appModeModule, 'isHandAIMode').mockReturnValue(true);

    const mockResponse = {
      data: {
        width: 800,
        height: 600,
        lines: [
          { line_id: 'line_1', x: 10, y: 20, width: 300, height: 40, order: 1 },
        ],
        detectorVersion: 'v2.1_morphology',
      },
    };
    (apiClient.post as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await OcrPilotService.detectLines('file:///test/notebook.jpg');

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const calledUrl = (apiClient.post as jest.Mock).mock.calls[0][0];
    expect(calledUrl).toBe('/handai/ocr/multiline/detect');
    expect(result.lines?.length).toBe(1);
  });

  it('in MATHVISION mode: routes detectLines to /ocr/multiline/detect with standard auth requirement', async () => {
    process.env.EXPO_PUBLIC_APP_MODE = 'MATHVISION_KIDS';
    jest.spyOn(appModeModule, 'isHandAIMode').mockReturnValue(false);

    const mockResponse = {
      data: {
        width: 800,
        height: 600,
        lines: [
          { line_id: 'line_1', x: 10, y: 20, width: 300, height: 40, order: 1 },
        ],
        detectorVersion: 'v2.1_morphology',
      },
    };
    (apiClient.post as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await OcrPilotService.detectLines('file:///test/exercise.jpg');

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const calledUrl = (apiClient.post as jest.Mock).mock.calls[0][0];
    expect(calledUrl).toBe('/ocr/multiline/detect');
    expect(result.lines?.length).toBe(1);
  });

  it('in HAND_AI mode: routes createMultilineTrial to /handai/ocr/multiline/trials', async () => {
    process.env.EXPO_PUBLIC_APP_MODE = 'HAND_AI';
    jest.spyOn(appModeModule, 'isHandAIMode').mockReturnValue(true);

    const mockTrialResponse = {
      data: {
        trialId: 'test-trial-123',
        status: 'COMPLETED',
        lines: [],
      },
    };
    (apiClient.post as jest.Mock).mockResolvedValueOnce(mockTrialResponse);

    const result = await OcrPilotService.createMultilineTrial(
      'file:///test/notebook.jpg',
      [{ line_id: 'l1', x: 0, y: 10, width: 100, height: 20, order: 1 }]
    );

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const calledUrl = (apiClient.post as jest.Mock).mock.calls[0][0];
    expect(calledUrl).toBe('/handai/ocr/multiline/trials');
    expect(result.trialId).toBe('test-trial-123');
  });
});
