import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Check, ChevronLeft, UserPlus, X, Ban } from 'lucide-react-native';

const TABS = ['received', 'pending', 'canceled', 'failed'];

export default function RequestsScreen() {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const [tab, setTab] = useState('received');
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState({ pending: [], canceled: [], failed: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [pendingRes, sentRes] = await Promise.all([
        apiRequest('/friends/pending'),
        apiRequest('/friends/sent'),
      ]);
      setReceived(pendingRes.pending || []);
      setSent({
        pending: sentRes.pending || [],
        canceled: sentRes.canceled || [],
        failed: sentRes.failed || [],
      });
    } catch (e) {
      // backend unreachable — keep whatever we had
    }
  }, [apiRequest]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function respond(requesterId, action) {
    if (busyId) return;
    setBusyId(requesterId);
    try {
      await apiRequest('/friends/respond', {
        method: 'POST',
        body: JSON.stringify({ requester_id: requesterId, action }),
      });
      setReceived(list => list.filter(r => r.id !== requesterId));
    } catch (e) {
      // leave item in place so the user can retry
    } finally {
      setBusyId(null);
    }
  }

  async function cancelSent(friendId) {
    if (busyId) return;
    setBusyId(friendId);
    try {
      await apiRequest('/friends/cancel', {
        method: 'POST',
        body: JSON.stringify({ user_id: friendId }),
      });
      setSent(prev => {
        const item = prev.pending.find(r => r.id === friendId);
        return {
          ...prev,
          pending: prev.pending.filter(r => r.id !== friendId),
          canceled: item ? [{ ...item, status: 'canceled' }, ...prev.canceled] : prev.canceled,
        };
      });
    } catch (e) {
      // leave item in place so the user can retry
    } finally {
      setBusyId(null);
    }
  }

  const list = tab === 'received' ? received : sent[tab] || [];
  const tabCount = t => (t === 'received' ? received.length : (sent[t] || []).length);

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
              {t[0].toUpperCase() + t.slice(1)} ({tabCount(t)})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={list}
        keyExtractor={item => String(item.request_id || item.id)}
        contentContainerStyle={{ padding: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading && <Text style={styles.empty}>No requests here</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: '#4f46e5' }]}>
              <Text style={styles.avatarText}>{item.username?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.username}</Text>
              <Text style={styles.username}>{item.handle}</Text>
            </View>

            {tab === 'received' && (
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <TouchableOpacity disabled={busyId === item.id} onPress={() => respond(item.id, 'decline')}>
                  <X size={18} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity disabled={busyId === item.id} onPress={() => respond(item.id, 'accept')}>
                  <Check size={18} color="#22c55e" />
                </TouchableOpacity>
              </View>
            )}

            {tab === 'pending' && (
              <TouchableOpacity disabled={busyId === item.id} onPress={() => cancelSent(item.id)}>
                <Ban size={18} color="#ef4444" />
              </TouchableOpacity>
            )}

            {tab === 'canceled' && <Text style={styles.statusPill}>Canceled</Text>}
            {tab === 'failed' && <Text style={[styles.statusPill, styles.statusPillFailed]}>Declined</Text>}
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
  statusPill: { fontSize: 11, fontWeight: '700', color: '#9ca3af' },
  statusPillFailed: { color: '#ef4444' },
});
