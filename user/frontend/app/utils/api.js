import Constants from 'expo-constants';

const LAN_HOST = '192.168.0.127';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || `http://${LAN_HOST}:5000`;

export const AUTH_API_URL = `${API_BASE_URL}/api/auth`;
export const BOOKINGS_API_URL = `${API_BASE_URL}/api/bookings`;
export const AGENTS_API_URL = `${API_BASE_URL}/api/agents`;
