import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { loadApiBaseUrl, setApiBaseUrl, setUnauthorizedHandler } from '../api/client';
import { DEFAULT_API_URL } from '../constants/config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [apiUrl, setApiUrlState] = useState(DEFAULT_API_URL);
  const [booting, setBooting] = useState(true);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove(['token', 'user']);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    (async () => {
      try {
        const url = await loadApiBaseUrl();
        setApiUrlState(url);
        const savedToken = await AsyncStorage.getItem('token');
        const savedUser = await AsyncStorage.getItem('user');
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const persistSession = useCallback(async (nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    await AsyncStorage.setItem('token', nextToken);
    await AsyncStorage.setItem('user', JSON.stringify(nextUser));
  }, []);

  const updateUser = useCallback(async (partial) => {
    setUser((prev) => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  const updateApiUrl = useCallback(async (url) => {
    await setApiBaseUrl(url);
    setApiUrlState(url.replace(/\/$/, ''));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    await persistSession(data.token, data.user);
    return data.user;
  }, [persistSession]);

  const register = useCallback(async (name, email, password, role = 'agent') => {
    const { data } = await api.post('/api/auth/register', {
      name,
      email,
      password,
      role,
    });
    await persistSession(data.token, data.user);
    return data.user;
  }, [persistSession]);

  const loginWithGoogle = useCallback(async (idToken, role) => {
    const payload = { idToken };
    if (role) payload.role = role;
    const { data } = await api.post('/api/auth/google', payload);
    await persistSession(data.token, data.user);
    return data.user;
  }, [persistSession]);

  const isPublisher =
    user?.role === 'publisher' ||
    user?.role === 'agent' ||
    user?.role === 'owner' ||
    user?.role === 'sales';

  const refreshProfileFlag = useCallback(async () => {
    if (!token || !isPublisher) return;
    try {
      const { data } = await api.get('/api/agents/me');
      await updateUser({ onboardingComplete: !!data.onboardingComplete });
    } catch {
      // ignore
    }
  }, [token, isPublisher, updateUser]);

  /** Refresh signed profilePic / ratings (presigned URLs expire). */
  const refreshSessionUser = useCallback(async () => {
    if (!token) return null;
    try {
      const { data } = await api.get('/api/auth/me');
      if (data?.user) await updateUser(data.user);
      return data?.user || null;
    } catch {
      return null;
    }
  }, [token, updateUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        apiUrl,
        booting,
        isAuthenticated: !!token,
        role: user?.role,
        needsOnboarding: isPublisher && !user?.onboardingComplete,
        login,
        register,
        loginWithGoogle,
        logout,
        updateApiUrl,
        updateUser,
        refreshProfileFlag,
        refreshSessionUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
