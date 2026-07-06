import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft } from 'lucide-react-native';

export default function AddFriendScreen() {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | searching | found | not_found | sent
  const [result, setResult] = useState(null);

  async function handleSearch() {
    const q = query.trim().replace('@b24.me', '').replace(/^@/, '');
    if (!q) return;
    setStatus('searching');
    try {
      const data = await apiRequest(`/users/${encodeURIComponent(q)}`);
      setResult(data);
      setStatus('found');
    } catch (e) {
      setStatus('not_found');
    }
  }

  async function sendRequest() {
    if (!result) return;
    try {
      await apiRequest('/friend-requests', { method: 'POST', body: JSON.stringify({ username: result.username }) });
    } catch (e) {}
    setStatus('sent');
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}><ChevronLeft size={22} color="#0f0f1a" /></Text></TouchableOpacity>
        <Text style={styles.title}>Add Friend</Text>
      </View>

      <Text style={styles.hint}>Enter their B24 username to find and add them.</Text>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={(t) => { setQuery(t); setStatus('idle'); }}
          onSubmitEditing={handleSearch}
          placeholder="username@b24.me"
          autoCapitalize="none"
          style={styles.input}
        />
      </View>
      <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
        <Text style={styles.searchBtnText}>Search</Text>
      </TouchableOpacity>

      {status === 'searching' && <ActivityIndicator style={{ marginTop: 30 }} />}
      {status === 'not_found' && <Text style={styles.notFound}>No one found with that username</Text>}

      {(status === 'found' || status === 'sent') && result && (
        <View style={styles.resultCard}>
          <View style={[styles.avatar, { backgroundColor: result.color || '#4f46e5' }]}>
            <Text style={styles.avatarText}>{result.name?.[0]}</Text>
          </View>
          <Text style={styles.resultName}>{result.name}</Text>
          <Text style={styles.resultUsername}>@{result.username}</Text>
          {status === 'found' ? (
            <TouchableOpacity style={styles.sendBtn} onPress={sendRequest}>
              <Text style={styles.sendBtnText}>Send Request</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.pending}>Request Pending</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff', padding: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  back: { fontSize: 26 },
  title: { fontSize: 18, fontWeight: '800' },
  hint: { color: '#6b6b7a', fontSize: 12.5, marginBottom: 12 },
  searchRow: { backgroundColor: 'white', borderRadius: 14, marginBottom: 10 },
  input: { padding: 14, fontSize: 14 },
  searchBtn: { backgroundColor: '#0f0f1a', borderRadius: 14, padding: 13, alignItems: 'center' },
  searchBtnText: { color: 'white', fontWeight: '700' },
  notFound: { textAlign: 'center', color: '#9ca3af', marginTop: 30 },
  resultCard: { backgroundColor: 'white', borderRadius: 20, padding: 24, alignItems: 'center', marginTop: 26 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: 28, fontWeight: '700' },
  resultName: { fontSize: 17, fontWeight: '800', marginTop: 10 },
  resultUsername: { fontSize: 12.5, color: '#9ca3af' },
  sendBtn: { backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, marginTop: 14 },
  sendBtnText: { color: 'white', fontWeight: '700' },
  pending: { marginTop: 14, color: '#6b6b7a', fontWeight: '700' },
});
