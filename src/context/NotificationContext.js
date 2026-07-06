import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Animated } from 'react-native';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [banner, setBanner] = useState(null); // { type: 'message'|'online', title, subtitle, onPress }
  const [levelUp, setLevelUp] = useState(null); // { level } or null
  const activeChatIdRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const dismissTimerRef = useRef(null);

  const setActiveChatId = useCallback((id) => {
    activeChatIdRef.current = id;
  }, []);

  const showBanner = useCallback((data) => {
    // suppress message banners for the chat currently open
    if (data.type === 'message' && data.chatId && data.chatId === activeChatIdRef.current) {
      return;
    }
    setBanner(data);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();

    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      Animated.timing(slideAnim, { toValue: -100, duration: 250, useNativeDriver: true }).start(() => setBanner(null));
    }, 3500);
  }, []);

  const dismissBanner = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    Animated.timing(slideAnim, { toValue: -100, duration: 250, useNativeDriver: true }).start(() => setBanner(null));
  }, []);

  const triggerLevelUp = useCallback((level) => {
    setLevelUp({ level });
    setTimeout(() => setLevelUp(null), 10000);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ banner, slideAnim, showBanner, dismissBanner, setActiveChatId, levelUp, triggerLevelUp }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
