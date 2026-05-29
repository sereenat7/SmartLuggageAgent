// Use environment variables from .env file
// Update .env file to change IP address in ONE place
export const API_URL = process.env.EXPO_PUBLIC_AGENT_API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://10.159.173.44:4000';
export const USER_API_URL = process.env.EXPO_PUBLIC_USER_API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://10.159.173.44:5000';
