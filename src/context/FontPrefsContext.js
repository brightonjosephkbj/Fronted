import React, { createContext, useContext, useState, useEffect } from 'react';
import { Text, TextInput, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FontPrefsContext = createContext(null);

const FONT_SIZE_KEY = 'b24_font_size';
const FONT_FAMILY_KEY = 'b24_font_family';

const SIZE_SCALE = { Small: 0.9, Medium: 1.0, Large: 1.15 };

const FAMILY_MAP = {
  System: null,
  Serif: Platform.OS === 'android' ? 'serif' : null,
  Monospace: Platform.OS === 'android' ? 'monospace' : null,
  Condensed: Platform.OS === 'android' ? 'sans-serif-condensed' : null,
};

let patched = false;

function applyGlobalFontOverride(scale, familyKey) {
  const family = FAMILY_MAP[familyKey] || null;

  function patchComponent(Component) {
    if (!Component || typeof Component.render !== 'function') return false;
    if (!Component.__b24OriginalRender) {
      Component.__b24OriginalRender = Component.render;
    }
    const original = Component.__b24OriginalRender;
    Component.render = function (...args) {
      const el = original.apply(this, args);
      if (!el || !el.props) return el;
      const flat = StyleSheet.flatten(el.props.style) || {};
      const nextStyle = { ...flat };
      if (typeof nextStyle.fontSize === 'number') {
        nextStyle.fontSize = Math.round(nextStyle.fontSize * scale * 10) / 10;
      }
      if (family) {
        nextStyle.fontFamily = family;
      }
      const React = require('react');
      return React.cloneElement(el, { style: nextStyle });
    };
    return true;
  }

  patched = patchComponent(Text) || patched;
  patchComponent(TextInput);
}

export function FontPrefsProvider({ children }) {
  const [fontSize, setFontSizeState] = useState('Medium');
  const [fontFamily, setFontFamilyState] = useState('System');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const savedSize = await AsyncStorage.getItem(FONT_SIZE_KEY);
        const savedFamily = await AsyncStorage.getItem(FONT_FAMILY_KEY);
        if (savedSize && SIZE_SCALE[savedSize] !== undefined) setFontSizeState(savedSize);
        if (savedFamily && FAMILY_MAP[savedFamily] !== undefined) setFontFamilyState(savedFamily);
      } catch (e) {
        // fall back to defaults
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyGlobalFontOverride(SIZE_SCALE[fontSize] ?? 1, fontFamily);
  }, [ready, fontSize, fontFamily]);

  async function setFontSize(size) {
    setFontSizeState(size);
    try {
      await AsyncStorage.setItem(FONT_SIZE_KEY, size);
    } catch (e) {
      // best-effort
    }
  }

  async function setFontFamily(family) {
    setFontFamilyState(family);
    try {
      await AsyncStorage.setItem(FONT_FAMILY_KEY, family);
    } catch (e) {
      // best-effort
    }
  }

  return (
    <FontPrefsContext.Provider value={{ fontSize, setFontSize, fontFamily, setFontFamily, sizeOptions: Object.keys(SIZE_SCALE), familyOptions: Object.keys(FAMILY_MAP) }}>
      {children}
    </FontPrefsContext.Provider>
  );
}

export function useFontPrefs() {
  const ctx = useContext(FontPrefsContext);
  if (!ctx) throw new Error('useFontPrefs must be used within FontPrefsProvider');
  return ctx;
}
