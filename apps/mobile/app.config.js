/**
 * Dynamic Expo Configuration for MathVision Kids & HandAI Research Demo Mode
 *
 * Precedence & Rules:
 * - MATHVISION_KIDS (Default / unset EXPO_PUBLIC_APP_MODE):
 *   Uses original MathVisionKid native identity, splash, and scheme.
 * - HAND_AI (EXPO_PUBLIC_APP_MODE=HAND_AI):
 *   Activates HandAI research demo native branding:
 *   App Name: HandAI
 *   Slug: hand-ai
 *   Scheme: handai
 *   Icon: ./assets/images/handai-icon.png
 *   Splash Background: #0B192C (Deep Navy AI Laboratory)
 *   Splash Image: ./assets/images/handai-splash.png
 *   Android Package: com.handai.research
 *   Adaptive Icon: ./assets/images/handai-adaptive-icon.png
 */

module.exports = ({ config }) => {
  const appMode = process.env.EXPO_PUBLIC_APP_MODE || process.env.APP_MODE;
  const isHandAI = appMode === 'HAND_AI';

  if (isHandAI) {
    return {
      ...config,
      name: 'HandAI',
      slug: 'hand-ai',
      scheme: 'handai',
      icon: './assets/images/handai-icon.png',
      android: {
        ...(config.android || {}),
        package: 'com.handai.research',
        adaptiveIcon: {
          backgroundColor: '#0B192C',
          foregroundImage: './assets/images/handai-adaptive-icon.png',
          backgroundImage: config.android?.adaptiveIcon?.backgroundImage || './assets/images/android-icon-background.png',
          monochromeImage: config.android?.adaptiveIcon?.monochromeImage || './assets/images/android-icon-monochrome.png',
        },
      },
      web: {
        ...(config.web || {}),
        favicon: './assets/images/handai-favicon.png',
      },
      plugins: [
        'expo-router',
        [
          'expo-splash-screen',
          {
            backgroundColor: '#0B192C',
            image: './assets/images/handai-splash.png',
            imageWidth: 120,
          },
        ],
        'expo-secure-store',
      ],
      extra: {
        ...(config.extra || {}),
        appName: 'HandAI',
        appMode: 'HAND_AI',
        subtitle: 'Vietnamese Handwriting Recognition System',
        scope: 'Primary Students Grade 1-5',
      },
    };
  }

  // Preserve 100% of existing MathVision Kids configuration
  return config;
};
