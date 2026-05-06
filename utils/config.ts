import Constants from 'expo-constants';

const getApiUrl = (): string => {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:3000`;
  return 'http://192.168.209.69:3000';
};

export const API_URL = getApiUrl();