import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const AuthContext = createContext(null);

export const API_BASE = 'https://Brighton233j-Messenger-back-database.hf.space';

async function registerForPushNotifications(authToken) {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4f46e5',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return;
    }

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    const pushTokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const pushToken = pushTokenResponse?.data;
    if (!pushToken || !authToken) {
      return;
    }

    await fetch(`${API_BASE}/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ push_token: pushToken }),
    });
  } catch (e) {
    console.warn('Push registration failed', e);
  }
}

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
          registerForPushNotifications(savedToken);
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
    registerForPushNotifications(newToken);
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

  async function updateUserAvatar(avatarUrl) {
    setUser(prev => {
      const next = { ...prev, avatar_url: avatarUrl };
      AsyncStorage.setItem('b24_user', JSON.stringify(next));
      return next;
    });
  }

  async function updateUserFields(patch) {
    setUser(prev => {
      const next = { ...prev, ...patch };
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

  async function apiUploadFile(path, uri, options = {}) {
    const { fieldName = 'file', filename, mimeType, fields = {} } = options;
    try {
      const result = await FileSystem.uploadAsync(`${API_BASE}${path}`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName,
        mimeType: mimeType || 'application/octet-stream',
        parameters: {
          ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])),
        },
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      let data = {};
      try {
        data = JSON.parse(result.body || '{}');
      } catch (e) {}
      if (result.status < 200 || result.status >= 300) {
        throw new Error(data?.error || data?.message || 'Upload failed');
      }
      return data;
    } catch (e) {
      throw new Error(e.message || 'Upload failed');
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLocked, loading, login, logout, unlock, lockNow, apiRequest, apiUpload, apiUploadFile, updateUserPoints, updateUserAvatar, updateUserFields }}
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
