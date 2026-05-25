// Use environment variables from .env file
// Update .env file to change IP address in ONE place
export const API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_10.227.242.44_API_URL || 'http://10.227.242.44:4000';
export const USER_API_URL = process.env.EXPO_PUBLIC_USER_API_URL || process.env.EXPO_PUBLIC_10.227.242.44_USER_API_URL || 'http://10.227.242.44:5000';
