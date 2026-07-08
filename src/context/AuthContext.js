import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

const API_BASE = 'https://Brighton233j-Messenger-back-database.hf.space';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const savedToken = await AsyncStorage.getItem('b24_token');
        const savedUser = await AsyncStorage.getItem('b24_user');
        const appLockEnabled = await AsyncStorage.getItem('appLockEnabled');

        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
        if (appLockEnabled === 'true') {
          setIsLocked(true);
        }
      } catch (e) {
        console.warn('AuthContext restore error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(newToken, newUser) {
    setToken(newToken);
    setUser(newUser);
    await AsyncStorage.setItem('b24_token', newToken);
    await AsyncStorage.setItem('b24_user', JSON.stringify(newUser));
  }

  async function logout() {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem('b24_token');
    await AsyncStorage.removeItem('b24_user');
  }

  function unlock() {
    setIsLocked(false);
  }

  async function updateUserPoints(points, level) {
    setUser(prev => {
      const next = { ...prev, points, ...(level !== undefined ? { level } : {}) };
      AsyncStorage.setItem('b24_user', JSON.stringify(next));
      return next;
    });
  }

  function lockNow() {
    AsyncStorage.getItem('appLockEnabled').then(v => {
      if (v === 'true') setIsLocked(true);
    });
  }

  async function apiRequest(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || data?.message || 'Request failed');
    }
    return data;
  }

  async function apiUpload(path, formData) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || data?.message || 'Upload failed');
    }
    return data;
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLocked, loading, login, logout, unlock, lockNow, apiRequest, apiUpload, updateUserPoints }}
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
