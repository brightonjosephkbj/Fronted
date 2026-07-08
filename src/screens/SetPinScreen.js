import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from '@react-native-community/blur';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';

const PIN_LENGTH = 4;
const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'];

function GlassCard({ style, children, blurAmount = 18, tint = 0.35 }) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={blurAmount} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(255,255,255,${tint})` }]} />
      {children}
    </View>
  );
}

export default function SetPinScreen() {
  const navigation = useNavigation();
  const [ready, setReady] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [stage, setStage] = useState('create'); // verify | create | confirm
  const [entry, setEntry] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const pin = await AsyncStorage.getItem('appLockPin');
        setHasPin(!!pin);
        setStage(pin ? 'verify' : 'create');
      } catch (e) {
        setStage('create');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  function subtitleFor() {
    if (stage === 'verify') return 'Enter your current PIN to continue';
    if (stage === 'create') return 'Choose a 4-digit PIN';
    return 'Re-enter your PIN to confirm';
  }

  async function submitPin(pin) {
    if (stage === 'verify') {
      const saved = await AsyncStorage.getItem('appLockPin').catch(() => null);
      if (pin === saved) {
        setEntry('');
        setStage('create');
      } else {
        setError(true);
        setTimeout(() => setEntry(''), 200);
      }
      return;
    }

    if (stage === 'create') {
      setFirstPin(pin);
      setEntry('');
      setStage('confirm');
      return;
    }

    // stage === 'confirm'
    if (pin === firstPin) {
      try {
        await AsyncStorage.setItem('appLockPin', pin);
        Alert.alert('App Lock set', 'Your PIN has been saved.');
        navigation.goBack();
      } catch (e) {
        Alert.alert('Error', "Couldn't save your PIN. Try again.");
        setEntry('');
        setFirstPin('');
        setStage('create');
      }
    } else {
      setError(true);
      setTimeout(() => {
        setEntry('');
        setFirstPin('');
        setStage('create');
      }, 400);
    }
  }

  function handleKey(key) {
    if (key === '') return;
    if (key === 'del') {
      setEntry(prev => prev.slice(0, -1));
      setError(false);
      return;
    }
    const next = entry + String(key);
    setEntry(next);
    setError(false);
    if (next.length === PIN_LENGTH) submitPin(next);
  }

  function handleRemovePin() {
    Alert.alert(
      'Remove App Lock?',
      'Chats locked with your PIN will no longer require it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            try {
              await AsyncStorage.removeItem('appLockPin');
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', "Couldn't remove your PIN. Try again.");
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrap}>
          <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={14} />
          <ChevronLeft size={22} color="#0f0f1a" />
        </TouchableOpacity>
        <Text style={styles.title}>App Lock</Text>
      </View>

      {ready && (
        <GlassCard style={styles.card}>
          <Text style={styles.subtitle}>{subtitleFor()}</Text>
          <View style={styles.dotsRow}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View key={i} style={[styles.dot, i < entry.length && styles.dotFilled, error && styles.dotError]} />
            ))}
          </View>
          <View style={styles.keypad}>
            {KEYS.map((k, i) => (
              <TouchableOpacity key={i} style={styles.key} disabled={k === ''} onPress={() => handleKey(k)}>
                <Text style={styles.keyText}>{k === 'del' ? '⌫' : k}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {hasPin && stage === 'verify' && (
            <TouchableOpacity onPress={handleRemovePin} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>Remove App Lock</Text>
            </TouchableOpacity>
          )}
        </GlassCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff', padding: 14 },
  glassWrap: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  backBtnWrap: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  title: { fontSize: 16, fontWeight: '700', color: '#0f0f1a' },
  card: { padding: 24, alignItems: 'center' },
  subtitle: { fontSize: 13, color: '#6b6b7a', marginBottom: 22, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 14, marginBottom: 26 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(15,15,26,0.25)' },
  dotFilled: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  dotError: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 230, justifyContent: 'space-between' },
  key: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 10, backgroundColor: 'rgba(15,15,26,0.05)' },
  keyText: { color: '#0f0f1a', fontSize: 22, fontWeight: '600' },
  removeBtn: { marginTop: 8 },
  removeBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
});
