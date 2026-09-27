import { resolveApiBaseUrl } from '../apiResolver';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Mock dependencies
jest.mock('expo-constants', () => ({
  isDevice: true,
  expoConfig: {
    hostUri: '192.168.1.14:8081',
  },
  expoGoConfig: {
    debuggerHost: '192.168.1.14:8081',
  },
}));

describe('apiResolver - Dynamic Mobile API Host Resolution', () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...origEnv };
    (Constants as any).isDevice = true;
    (Constants as any).expoConfig = { hostUri: '192.168.1.14:8081' };
    (Constants as any).expoGoConfig = { debuggerHost: '192.168.1.14:8081' };
    (Platform as any).OS = 'android';
  });

  afterAll(() => {
    process.env = origEnv;
  });

  test('Test A: Old .env.local IP exists -> no permanent failure, follows Metro LAN host', () => {
    // Simulate stale .env.local holding old laptop IP 192.168.1.10
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://192.168.1.10:8080/api/v1';

    // Metro host is running on active WiFi IP 192.168.1.14
    (Constants as any).expoConfig = { hostUri: '192.168.1.14:8081' };
    (Constants as any).expoGoConfig = { debuggerHost: '192.168.1.14:8081' };

    const resolved = resolveApiBaseUrl();

    // Priority 1 Metro LAN host MUST win over stale .env.local default
    expect(resolved).toBe('http://192.168.1.14:8080/api/v1');
    expect(resolved).not.toContain('192.168.1.10');
  });

  test('Test B: Metro host changes -> API dynamically follows new Metro host', () => {
    // Router re-assigned IP to 192.168.1.25
    (Constants as any).expoConfig = { hostUri: '192.168.1.25:8081' };
    (Constants as any).expoGoConfig = { debuggerHost: '192.168.1.25:8081' };

    const resolved = resolveApiBaseUrl();
    expect(resolved).toBe('http://192.168.1.25:8080/api/v1');
  });

  test('Test C1: Manual override via parameter -> override works', () => {
    const resolved = resolveApiBaseUrl('http://10.20.30.40:8080/api/v1');
    expect(resolved).toBe('http://10.20.30.40:8080/api/v1');
  });

  test('Test C2: Manual override via EXPO_PUBLIC_API_OVERRIDE -> override works', () => {
    process.env.EXPO_PUBLIC_API_OVERRIDE = 'http://10.20.30.50:8080/api/v1';

    const resolved = resolveApiBaseUrl();
    expect(resolved).toBe('http://10.20.30.50:8080/api/v1');
  });

  test('Test C3: Manual override via EXPO_PUBLIC_DEV_API_BASE_URL -> override works', () => {
    process.env.EXPO_PUBLIC_DEV_API_BASE_URL = 'http://10.20.30.60:8080/api/v1';

    const resolved = resolveApiBaseUrl();
    expect(resolved).toBe('http://10.20.30.60:8080/api/v1');
  });

  test('Test D: Backend unavailable / Metro host not detected -> Safe localhost fallback, no hardcoded LAN IP', () => {
    // No Metro host detected
    (Constants as any).expoConfig = { hostUri: '' };
    (Constants as any).expoGoConfig = { debuggerHost: '' };
    delete process.env.EXPO_PUBLIC_API_OVERRIDE;
    delete process.env.EXPO_PUBLIC_DEV_API_BASE_URL;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    // Physical device with no host and no override
    const resolvedPhysical = resolveApiBaseUrl();
    expect(resolvedPhysical).toBe('http://127.0.0.1:8080/api/v1');
    expect(resolvedPhysical).not.toBe('http://192.168.1.10:8080/api/v1');

    // Android emulator
    (Constants as any).isDevice = false;
    (Platform as any).OS = 'android';
    const resolvedEmulator = resolveApiBaseUrl();
    expect(resolvedEmulator).toBe('http://10.0.2.2:8080/api/v1');

    // Web
    (Platform as any).OS = 'web';
    const resolvedWeb = resolveApiBaseUrl();
    expect(resolvedWeb).toBe('http://127.0.0.1:8080/api/v1');
  });

  test('Test E: Physical device rejects loopback override, uses Metro LAN instead', () => {
    (Constants as any).isDevice = true;
    (Constants as any).expoConfig = { hostUri: '192.168.1.14:8081' };
    (Constants as any).expoGoConfig = { debuggerHost: '192.168.1.14:8081' };
    process.env.EXPO_PUBLIC_API_OVERRIDE = 'http://localhost:8080/api/v1';

    const resolved = resolveApiBaseUrl();
    // On physical device, localhost is rejected and Metro LAN host is preferred
    expect(resolved).toBe('http://192.168.1.14:8080/api/v1');
  });

  test('Test F: Trailing slash is properly normalized', () => {
    const resolved = resolveApiBaseUrl('http://192.168.1.99:8080/api/v1/');
    expect(resolved).toBe('http://192.168.1.99:8080/api/v1');
  });

  test('Test G: Production mode uses production URL', () => {
    (global as any).__DEV__ = false;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    const resolved = resolveApiBaseUrl();
    expect(resolved).toBe('https://api.mathvisionkids.com/api/v1');

    (global as any).__DEV__ = true;
  });
});
