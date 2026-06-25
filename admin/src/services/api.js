import axios from 'axios';
import { clearAuthSession, getStoredToken } from './storage';

const api = axios.create({
  baseURL: import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || 'http://192.168.0.127:5001/api'),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/admin/login');

    if (error.response?.status === 401 && !isLoginRequest) {
      clearAuthSession();
    }

    return Promise.reject(error);
  },
);

export default api;
