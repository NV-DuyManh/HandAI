import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';
import { isHandAIMode } from './appMode';

export interface ResolveOptions {
  manualOverride?: string;
}

/**
 * Robustly inspects across Expo SDK 50-57 and React Native packager sources
 * to extract the active Metro bundler host IP or hostname.
 */
export function extractMetroHost(): string {
  if (Platform.OS === 'web') return '';
  const c = Constants as any;
  const metroHostUri =
    c?.expoGoConfig?.debuggerHost ||
    c?.expoConfig?.hostUri ||
    c?.expoConfig?.extra?.expoGo?.debuggerHost ||
    c?.expoConfig?.extra?.expoClient?.hostUri ||
    c?.experienceUrl ||
    c?.linkingUri ||
    NativeModules?.SourceCode?.scriptURL ||
    c?.manifest?.hostUri ||
    c?.manifest?.debuggerHost ||
    c?.manifest2?.extra?.expoGo?.debuggerHost ||
    '';

  if (!metroHostUri) return '';
  const match = metroHostUri.match(/^(?:https?:\/\/|exp:\/\/)?([^/:]+)/i);
  return match ? match[1] : metroHostUri.split(':')[0];
}

export function resolveApiBaseUrl(options?: ResolveOptions | string): string {
  const isWeb = Platform.OS === 'web';
  const isAndroid = Platform.OS === 'android';
  const isPhysicalDevice = Boolean(Constants?.isDevice);

  const env = process.env || {};
  const getEnv = (key: string): string => {
    const val = env[key];
    return typeof val === 'string' ? val.trim() : '';
  };

  const cleanUrl = (url: string) => {
    let u = url.trim();
    if (u.endsWith('/')) u = u.slice(0, -1);
    return u;
  };

  const isLoopback = (url: string) => {
    return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('::1') || url.includes('10.0.2.2');
  };

  const targetPort = isHandAIMode() ? (getEnv('EXPO_PUBLIC_BACKEND_PORT') || '8080') : '8080';

  // 0. Production
  if (!__DEV__) {
    const prodUrl = getEnv('EXPO_PUBLIC_API_BASE_URL') || (isHandAIMode() ? `http://127.0.0.1:${targetPort}/api/v1` : 'https://api.mathvisionkids.com/api/v1');
    return cleanUrl(prodUrl);
  }

  let resolvedUrl = '';
  let selectedSource = 'UNKNOWN';
  const metroHostUri = extractMetroHost();

  // 1. Check for EXPLICIT manual override:
  const customArgOverride = typeof options === 'string' ? options : options?.manualOverride;
  const explicitOverride = 
    (customArgOverride && customArgOverride.trim()) ||
    getEnv('EXPO_PUBLIC_API_OVERRIDE') ||
    getEnv('EXPO_PUBLIC_DEV_API_BASE_URL') ||
    getEnv('EXPO_PUBLIC_API_URL') ||
    (getEnv('EXPO_PUBLIC_FORCE_API_URL') === 'true' ? getEnv('EXPO_PUBLIC_API_BASE_URL') : '') ||
    '';

  if (explicitOverride) {
    if (isPhysicalDevice && isLoopback(explicitOverride)) {
      console.warn('[API_RESOLVER] Ignoring loopback override on physical device:', explicitOverride);
    } else if (isAndroid && !isPhysicalDevice && (explicitOverride.includes('localhost') || explicitOverride.includes('127.0.0.1'))) {
      // Automatically map localhost to 10.0.2.2 on Android Emulator
      resolvedUrl = cleanUrl(explicitOverride.replace(/localhost|127\.0\.0\.1/, '10.0.2.2'));
      selectedSource = 'EMULATOR_MAPPED';
    } else {
      resolvedUrl = cleanUrl(explicitOverride);
      selectedSource = 'MANUAL_OVERRIDE';
    }
  }

  // Priority 1: Expo Metro LAN Host Detection (automatic LAN detection)
  if (!resolvedUrl && !isWeb && metroHostUri) {
    if (!isLoopback(metroHostUri)) {
      resolvedUrl = `http://${metroHostUri}:${targetPort}/api/v1`;
      selectedSource = 'METRO_LAN';
    }
  }

  // Priority 2: General Environment Override (fallback when Metro LAN host is not detected)
  if (!resolvedUrl) {
    const generalEnvUrl = getEnv('EXPO_PUBLIC_API_BASE_URL');
    if (generalEnvUrl) {
      if (isPhysicalDevice && isLoopback(generalEnvUrl)) {
        // Reject loopback on physical device
      } else {
        resolvedUrl = cleanUrl(generalEnvUrl);
        selectedSource = 'ENV_FALLBACK';
      }
    }
  }

  // Priority 3: Localhost / Emulator Fallbacks
  if (!resolvedUrl) {
    if (isWeb) {
      resolvedUrl = `http://127.0.0.1:${targetPort}/api/v1`;
      selectedSource = 'WEB_LOCALHOST';
    } else if (!isPhysicalDevice) {
      resolvedUrl = isAndroid ? `http://10.0.2.2:${targetPort}/api/v1` : `http://127.0.0.1:${targetPort}/api/v1`;
      selectedSource = 'EMULATOR_LOCALHOST';
    } else {
      resolvedUrl = `http://127.0.0.1:${targetPort}/api/v1`;
      selectedSource = 'LOCALHOST_FALLBACK';
    }
  }

  resolvedUrl = cleanUrl(resolvedUrl);

  return resolvedUrl;
}

/**
 * Dynamically resolves FastAPI AI service endpoint (Port 8001 default in HandAI mode).
 */
export function resolveAiServiceUrl(options?: ResolveOptions | string): string {
  const isWeb = Platform.OS === 'web';
  const isAndroid = Platform.OS === 'android';
  const isPhysicalDevice = Boolean(Constants?.isDevice);

  const env = process.env || {};
  const getEnv = (key: string): string => {
    const val = env[key];
    return typeof val === 'string' ? val.trim() : '';
  };

  const cleanUrl = (url: string) => {
    let u = url.trim();
    if (u.endsWith('/')) u = u.slice(0, -1);
    return u;
  };

  const isLoopback = (url: string) => {
    return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('::1') || url.includes('10.0.2.2');
  };

  const defaultPort = getEnv('EXPO_PUBLIC_AI_PORT') || '8001';

  const customArgOverride = typeof options === 'string' ? options : options?.manualOverride;
  const explicitOverride =
    (customArgOverride && customArgOverride.trim()) ||
    getEnv('EXPO_PUBLIC_AI_SERVICE_OVERRIDE') ||
    getEnv('EXPO_PUBLIC_AI_SERVICE_URL') ||
    '';

  if (explicitOverride) {
    if (isPhysicalDevice && isLoopback(explicitOverride)) {
      console.warn('[AI_RESOLVER] Ignoring loopback override on physical device:', explicitOverride);
    } else if (isAndroid && !isPhysicalDevice && (explicitOverride.includes('localhost') || explicitOverride.includes('127.0.0.1'))) {
      return cleanUrl(explicitOverride.replace(/localhost|127\.0\.0\.1/, '10.0.2.2'));
    } else {
      return cleanUrl(explicitOverride);
    }
  }

  // Priority 1: Metro LAN Host
  if (!isWeb) {
    const host = extractMetroHost();
    if (host && !isLoopback(host)) {
      return `http://${host}:${defaultPort}`;
    }
  }

  // Priority 2: Fallback
  if (isWeb) {
    return `http://127.0.0.1:${defaultPort}`;
  }
  if (isAndroid && !isPhysicalDevice) {
    return `http://10.0.2.2:${defaultPort}`;
  }
  return `http://127.0.0.1:${defaultPort}`;
}
