import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, BadgeCheck } from 'lucide-react-native';

const PALETTE = ["#9333ea", "#f97316", "#0ea5a4", "#4f46e5", "#db2777", "#16a34a", "#ea580c", "#0891b2", "#7c3aed", "#c026d3"];
function colorForId(id) {
  return PALETTE[id % PALETTE.length];
}
function verifiedColor(tick) {
  if (tick === 'cyan') return '#06b6d4';
  if (tick === 'blue') return '#3b82f6';
  return '#a855f7';
}

function GlassCard({ style, children, blurAmount = 18, tint = 0.35 }) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={blurAmount} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(255,255,255,${tint})` }]} />
      {children}
    </View>
  );
}

export default function AddFriendScreen() {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | searching | found | not_found | sending | sent | already_sent
  const [result, setResult] = useState(null);

  async function handleSearch() {
    const q = query.trim().replace('@b24.me', '').replace(/^@/, '').toLowerCase();
    if (!q) return;
    setStatus('searching');
    try {
      const data = await apiRequest(`/users/${encodeURIComponent(q)}`);
      setResult(data);
      setStatus('found');
    } catch (e) {
      setResult(null);
      setStatus('not_found');
    }
  }

  async function sendRequest() {
    if (!result) return;
    setStatus('sending');
    try {
      await apiRequest('/friends/add', {
        method: 'POST',
        body: JSON.stringify({ username: result.username }),
      });
      setStatus('sent');
    } catch (e) {
      if (String(e.message || '').toLowerCase().includes('already exists')) {
        setStatus('already_sent');
      } else {
        setStatus('found'); // let them retry
      }
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrap}>
          <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={14} />
          <ChevronLeft size={22} color="#0f0f1a" />
        </TouchableOpacity>
        <Text style={styles.title}>Add Friend</Text>
      </View>

      <Text style={styles.hint}>Enter their B24 username to find and add them.</Text>

      <GlassCard style={{ padding: 0, marginBottom: 10 }}>
        <TextInput
          value={query}
          onChangeText={(t) => { setQuery(t); setStatus('idle'); setResult(null); }}
          onSubmitEditing={handleSearch}
          placeholder="username@b24.me"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          style={styles.input}
        />
      </GlassCard>
      <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
        <Text style={styles.searchBtnText}>Search</Text>
      </TouchableOpacity>

      {status === 'searching' && <ActivityIndicator style={{ marginTop: 30 }} />}
      {status === 'not_found' && <Text style={styles.notFound}>No one found with that username</Text>}

      {['found', 'sending', 'sent', 'already_sent'].includes(status) && result && (
        <GlassCard style={styles.resultCard} tint={0.4}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: colorForId(result.id) }]}>
              <Text style={styles.avatarText}>{(result.avatar_letter || result.username?.[0] || '?').toUpperCase()}</Text>
            </View>
            {result.verified && (
              <View style={[styles.verifiedBadge, { backgroundColor: verifiedColor(result.verified) }]}>
                <BadgeCheck size={13} color="#fff" strokeWidth={3} />
              </View>
            )}
          </View>
          <Text style={styles.resultName}>{result.username}</Text>
          <Text style={styles.resultUsername}>{result.handle}</Text>

          {status === 'found' && (
            <TouchableOpacity style={styles.sendBtn} onPress={sendRequest}>
              <Text style={styles.sendBtnText}>Send Request</Text>
            </TouchableOpacity>
          )}
          {status === 'sending' && <ActivityIndicator style={{ marginTop: 14 }} />}
          {status === 'sent' && <Text style={styles.pending}>Request Sent</Text>}
          {status === 'already_sent' && <Text style={styles.pending}>Request Already Pending</Text>}
        </GlassCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff', padding: 14 },
  glassWrap: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  backBtnWrap: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  title: { fontSize: 18, fontWeight: '800' },
  hint: { color: '#6b6b7a', fontSize: 12.5, marginBottom: 12 },
  input: { padding: 14, fontSize: 14, color: '#0f0f1a' },
  searchBtn: { backgroundColor: '#0f0f1a', borderRadius: 14, padding: 13, alignItems: 'center' },
  searchBtnText: { color: 'white', fontWeight: '700' },
  notFound: { textAlign: 'center', color: '#9ca3af', marginTop: 30 },
  resultCard: { padding: 24, alignItems: 'center', marginTop: 26 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: 28, fontWeight: '700' },
  verifiedBadge: { position: 'absolute', bottom: -1, right: -1, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },
  resultName: { fontSize: 17, fontWeight: '800', marginTop: 10, color: '#0f0f1a' },
  resultUsername: { fontSize: 12.5, color: '#9ca3af' },
  sendBtn: { backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, marginTop: 14 },
  sendBtnText: { color: 'white', fontWeight: '700' },
  pending: { marginTop: 14, color: '#6b6b7a', fontWeight: '700' },
});
