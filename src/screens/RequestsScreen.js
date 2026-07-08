import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Check, ChevronLeft, UserPlus, X } from 'lucide-react-native';

const TABS = ['received', 'pending', 'canceled', 'failed'];
const BACKED_TABS = ['received'];

export default function RequestsScreen() {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const [tab, setTab] = useState('received');
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest('/friends/pending');
      setReceived(res.pending || []);
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

  const list = tab === 'received' ? received : [];

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
              {t[0].toUpperCase() + t.slice(1)}{t === 'received' ? ` (${received.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!BACKED_TABS.includes(tab) ? (
        <View style={styles.notTracked}>
          <Text style={styles.notTrackedText}>
            {t => {}}
            {'Not tracked yet — this needs a backend update to record outgoing request history.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 14 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={!loading && <Text style={styles.empty}>No requests waiting</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: '#4f46e5' }]}>
                <Text style={styles.avatarText}>{item.username?.[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.username}</Text>
                <Text style={styles.username}>{item.handle}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <TouchableOpacity disabled={busyId === item.id} onPress={() => respond(item.id, 'decline')}>
                  <X size={18} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity disabled={busyId === item.id} onPress={() => respond(item.id, 'accept')}>
                  <Check size={18} color="#22c55e" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
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
  notTracked: { padding: 24 },
  notTrackedText: { textAlign: 'center', color: '#9ca3af', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', borderRadius: 16, padding: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontWeight: '700' },
  name: { fontWeight: '700', fontSize: 14 },
  username: { fontSize: 11.5, color: '#9ca3af' },
});
