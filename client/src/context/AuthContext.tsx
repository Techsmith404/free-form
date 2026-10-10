import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthStatusResponse } from '../types/index.js';
import { checkAuthStatus, setupOwner, loginUser, registerUser, logoutUser, initAuthToken, getAuthToken } from '../api/index.js';

interface AuthContextType {
  user: User | null;
  accountsEnabled: boolean;
  authRequired: boolean;
  needsSetup: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { username: string; password: string; remember_me?: boolean }) => Promise<void>;
  register: (data: { username: string; password: string; email?: string; invite_code: string }) => Promise<void>;
  setup: (data: { username: string; password: string; email?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accountsEnabled, setAccountsEnabled] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    try {
      await initAuthToken();
      const status: AuthStatusResponse = await checkAuthStatus();
      setAccountsEnabled(status.accounts_enabled);
      setAuthRequired(status.auth_required);
      setNeedsSetup(status.needs_setup);
      if (status.authenticated && status.user) {
        setUser(status.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('Failed to verify auth status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const login = async (credentials: { username: string; password: string; remember_me?: boolean }) => {
    const res = await loginUser(credentials);
    setUser(res.user);
    await refreshStatus();
  };

  const register = async (data: { username: string; password: string; email?: string; invite_code: string }) => {
    const res = await registerUser(data);
    setUser(res.user);
    await refreshStatus();
  };

  const setup = async (data: { username: string; password: string; email?: string }) => {
    const res = await setupOwner(data);
    setUser(res.user);
    setNeedsSetup(false);
    await refreshStatus();
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
    await refreshStatus();
  };

  const isAuthenticated = !authRequired || Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        accountsEnabled,
        authRequired,
        needsSetup,
        isAuthenticated,
        isLoading,
        login,
        register,
        setup,
        logout,
        refreshStatus
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
