import { resolveApiBaseUrl } from './apiResolver';
import { getAppMode, isHandAIMode, AppMode } from './appMode';

export const ENV = {
  // Dynamically resolves Metro LAN IP, explicit manual override, or localhost fallback.
  get API_BASE_URL(): string {
    return resolveApiBaseUrl();
  },
  USE_MOCK: process.env.EXPO_PUBLIC_USE_MOCK === 'true',
  get APP_MODE(): AppMode {
    return getAppMode();
  },
  get IS_HAND_AI(): boolean {
    return isHandAIMode();
  },
};

