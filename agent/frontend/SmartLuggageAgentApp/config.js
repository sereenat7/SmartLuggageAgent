import Constants from 'expo-constants';

// Prefer Metro's LAN host in Expo Go so the phone always reaches the same machine.
function getLanHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    Constants.manifest?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return host;
  }
  return process.env.EXPO_PUBLIC_API_HOST || '192.168.0.127';
}

const LAN_HOST = getLanHost();

export const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${LAN_HOST}:4000`;
export const USER_API_URL = process.env.EXPO_PUBLIC_USER_API_URL || `http://${LAN_HOST}:5000`;
