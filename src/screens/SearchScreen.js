import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft } from 'lucide-react-native';

function GlassCard({ style, children, blurAmount = 18 }) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={blurAmount} />
      <View style={styles.glassTint} />
      {children}
    </View>
  );
}

const MOCK_FRIENDS = [
  { id: 'f1', name: 'Derrick', color: '#f97316', username: 'derrick_k' },
  { id: 'f2', name: 'Rita', color: '#db2777', username: 'rita_k' },
];

const MOCK_MESSAGES = [
  { id: 'm1', chatName: 'Joy', snippet: '...yeah give me a sec...', chatId: '1' },
  { id: 'm2', chatName: 'B24 Builders', snippet: '...pushed the new build...', chatId: '4' },
];

export default function SearchScreen() {
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState([]);
  const [messages, setMessages] = useState([]);

  async function handleSearch(text) {
    setQuery(text);
    if (!text.trim()) {
      setFriends([]);
      setMessages([]);
      return;
    }
    const q = text.trim().toLowerCase();
    try {
      const data = await apiRequest(`/search?q=${encodeURIComponent(q)}`);
      setFriends(data?.friends || []);
      setMessages(data?.messages || []);
    } catch (e) {
      // backend not ready yet - filter mock data locally
      setFriends(MOCK_FRIENDS.filter(f => f.name.toLowerCase().includes(q) || f.username.toLowerCase().includes(q)));
      setMessages(MOCK_MESSAGES.filter(m => m.snippet.toLowerCase().includes(q) || m.chatName.toLowerCase().includes(q)));
    }
  }

  const hasResults = friends.length > 0 || messages.length > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrap}>
          <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={14} />
          <Text style={styles.backBtn}><ChevronLeft size={22} color="#0f0f1a" /></Text>
        </TouchableOpacity>
        <GlassCard style={styles.searchField} blurAmount={16}>
          <TextInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Search friends or messages"
            placeholderTextColor="#9ca3af"
            autoFocus
            style={styles.input}
          />
        </GlassCard>
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingTop: 6 }}
        data={[{ type: 'ask_joy' }, ...(friends.length ? [{ type: 'friends_header' }, ...friends.map(f => ({ type: 'friend', ...f }))] : []), ...(messages.length ? [{ type: 'messages_header' }, ...messages.map(m => ({ type: 'message', ...m }))] : [])]}
        keyExtractor={(item, i) => item.id || item.type + i}
        renderItem={({ item }) => {
          if (item.type === 'ask_joy' && query.trim()) {
            return (
              <TouchableOpacity onPress={() => navigation.navigate('ChatDetail', { chat: { id: 'joy', name: 'Joy', color: '#9333ea' }, prefill: query })}>
                <GlassCard style={styles.askJoyCard}>
                  <Text style={styles.askJoyText}>Ask Joy about "{query}"</Text>
                </GlassCard>
              </TouchableOpacity>
            );
          }
          if (item.type === 'friends_header') return <Text style={styles.sectionTitle}>Friends</Text>;
          if (item.type === 'messages_header') return <Text style={styles.sectionTitle}>Messages</Text>;
          if (item.type === 'friend') {
            return (
              <TouchableOpacity onPress={() => navigation.navigate('ChatDetail', { chat: item })}>
                <GlassCard style={styles.resultRow}>
                  <View style={[styles.avatar, { backgroundColor: item.color }]}>
                    <Text style={styles.avatarText}>{item.name[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.resultName}>{item.name}</Text>
                    <Text style={styles.resultSub}>@{item.username}</Text>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            );
          }
          if (item.type === 'message') {
            return (
              <TouchableOpacity onPress={() => navigation.navigate('ChatDetail', { chat: { id: item.chatId, name: item.chatName } })}>
                <GlassCard style={styles.resultRow}>
                  <View>
                    <Text style={styles.resultName}>{item.chatName}</Text>
                    <Text style={styles.resultSub}>{item.snippet}</Text>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            );
          }
          return null;
        }}
        ListEmptyComponent={
          query.trim() && !hasResults ? (
            <Text style={styles.emptyText}>No results for "{query}"</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff' },
  glassWrap: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  glassTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.35)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingTop: 18 },
  backBtnWrap: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  backBtn: { fontSize: 22, color: '#0f0f1a' },
  searchField: { flex: 1, paddingHorizontal: 14, justifyContent: 'center' },
  input: { fontSize: 14.5, color: '#0f0f1a', paddingVertical: 12 },
  sectionTitle: { fontSize: 11.5, fontWeight: '700', color: '#6b6b7a', textTransform: 'uppercase', marginTop: 12, marginBottom: 6, marginLeft: 4 },
  askJoyCard: { padding: 14, marginBottom: 6, alignItems: 'center' },
  askJoyText: { fontSize: 13.5, fontWeight: '700', color: '#4f46e5' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontWeight: '700' },
  resultName: { fontSize: 14, fontWeight: '700', color: '#0f0f1a' },
  resultSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 13 },
});
