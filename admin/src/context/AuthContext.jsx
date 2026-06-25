import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearAuthSession,
  getStoredAdmin,
  getStoredToken,
  isTokenExpired,
} from '../services/storage';
import { loginAdmin } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    const storedAdmin = getStoredAdmin();

    if (token && storedAdmin && !isTokenExpired(token)) {
      setAdmin(storedAdmin);
    } else {
      clearAuthSession();
      setAdmin(null);
    }

    setIsLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginAdmin(email, password);

    if (!data?.success || !data.token || !data.admin) {
      throw new Error(data?.message || 'Login failed');
    }

    setAdmin(data.admin);
    return data;
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setAdmin(null);
  }, []);

  const value = useMemo(
    () => ({
      admin,
      isAuthenticated: Boolean(admin),
      isLoading,
      login,
      logout,
    }),
    [admin, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
