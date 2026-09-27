import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';
import { isHandAIMode } from './appMode';

export interface ResolveOptions {
  manualOverride?: string;
}

export function resolveApiBaseUrl(options?: ResolveOptions | string): string {
  const isWeb = Platform.OS === 'web';
  const isAndroid = Platform.OS === 'android';
  
  // Determine if it's a physical device. Expo Constants.isDevice is true for physical devices.
  const isPhysicalDevice = Boolean(Constants?.isDevice);

  // Dynamic access helper prevents Babel/Metro transform from statically inlining empty strings in test/dev
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

  // 0. Production
  if (!__DEV__) {
    const prodUrl = getEnv('EXPO_PUBLIC_API_BASE_URL') || 'https://api.mathvisionkids.com/api/v1';
    return cleanUrl(prodUrl);
  }

  const isLoopback = (url: string) => {
    return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('::1') || url.includes('10.0.2.2');
  };

  let resolvedUrl = '';
  let selectedSource = 'UNKNOWN';
  let metroHostUri = '';

  // Check for EXPLICIT manual override:
  // Provided via function argument (string or object), EXPO_PUBLIC_API_OVERRIDE, or EXPO_PUBLIC_DEV_API_BASE_URL
  const customArgOverride = typeof options === 'string' ? options : options?.manualOverride;
  const explicitOverride = 
    (customArgOverride && customArgOverride.trim()) ||
    getEnv('EXPO_PUBLIC_API_OVERRIDE') ||
    getEnv('EXPO_PUBLIC_DEV_API_BASE_URL') ||
    (getEnv('EXPO_PUBLIC_FORCE_API_URL') === 'true' ? getEnv('EXPO_PUBLIC_API_BASE_URL') : '') ||
    '';

  // If explicit manual override is configured by developer, it takes precedence
  if (explicitOverride) {
    if (isPhysicalDevice && isLoopback(explicitOverride)) {
      // Reject loopback on physical device (cannot reach dev machine via loopback)
      console.warn('[API_RESOLVER] Ignoring loopback override on physical device:', explicitOverride);
    } else {
      resolvedUrl = cleanUrl(explicitOverride);
      selectedSource = 'MANUAL_OVERRIDE';
    }
  }

  // Priority 1: Expo Metro LAN Host Detection (automatic LAN detection)
  if (!resolvedUrl && !isWeb) {
    // Robust inspection across modern Expo SDK 50-57 and React Native packager sources
    const c = Constants as any;
    metroHostUri = 
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

    if (metroHostUri) {
      // Extract hostname/IP robustly from formats like:
      // "192.168.1.14:8081", "exp://192.168.1.14:8081", "http://192.168.1.14:8081/index.bundle?..."
      const match = metroHostUri.match(/^(?:https?:\/\/|exp:\/\/)?([^/:]+)/i);
      const host = match ? match[1] : metroHostUri.split(':')[0];
      
      const defaultPort = isHandAIMode() ? '8082' : '8080';
      const targetPort = getEnv('EXPO_PUBLIC_BACKEND_PORT') || defaultPort;

      if (host && !isLoopback(host)) {
        resolvedUrl = `http://${host}:${targetPort}/api/v1`;
        selectedSource = 'METRO_LAN';
      }
    }
  }

  const defaultPort = isHandAIMode() ? '8082' : '8080';
  const targetPort = getEnv('EXPO_PUBLIC_BACKEND_PORT') || defaultPort;

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

  // Priority 3: Localhost / Emulator Fallbacks (NO hardcoded LAN IPs!)
  if (!resolvedUrl) {
    if (isWeb) {
      resolvedUrl = `http://127.0.0.1:${targetPort}/api/v1`;
      selectedSource = 'WEB_LOCALHOST';
    } else if (!isPhysicalDevice) {
      resolvedUrl = isAndroid ? `http://10.0.2.2:${targetPort}/api/v1` : `http://127.0.0.1:${targetPort}/api/v1`;
      selectedSource = 'EMULATOR_LOCALHOST';
    } else {
      // Physical device safe fallback: NEVER throw unhandled exception at top-level module load.
      // Fall back safely without hardcoding any temporary LAN IP.
      resolvedUrl = `http://127.0.0.1:${targetPort}/api/v1`;
      selectedSource = 'LOCALHOST_FALLBACK';
      console.warn('[API_RESOLVER] Metro host unresolved dynamically; using safe fallback:', resolvedUrl);
    }
  }

  resolvedUrl = cleanUrl(resolvedUrl);

  console.log('[API_RESOLVER]', {
    platform: Platform.OS,
    physicalDevice: isPhysicalDevice,
    dev: __DEV__,
    override: explicitOverride ? 'SET' : 'NOT_SET',
    metroHost: metroHostUri || 'NONE',
    selectedSource,
    resolvedBaseURL: resolvedUrl
  });

  return resolvedUrl;
}
