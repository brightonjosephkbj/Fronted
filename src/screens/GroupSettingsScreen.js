import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';

const MEMBERS = [
  { id: '1', name: 'Henry', color: '#4f46e5', role: 'owner' },
  { id: '2', name: 'Derrick', color: '#f97316', role: 'admin' },
  { id: '3', name: 'Rita', color: '#db2777', role: 'member' },
];

export default function GroupSettingsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const group = route.params?.group || { name: 'Group', color: '#4f46e5' };
  const [members, setMembers] = useState(MEMBERS);
  const [sendPerm, setSendPerm] = useState(true);
  const [editPerm, setEditPerm] = useState(false);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 14 }}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}><ChevronLeft size={22} color="#0f0f1a" /></Text></TouchableOpacity>
        <Text style={styles.title}>Group Settings</Text>
      </View>

      <View style={styles.card}>
        <View style={[styles.groupAvatar, { backgroundColor: group.color }]}>
          <Text style={styles.groupAvatarText}>{group.name[0]}</Text>
        </View>
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.memberCount}>{members.length} members</Text>
      </View>

      <Text style={styles.sectionTitle}>Members</Text>
      <View style={styles.card}>
        {members.map(m => (
          <View key={m.id} style={styles.row}>
            <View style={[styles.memberDot, { backgroundColor: m.color }]}><Text style={styles.memberDotText}>{m.name[0]}</Text></View>
            <Text style={{ flex: 1, fontWeight: '600' }}>{m.name}</Text>
            {m.role !== 'member' && <Text style={styles.badge}>{m.role}</Text>}
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Permissions</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={{ flex: 1 }}>Who can send messages</Text>
          <Switch value={sendPerm} onValueChange={setSendPerm} />
        </View>
        <View style={styles.row}>
          <Text style={{ flex: 1 }}>Who can edit group info</Text>
          <Switch value={editPerm} onValueChange={setEditPerm} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Invite</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.row}><Text>Invite link</Text></TouchableOpacity>
        <TouchableOpacity style={styles.row}><Text>QR code</Text></TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Danger Zone</Text>
      <View style={styles.card}>
        {['Mute notifications', 'Clear chat history', 'Exit group', 'Delete group', 'Report group'].map(l => (
          <TouchableOpacity key={l} style={styles.row}><Text style={{ color: '#ef4444' }}>{l}</Text></TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  back: { fontSize: 26 },
  title: { fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 14, marginBottom: 14, alignItems: 'center' },
  groupAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  groupAvatarText: { color: 'white', fontSize: 26, fontWeight: '700' },
  groupName: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  memberCount: { fontSize: 12, color: '#9ca3af' },
  sectionTitle: { fontSize: 11.5, fontWeight: '700', color: '#6b6b7a', marginBottom: 6, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f3' },
  memberDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  memberDotText: { color: 'white', fontWeight: '700' },
  badge: { fontSize: 10.5, fontWeight: '700', color: '#4f46e5' },
});
