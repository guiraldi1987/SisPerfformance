import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getUser, getToken, login as doLogin, logout as doLogout, type AuthUser } from '../lib/authClient';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => (getToken() ? getUser() : null));

  // Sincroniza estado quando outro tab faz login/logout ou quando o
  // interceptor derruba a sessão por 401.
  useEffect(() => {
    const sync = () => setUser(getToken() ? getUser() : null);
    window.addEventListener('storage', sync);
    window.addEventListener('auth-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('auth-change', sync);
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const u = await doLogin(username, password);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    doLogout();
    setUser(null);
  }, []);

  const value: AuthState = {
    user,
    isAuthenticated: user !== null,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
