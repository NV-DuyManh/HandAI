import { submissionDraftStore } from '../services/draft/submissionDraftStore';
import * as appModeModule from '../config/appMode';
import { normalizeOcrError } from '../services/api/OcrPilotService';

describe('HandAI Flow Fix V5 - Image Pipeline & Auth Isolation', () => {
  const originalEnv = process.env.EXPO_PUBLIC_APP_MODE;

  afterEach(() => {
    process.env.EXPO_PUBLIC_APP_MODE = originalEnv;
    submissionDraftStore.clearDraft();
    jest.restoreAllMocks();
  });

  describe('Part 1: Image Pipeline Isolation', () => {
    it('in HAND_AI mode: ignores privacyImageUri and ensures sourceImageUri is original', () => {
      process.env.EXPO_PUBLIC_APP_MODE = 'HAND_AI';
      jest.spyOn(appModeModule, 'isHandAIMode').mockReturnValue(true);

      const originalUri = 'file:///photos/notebook_clean.jpg';
      const privacyScreenshotUri = 'file:///cache/viewshot_privacy_header_and_buttons.jpg';

      submissionDraftStore.setDraft({
        uri: originalUri,
        sourceImageUri: originalUri,
        privacyImageUri: privacyScreenshotUri,
        isMasked: true,
      });

      const draft = submissionDraftStore.getDraft();

      expect(draft).not.toBeNull();
      expect(draft?.sourceImageUri).toBe(originalUri);
      expect(draft?.uri).toBe(originalUri);
      // HAND_AI must NEVER use privacyImageUri or masked flag
      expect(draft?.privacyImageUri).toBeUndefined();
      expect(draft?.isMasked).toBe(false);
    });

    it('in MATHVISION mode: preserves privacyImageUri and masked state for child privacy', () => {
      process.env.EXPO_PUBLIC_APP_MODE = 'MATHVISION_KIDS';
      jest.spyOn(appModeModule, 'isHandAIMode').mockReturnValue(false);

      const originalUri = 'file:///photos/kid_exercise.jpg';
      const privacyUri = 'file:///cache/masked_privacy.jpg';

      submissionDraftStore.setDraft({
        uri: privacyUri,
        sourceImageUri: originalUri,
        privacyImageUri: privacyUri,
        isMasked: true,
      });

      const draft = submissionDraftStore.getDraft();

      expect(draft).not.toBeNull();
      expect(draft?.sourceImageUri).toBe(originalUri);
      expect(draft?.uri).toBe(privacyUri);
      expect(draft?.privacyImageUri).toBe(privacyUri);
      expect(draft?.isMasked).toBe(true);
    });
  });

  describe('Part 2: Auth Isolation (No Login / Token Guard in HAND_AI)', () => {
    it('in HAND_AI mode: normalizeOcrError converts 401 into "Backend authentication unavailable" without redirecting', () => {
      process.env.EXPO_PUBLIC_APP_MODE = 'HAND_AI';
      jest.spyOn(appModeModule, 'isHandAIMode').mockReturnValue(true);

      const error401 = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      };

      const normalized = normalizeOcrError(error401);

      expect(normalized.title).toBe('Recognition Service Unavailable');
      expect(normalized.message).toContain('The handwriting recognition service is currently unavailable');
    });

    it('in MATHVISION mode: normalizeOcrError preserves session expired handling', () => {
      process.env.EXPO_PUBLIC_APP_MODE = 'MATHVISION_KIDS';
      jest.spyOn(appModeModule, 'isHandAIMode').mockReturnValue(false);

      const error401 = {
        response: {
          status: 401,
          data: { message: 'Session expired' },
        },
      };

      const normalized = normalizeOcrError(error401);

      expect(normalized.title).toBe('Phiên đăng nhập hết hạn');
    });
  });
});
