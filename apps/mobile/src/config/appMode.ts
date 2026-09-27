export type AppMode = 'MATHVISION_KIDS' | 'HAND_AI';

export interface AppBranding {
  name: string;
  subtitle: string;
  detailedSubtitle: string;
  datasetScope?: string;
  tagline: string;
  badgeText: string;
  features: string[];
  featuresVi: string[];
}

export interface AppFeatureFlags {
  bypassLogin: boolean;
  bypassPrivacyMasking: boolean;
  showMathCalculations: boolean;
  showArithmeticMode: boolean;
  showHandwritingPipeline: boolean;
  showPrivacyProtection: boolean;
  showExerciseHistory: boolean;
  showCaptureTips: boolean;
}

import Constants from 'expo-constants';

/**
 * Resolves active application mode from environment configuration.
 * Default is 'MATHVISION_KIDS' preserving 100% of existing functionality.
 * 'HAND_AI' activates temporary Big Data handwriting recognition demo mode.
 */
export function getAppMode(): AppMode {
  const envMode =
    process.env.EXPO_PUBLIC_APP_MODE ||
    (Constants.expoConfig?.extra as any)?.appMode ||
    (Constants.manifest as any)?.extra?.appMode ||
    ((Constants as any).manifest2?.extra?.expoClient?.extra as any)?.appMode;

  if (envMode === 'HAND_AI') {
    return 'HAND_AI';
  }
  return 'MATHVISION_KIDS';
}

export function isHandAIMode(): boolean {
  return getAppMode() === 'HAND_AI';
}

export function getAppBranding(mode?: AppMode): AppBranding {
  const activeMode = mode ?? getAppMode();

  if (activeMode === 'HAND_AI') {
    return {
      name: 'HandAI',
      subtitle: 'Vietnamese Handwriting Recognition System',
      detailedSubtitle: 'Primary Students Grade 1-5',
      datasetScope: 'Grade 1-5 Student Handwriting Dataset',
      tagline: 'Vietnamese Handwriting Recognition System • Grade 1-5 Student Handwriting Dataset',
      badgeText: 'BIG DATA RESEARCH DEMO',
      features: [
        'Image Acquisition',
        'Preprocessing',
        'Line Segmentation',
        'Handwriting Recognition',
        'Result Analysis',
      ],
      featuresVi: [
        'Thu nhận hình ảnh',
        'Tiền xử lý ảnh',
        'Phân đoạn từng dòng',
        'Nhận diện chữ viết tay',
        'Phân tích kết quả AI',
      ],
    };
  }

  return {
    name: 'MathVision Kids',
    subtitle: 'Cùng em nhận diện và rèn luyện chữ viết tay mỗi ngày',
    detailedSubtitle: 'Trợ lý toán học cho học sinh tiểu học',
    tagline: 'Chụp bài • Hiểu lỗi • Tự sửa',
    badgeText: 'MATHVISION KIDS',
    features: [
      'Chụp và nhận diện bài làm',
      'Phát hiện dòng và phép tính',
      'Chỉ ra lỗi sai từng bước',
      'Gợi ý tự sửa bài tập',
    ],
    featuresVi: [
      'Chụp và nhận diện bài làm',
      'Phát hiện dòng và phép tính',
      'Chỉ ra lỗi sai từng bước',
      'Gợi ý tự sửa bài tập',
    ],
  };
}

export function getFeatureFlags(mode?: AppMode): AppFeatureFlags {
  const isHandAI = (mode ?? getAppMode()) === 'HAND_AI';

  return {
    bypassLogin: isHandAI,
    bypassPrivacyMasking: isHandAI,
    showMathCalculations: !isHandAI,
    showArithmeticMode: !isHandAI,
    showHandwritingPipeline: true,
    showPrivacyProtection: !isHandAI,
    showExerciseHistory: true,
    showCaptureTips: true,
  };
}
