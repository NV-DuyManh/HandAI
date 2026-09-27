import { getAppMode, isHandAIMode, getAppBranding, getFeatureFlags } from '../appMode';
import { ENV } from '../env';
import { COLORS, MATHVISION_COLORS, HAND_AI_COLORS, getThemeColors } from '../../constants/theme';

describe('AppMode Configuration & Theme Switching', () => {
  const originalEnv = process.env.EXPO_PUBLIC_APP_MODE;

  afterEach(() => {
    process.env.EXPO_PUBLIC_APP_MODE = originalEnv;
  });

  describe('Default & MATHVISION_KIDS Mode', () => {
    it('defaults to MATHVISION_KIDS when EXPO_PUBLIC_APP_MODE is unset', () => {
      delete process.env.EXPO_PUBLIC_APP_MODE;
      expect(getAppMode()).toBe('MATHVISION_KIDS');
      expect(isHandAIMode()).toBe(false);
      expect(ENV.APP_MODE).toBe('MATHVISION_KIDS');
      expect(ENV.IS_HAND_AI).toBe(false);
    });

    it('activates MATHVISION_KIDS when explicitly configured', () => {
      process.env.EXPO_PUBLIC_APP_MODE = 'MATHVISION_KIDS';
      expect(getAppMode()).toBe('MATHVISION_KIDS');
      expect(isHandAIMode()).toBe(false);

      const branding = getAppBranding();
      expect(branding.name).toBe('MathVision Kids');
      expect(branding.tagline).toBe('Chụp bài • Hiểu lỗi • Tự sửa');

      const flags = getFeatureFlags();
      expect(flags.showMathCalculations).toBe(true);
      expect(flags.showArithmeticMode).toBe(true);
      expect(flags.showHandwritingPipeline).toBe(true);

      const theme = getThemeColors();
      expect(theme.primary).toBe(MATHVISION_COLORS.primary);
      expect(COLORS.primary).toBe('#2563EB');
    });
  });

  describe('HAND_AI Mode', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_APP_MODE = 'HAND_AI';
    });

    it('activates HAND_AI mode from EXPO_PUBLIC_APP_MODE=HAND_AI', () => {
      expect(getAppMode()).toBe('HAND_AI');
      expect(isHandAIMode()).toBe(true);
      expect(ENV.APP_MODE).toBe('HAND_AI');
      expect(ENV.IS_HAND_AI).toBe(true);
    });

    it('provides accurate HandAI identity, scope and required features', () => {
      const branding = getAppBranding();
      expect(branding.name).toBe('HandAI');
      expect(branding.subtitle).toBe('Vietnamese Handwriting Recognition System');
      expect(branding.detailedSubtitle).toBe('Primary Students Grade 1-5');
      expect(branding.features).toEqual([
        'Image Acquisition',
        'Preprocessing',
        'Line Segmentation',
        'Handwriting Recognition',
        'Result Analysis',
      ]);
    });

    it('isolates features: bypasses login and privacy masking, hides math calculations', () => {
      const flags = getFeatureFlags();
      expect(flags.bypassLogin).toBe(true);
      expect(flags.bypassPrivacyMasking).toBe(true);
      expect(flags.showMathCalculations).toBe(false);
      expect(flags.showArithmeticMode).toBe(false);
      expect(flags.showHandwritingPipeline).toBe(true);
      expect(flags.showPrivacyProtection).toBe(false);
      expect(flags.showExerciseHistory).toBe(true);
      expect(flags.showCaptureTips).toBe(true);
    });

    it('applies the temporary HandAI theme without overwriting MathVision theme tokens', () => {
      const activeTheme = getThemeColors();
      expect(activeTheme.primary).toBe(HAND_AI_COLORS.primary);
      expect(activeTheme.primary).toBe('#1E40AF');
      expect(COLORS.primary).toBe('#1E40AF');

      // Verify MathVision colors remain intact
      expect(MATHVISION_COLORS.primary).toBe('#2563EB');
      expect(MATHVISION_COLORS.secondary).toBe('#F59E0B');
    });
  });
});
