import Constants from 'expo-constants';

type ExpoConfigWithApiUrl = {
  extra?: {
    apiUrl?: string;
  };
  hostUri?: string;
};

const API_PORT = 3000;
const FALLBACK_HOST = '192.168.75.69';

const cleanUrl = (url: string): string => url.trim().replace(/\/$/, '');

const getConfiguredApiUrl = (): string | null => {
  const apiUrl = (Constants.expoConfig as ExpoConfigWithApiUrl | null)?.extra?.apiUrl;
  if (typeof apiUrl === 'string' && apiUrl.trim()) return cleanUrl(apiUrl);
  return null;
};

const getHostFromUri = (uri?: string | null): string | null => {
  if (!uri) return null;

  const withoutProtocol = uri.replace(/^[a-z]+:\/\//i, '').split('/')[0];
  const withoutCredentials = withoutProtocol.includes('@')
    ? withoutProtocol.split('@').pop()
    : withoutProtocol;
  const host = withoutCredentials?.split(':')[0];

  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
};

const getLegacyManifest = (): { debuggerHost?: string; hostUri?: string } | null => {
  try {
    return Constants.manifest as { debuggerHost?: string; hostUri?: string } | null;
  } catch {
    return null;
  }
};

const getApiUrl = (): string => {
  const configuredApiUrl = getConfiguredApiUrl();
  if (configuredApiUrl) return configuredApiUrl;

  const expoGoConfig = Constants.expoGoConfig as { hostUri?: string } | null;
  const manifest = getLegacyManifest();
  const host =
    getHostFromUri(Constants.expoConfig?.hostUri) ??
    getHostFromUri(expoGoConfig?.hostUri) ??
    getHostFromUri(manifest?.debuggerHost) ??
    getHostFromUri(manifest?.hostUri) ??
    FALLBACK_HOST;

  return `http://${host}:${API_PORT}`;
};

export const API_URL = getApiUrl();
