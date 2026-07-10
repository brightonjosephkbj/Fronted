import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';

const PIN_LENGTH = 4;
const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'];

function GlassCard({ style, children, blurAmount = 22, tint = 0.1 }) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={intensity} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(255,255,255,${tint})` }]} />
      {children}
    </View>
  );
}

export default function LockScreen() {
  const { unlock } = useAuth();
  const [entered, setEntered] = useState('');
  const [error, setError] = useState(false);
  const shake = useState(new Animated.Value(0))[0];

  useEffect(() => {
    tryBiometric();
  }, []);

  async function tryBiometric() {
    try {
      const available = await Keychain.getSupportedBiometryType();
      if (!available) return;
      const result = await Keychain.getGenericPassword({
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
      });
      if (result) {
        unlock();
      }
    } catch (e) {
      // biometric not available/cancelled, fall back to PIN
    }
  }

  async function checkPin(pin) {
    try {
      const savedPin = await AsyncStorage.getItem('appLockPin');
      if (savedPin && pin === savedPin) {
        unlock();
      } else {
        triggerError();
      }
    } catch (e) {
      triggerError();
    }
  }

  function triggerError() {
    setError(true);
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start(() => setEntered(''));
  }

  function handleKey(key) {
    if (key === '') return;
    if (key === 'del') {
      setEntered(prev => prev.slice(0, -1));
      setError(false);
      return;
    }
    const next = entered + String(key);
    setEntered(next);
    setError(false);
    if (next.length === PIN_LENGTH) {
      checkPin(next);
    }
  }

  return (
    <View style={styles.screen}>
      <GlassCard style={styles.lockCard}>
        <View style={styles.brandIcon}>
          <Text style={styles.brandIconText}>B</Text>
        </View>
        <Text style={styles.title}>B24 Locked</Text>
        <Text style={styles.subtitle}>Enter your PIN to continue</Text>

        <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shake }] }]}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < entered.length && styles.dotFilled,
                error && styles.dotError,
              ]}
            />
          ))}
        </Animated.View>

        <View style={styles.keypad}>
          {KEYS.map((k, i) => (
            <TouchableOpacity
              key={i}
              style={styles.key}
              disabled={k === ''}
              onPress={() => handleKey(k)}
            >
              <Text style={styles.keyText}>{k === 'del' ? '⌫' : k}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={tryBiometric} style={styles.bioBtn}>
          <Text style={styles.bioText}>Use Fingerprint / Face ID</Text>
        </TouchableOpacity>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: '#1e1b3a', alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 24,
  },
  glassWrap: { overflow: 'hidden', borderRadius: 28 },
  lockCard: {
    alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24,
    width: '100%', maxWidth: 340,
  },
  brandIcon: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: '#6d28d9',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  brandIconText: { color: 'white', fontWeight: '800', fontSize: 24 },
  title: { color: 'white', fontSize: 20, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4, marginBottom: 30 },
  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 36 },
  dot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  dotFilled: { backgroundColor: 'white', borderColor: 'white' },
  dotError: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  keypad: {
    flexDirection: 'row', flexWrap: 'wrap', width: 260,
    justifyContent: 'space-between',
  },
  key: {
    width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  keyText: { color: 'white', fontSize: 24, fontWeight: '600' },
  bioBtn: { marginTop: 24 },
  bioText: { color: '#a78bfa', fontSize: 13.5, fontWeight: '600' },
});
