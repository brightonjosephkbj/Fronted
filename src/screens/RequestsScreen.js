import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Check, ChevronLeft, UserPlus, X } from 'lucide-react-native';

const TABS = ['pending', 'received', 'canceled', 'failed'];

export default function RequestsScreen() {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const [tab, setTab] = useState('pending');
  const [data, setData] = useState({ pending: [], received: [], canceled: [], failed: [] });

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest('/friend-requests');
        setData({
          pending: res.pending || [],
          received: res.received || [],
          canceled: res.canceled || [],
          failed: res.failed || [],
        });
      } catch (e) {
        // backend not ready, keep empty lists
      }
    })();
  }, []);

  async function accept(id) {
    try { await apiRequest(`/friend-requests/${id}/accept`, { method: 'POST' }); } catch (e) {}
    setData(d => ({ ...d, received: d.received.filter(r => r.id !== id) }));
  }
  async function decline(id) {
    try { await apiRequest(`/friend-requests/${id}/decline`, { method: 'POST' }); } catch (e) {}
    setData(d => ({ ...d, received: d.received.filter(r => r.id !== id) }));
  }
  async function cancel(id) {
    try { await apiRequest(`/friend-requests/${id}/cancel`, { method: 'POST' }); } catch (e) {}
    setData(d => ({ ...d, pending: d.pending.filter(r => r.id !== id) }));
  }

  const list = data[tab];

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}><ChevronLeft size={22} color="#0f0f1a" /></Text></TouchableOpacity>
        <Text style={styles.title}>Requests</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => navigation.navigate('AddFriend')}><UserPlus size={20} color="#4f46e5" /></TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t[0].toUpperCase() + t.slice(1)} ({data[t].length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={list}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 14 }}
        ListEmptyComponent={<Text style={styles.empty}>No {tab} requests</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: item.color || '#4f46e5' }]}>
              <Text style={styles.avatarText}>{item.name?.[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.username}>@{item.username}</Text>
            </View>
            {tab === 'pending' && (
              <TouchableOpacity onPress={() => cancel(item.id)}><Text style={styles.actionText}>Cancel</Text></TouchableOpacity>
            )}
            {tab === 'received' && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => decline(item.id)}><X size={18} color="#ef4444" /></TouchableOpacity>
                <TouchableOpacity onPress={() => accept(item.id)}><Text style={styles.acceptText}><Check size={13} color="#0f0f1a" /></Text></TouchableOpacity>
              </View>
            )}
            {tab === 'canceled' && <Text style={styles.actionText}>Resend</Text>}
            {tab === 'failed' && <Text style={styles.actionText}>Retry</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  back: { fontSize: 26 },
  title: { fontSize: 18, fontWeight: '800' },
  addIcon: { fontSize: 18 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'white' },
  tabActive: { backgroundColor: '#0f0f1a' },
  tabText: { fontSize: 11.5, fontWeight: '700', color: '#6b6b7a' },
  tabTextActive: { color: 'white' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', borderRadius: 16, padding: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontWeight: '700' },
  name: { fontWeight: '700', fontSize: 14 },
  username: { fontSize: 11.5, color: '#9ca3af' },
  actionText: { color: '#4f46e5', fontWeight: '700', fontSize: 12.5 },
  acceptText: { color: '#4f46e5', fontSize: 18 },
  declineText: { color: '#9ca3af', fontSize: 18 },
});
