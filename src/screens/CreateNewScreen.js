import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, FlatList,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { BlurView } from '@react-native-community/blur';
import { Camera, Check, ChevronLeft } from 'lucide-react-native';

const CONFIG = {
  group: {
    title: 'New Group',
    namePlaceholder: 'Group name',
    descPlaceholder: 'Description (optional)',
    color: '#4f46e5',
  },
  channel: {
    title: 'New Channel',
    namePlaceholder: 'Channel name',
    descPlaceholder: 'What is this channel about?',
    color: '#0891b2',
  },
  broadcast: {
    title: 'New Broadcast',
    namePlaceholder: 'Broadcast list name',
    descPlaceholder: 'Description (optional)',
    color: '#f59e0b',
  },
};

const FRIENDS = [
  { id: '1', name: 'Derrick', handle: 'derrick@b24.me', color: '#f97316' },
  { id: '2', name: 'Rita', handle: 'rita_k@b24.me', color: '#db2777' },
  { id: '3', name: 'Kato', handle: 'kato@b24.me', color: '#3b82f6' },
  { id: '4', name: 'Mercy', handle: 'mercy@b24.me', color: '#16a34a' },
];

function GlassCard({ style, children }) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={18} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
      {children}
    </View>
  );
}

export default function CreateNewScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const type = route.params?.type || 'group';
  const cfg = CONFIG[type];

  const [step, setStep] = useState('details'); // 'details' | 'members'
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdEntity, setCreatedEntity] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const filteredFriends = FRIENDS.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.handle.toLowerCase().includes(search.toLowerCase())
  );

  function toggleFriend(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    const payload = { name: name.trim(), description: description.trim(), type };
    let entity = { id: 'local' + Date.now(), name: name.trim(), color: cfg.color };
    try {
      const data = await apiRequest('/groups/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data?.group) entity = data.group;
      else if (data?.id) entity = data;
    } catch (e) {
      // backend endpoint may not distinguish type yet — keep local entity so flow still works
    }
    setCreatedEntity(entity);
    setCreating(false);
    setStep('members');
  }

  async function finishWithFriends() {
    if (selected.length && createdEntity?.id && !String(createdEntity.id).startsWith('local')) {
      try {
        await apiRequest(`/groups/${createdEntity.id}/members`, {
          method: 'POST',
          body: JSON.stringify({ member_ids: selected }),
        });
      } catch (e) {
        // non-fatal — group already exists, members can be added later from GroupSettings
      }
    }
    goToNewChat();
  }

  function goToNewChat() {
    navigation.replace('GroupChatDetail', {
      chat: { ...createdEntity, name: createdEntity.name, color: createdEntity.color, onlineCount: 0 },
    });
  }

  if (step === 'details') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 14 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}><ChevronLeft size={22} color="#0f0f1a" /></Text>
          </TouchableOpacity>
          <Text style={styles.title}>{cfg.title}</Text>
        </View>

        <GlassCard style={styles.card}>
          <View style={[styles.avatar, { backgroundColor: cfg.color }]}>
            {name.trim() ? <Text style={styles.avatarText}>{name.trim()[0].toUpperCase()}</Text> : <Camera size={26} color="white" />}
          </View>
          <Text style={styles.avatarHint}>Tap to add photo</Text>
        </GlassCard>

        <GlassCard style={styles.card}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={cfg.namePlaceholder}
            placeholderTextColor="#9ca3af"
            style={styles.input}
            autoFocus
          />
          <View style={styles.divider} />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={cfg.descPlaceholder}
            placeholderTextColor="#9ca3af"
            style={[styles.input, { minHeight: 60 }]}
            multiline
          />
        </GlassCard>

        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: name.trim() ? cfg.color : '#c7c7d1' }]}
          onPress={handleCreate}
          disabled={!name.trim() || creating}
        >
          <Text style={styles.createBtnText}>{creating ? 'Creating...' : 'Create'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // step === 'members'
  return (
    <View style={styles.screen}>
      <View style={[styles.headerRow, { paddingHorizontal: 14, paddingTop: 14 }]}>
        <Text style={styles.title}>Add Friends</Text>
        <TouchableOpacity onPress={goToNewChat} style={{ marginLeft: 'auto' }}>
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 14 }}>
        <GlassCard style={{ padding: 0 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search friends..."
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
          />
        </GlassCard>
      </View>

      <FlatList
        data={filteredFriends}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 14 }}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          return (
            <TouchableOpacity onPress={() => toggleFriend(item.id)}>
              <GlassCard style={styles.friendRow}>
                <View style={[styles.friendDot, { backgroundColor: item.color }]}>
                  <Text style={styles.friendDotText}>{item.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>{item.name}</Text>
                  <Text style={styles.friendHandle}>{item.handle}</Text>
                </View>
                <View style={[styles.checkbox, isSelected && { backgroundColor: cfg.color, borderColor: cfg.color }]}>
                  {isSelected && <Check size={13} color="#0f0f1a" />}
                </View>
              </GlassCard>
            </TouchableOpacity>
          );
        }}
      />

      <View style={{ padding: 14 }}>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: cfg.color }]}
          onPress={finishWithFriends}
        >
          <Text style={styles.createBtnText}>
            {selected.length ? `Add ${selected.length} friend${selected.length > 1 ? 's' : ''}` : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff' },
  glassWrap: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  back: { fontSize: 26 },
  title: { fontSize: 16, fontWeight: '700' },
  skip: { fontSize: 14, fontWeight: '600', color: '#4f46e5' },
  card: { padding: 14, marginBottom: 14, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: 26, fontWeight: '700' },
  avatarHint: { fontSize: 11.5, color: '#9ca3af', marginTop: 8 },
  input: { fontSize: 15, color: '#0f0f1a', paddingVertical: 10, width: '100%' },
  divider: { height: 1, backgroundColor: '#f0f0f3', width: '100%' },
  createBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  createBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  searchInput: {
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
  },
  friendRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, marginBottom: 8, gap: 10,
  },
  friendDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  friendDotText: { color: 'white', fontWeight: '700' },
  friendName: { fontSize: 14.5, fontWeight: '600', color: '#0f0f1a' },
  friendHandle: { fontSize: 11.5, color: '#9ca3af' },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c7c7d1',
    alignItems: 'center', justifyContent: 'center',
  },
  checkmark: { color: 'white', fontSize: 13, fontWeight: '700' },
});
