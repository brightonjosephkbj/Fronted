import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator, Modal, Share, FlatList, TextInput } from 'react-native';
import { BlurView } from 'expo-blur';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft, BadgeCheck, X, UserPlus, Check } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../context/AuthContext';

const INVITE_BASE_URL = 'b24meet://join';

function GlassCard({ style, children, blurAmount = 18, tint = 0.35 }) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={blurAmount} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(255,255,255,${tint})` }]} />
      {children}
    </View>
  );
}

const DOT_COLORS = ["#9333ea", "#f97316", "#0ea5a4", "#4f46e5", "#db2777",
  "#16a34a", "#ea580c", "#0891b2", "#7c3aed", "#c026d3"];
function colorForId(id) {
  return DOT_COLORS[id % DOT_COLORS.length];
}

export default function GroupSettingsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { apiRequest, user } = useAuth();
  const group = route.params?.group || {};
  const groupId = group.id;

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [sendPerm, setSendPerm] = useState('all');
  const [editPerm, setEditPerm] = useState('admins');
  const [busy, setBusy] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [addFriendsVisible, setAddFriendsVisible] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);

  const myRole = members.find(m => m.id === user?.id)?.role;
  const isOwner = myRole === 'owner';
  const canManage = myRole === 'admin' || isOwner;

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await apiRequest(`/groups/${groupId}/members/detailed`);
      setMembers(res.members || []);
      if (res.permissions) {
        setSendPerm(res.permissions.send_perm || 'all');
        setEditPerm(res.permissions.edit_perm || 'admins');
      }
    } catch (e) {
      // leave whatever we had
    }
  }, [groupId, apiRequest]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const showAddFriendsRow = canManage || editPerm === 'all';

  function guardGroupId() {
    if (!groupId) {
      Alert.alert('Missing group ID', "This group wasn't passed with an id, so nothing here can be wired up.");
      return false;
    }
    return true;
  }

  async function promote(memberId) {
    if (!guardGroupId() || busy) return;
    setBusy(true);
    try {
      await apiRequest(`/groups/${groupId}/members/${memberId}/promote`, { method: 'POST' });
      await load();
    } catch (e) {
      Alert.alert('Error', e.message || "Couldn't promote this member.");
    } finally {
      setBusy(false);
    }
  }

  async function demote(memberId) {
    if (!guardGroupId() || busy) return;
    setBusy(true);
    try {
      await apiRequest(`/groups/${groupId}/members/${memberId}/demote`, { method: 'POST' });
      await load();
    } catch (e) {
      Alert.alert('Error', e.message || "Couldn't demote this member.");
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove(member) {
    Alert.alert(
      `Remove ${member.username}?`,
      'They will be removed from this group.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => doRemove(member.id) },
      ]
    );
  }

  async function doRemove(memberId) {
    if (!guardGroupId() || busy) return;
    setBusy(true);
    try {
      await apiRequest(`/groups/${groupId}/members/${memberId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      Alert.alert('Error', e.message || "Couldn't remove this member.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePermission(key, value) {
    if (!guardGroupId()) return;
    const prevSend = sendPerm, prevEdit = editPerm;
    if (key === 'send_perm') setSendPerm(value); else setEditPerm(value);
    try {
      await apiRequest(`/groups/${groupId}/permissions`, {
        method: 'POST',
        body: JSON.stringify({ [key]: value }),
      });
    } catch (e) {
      setSendPerm(prevSend);
      setEditPerm(prevEdit);
      Alert.alert('Error', e.message || "Couldn't update permission.");
    }
  }

  async function showInvite() {
    if (!guardGroupId()) return;
    try {
      const res = await apiRequest(`/groups/${groupId}/invite`);
      setInviteCode(res.invite_code);
      setInviteVisible(true);
    } catch (e) {
      Alert.alert('Error', e.message || "Couldn't fetch the invite code.");
    }
  }

  async function shareInvite() {
    if (!inviteCode) return;
    try {
      await Share.share({
        message: `Join ${group.name || 'my group'} on B24 Messenger: ${INVITE_BASE_URL}/${inviteCode}`,
      });
    } catch (e) {
      // user cancelled or share failed silently
    }
  }

  async function openAddFriends() {
    if (!guardGroupId()) return;
    setFriendSearch('');
    setSelectedFriendIds([]);
    setAddFriendsVisible(true);
    try {
      const res = await apiRequest('/friends/list');
      const memberIds = members.map(m => String(m.id));
      const list = (res?.friends || [])
        .filter(f => !memberIds.includes(String(f.id)))
        .map(f => ({ id: f.id, username: f.username || f.handle || 'Friend', verified: f.verified }));
      setFriends(list);
    } catch (e) {
      Alert.alert('Error', e.message || "Couldn't load your friends list.");
    }
  }

  function toggleFriendSelect(id) {
    setSelectedFriendIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function submitAddFriends() {
    if (!selectedFriendIds.length) return;
    setAddingMembers(true);
    try {
      await apiRequest(`/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ member_ids: selectedFriendIds }),
      });
      setAddFriendsVisible(false);
      await load();
    } catch (e) {
      Alert.alert('Error', e.message || "Couldn't add those friends to the group.");
    } finally {
      setAddingMembers(false);
    }
  }

  function confirmClearHistory() {
    Alert.alert(
      'Clear chat history?',
      'This deletes every message in this group for everyone. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: doClearHistory },
      ]
    );
  }

  async function doClearHistory() {
    if (!guardGroupId()) return;
    try {
      await apiRequest(`/groups/${groupId}/messages`, { method: 'DELETE' });
      Alert.alert('Cleared', 'Chat history has been cleared.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Only admins can clear group history.');
    }
  }

  function confirmExit() {
    Alert.alert(
      'Exit group?',
      "You'll need a new invite to rejoin.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: doExit },
      ]
    );
  }

  async function doExit() {
    if (!guardGroupId()) return;
    try {
      await apiRequest(`/groups/${groupId}/leave`, { method: 'POST' });
      navigation.navigate('Main');
    } catch (e) {
      Alert.alert('Error', e.message || "Couldn't leave the group.");
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete group?',
      'This permanently deletes the group and all its messages for everyone. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]
    );
  }

  async function doDelete() {
    if (!guardGroupId()) return;
    try {
      await apiRequest(`/groups/${groupId}`, { method: 'DELETE' });
      navigation.navigate('Main');
    } catch (e) {
      Alert.alert('Error', e.message || 'Only the owner can delete this group.');
    }
  }

  function confirmReport() {
    Alert.alert(
      'Report this group?',
      'This sends a report to B24 for review.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', style: 'destructive', onPress: doReport },
      ]
    );
  }

  async function doReport() {
    if (!guardGroupId()) return;
    try {
      await apiRequest('/report/group', {
        method: 'POST',
        body: JSON.stringify({ group_id: groupId, reason: 'reported_from_group_settings' }),
      });
      Alert.alert('Reported', 'Thanks - our team will review this.');
    } catch (e) {
      Alert.alert('Error', e.message || "Couldn't send the report.");
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 14 }}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrap}>
          <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={14} />
          <Text style={styles.back}><ChevronLeft size={22} color="#0f0f1a" /></Text>
        </TouchableOpacity>
        <Text style={styles.title}>Group Settings</Text>
      </View>

      <GlassCard style={styles.centerCard}>
        <View style={[styles.groupAvatar, { backgroundColor: group.color || '#4f46e5' }]}>
          <Text style={styles.groupAvatarText}>{group.name?.[0]?.toUpperCase() || 'G'}</Text>
        </View>
        <Text style={styles.groupName}>{group.name || 'Group'}</Text>
        <Text style={styles.memberCount}>{members.length} members</Text>
      </GlassCard>

      {loading && <ActivityIndicator style={{ marginTop: 16 }} />}

      {!loading && (
        <>
          <Text style={styles.sectionTitle}>Members</Text>
          <GlassCard style={{ padding: 0 }}>
            {members.map((m, i) => (
              <View key={m.id} style={[styles.row, (i < members.length - 1 || showAddFriendsRow) && styles.rowBorder]}>
                <View style={[styles.memberDot, { backgroundColor: colorForId(m.id) }]}>
                  <Text style={styles.memberDotText}>{m.username?.[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.memberName}>{m.username}</Text>
                  {m.verified && <BadgeCheck size={14} color={m.verified === 'cyan' ? '#0ea5e9' : '#9333ea'} />}
                </View>
                {m.role !== 'member' && <Text style={styles.badge}>{m.role}</Text>}
                {canManage && m.id !== user?.id && m.role !== 'owner' && (m.role === 'member' || isOwner) && (
                  <View style={{ flexDirection: 'row', gap: 10, marginLeft: 8 }}>
                    {m.role === 'member' ? (
                      <TouchableOpacity onPress={() => promote(m.id)} disabled={busy}>
                        <Text style={styles.actionLink}>Promote</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => demote(m.id)} disabled={busy}>
                        <Text style={styles.actionLink}>Demote</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => confirmRemove(m)} disabled={busy}>
                      <Text style={[styles.actionLink, { color: '#ef4444' }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
            {showAddFriendsRow && (
              <TouchableOpacity
                style={styles.row}
                onPress={openAddFriends}
              >
                <View style={styles.addFriendIconWrap}>
                  <UserPlus size={16} color="#4f46e5" />
                </View>
                <Text style={styles.addFriendLabel}>Add Friends</Text>
              </TouchableOpacity>
            )}
          </GlassCard>

          <Text style={styles.sectionTitle}>Permissions</Text>
          <GlassCard style={{ padding: 0 }}>
            <View style={[styles.row, styles.rowBorder]}>
              <Text style={{ flex: 1 }}>Anyone can send messages</Text>
              <Switch
                value={sendPerm === 'all'}
                onValueChange={v => updatePermission('send_perm', v ? 'all' : 'admins')}
                disabled={!canManage}
              />
            </View>
            <View style={styles.row}>
              <Text style={{ flex: 1 }}>Anyone can edit group info</Text>
              <Switch
                value={editPerm === 'all'}
                onValueChange={v => updatePermission('edit_perm', v ? 'all' : 'admins')}
                disabled={!canManage}
              />
            </View>
          </GlassCard>

          <Text style={styles.sectionTitle}>Invite</Text>
          <GlassCard style={{ padding: 0 }}>
            <TouchableOpacity style={styles.row} onPress={showInvite}>
              <Text style={styles.rowLabel}>Invite link / code</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </GlassCard>

          <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Danger Zone</Text>
          <GlassCard style={{ padding: 0 }}>
            <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={confirmClearHistory}>
              <Text style={styles.dangerLabel}>Clear chat history</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={confirmExit}>
              <Text style={styles.dangerLabel}>Exit group</Text>
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={confirmDelete}>
                <Text style={styles.dangerLabel}>Delete group</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.row} onPress={confirmReport}>
              <Text style={styles.dangerLabel}>Report group</Text>
            </TouchableOpacity>
          </GlassCard>
        </>
      )}

      <View style={{ height: 30 }} />

      <Modal visible={inviteVisible} transparent animationType="fade" onRequestClose={() => setInviteVisible(false)}>
        <View style={styles.modalBackdrop}>
          <GlassCard style={styles.inviteCard} blurAmount={24} tint={0.55}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setInviteVisible(false)}>
              <X size={20} color="#0f0f1a" />
            </TouchableOpacity>
            <Text style={styles.inviteTitle}>Invite to {group.name || 'group'}</Text>
            {inviteCode && (
              <>
                <View style={styles.qrWrap}>
                  <QRCode value={`${INVITE_BASE_URL}/${inviteCode}`} size={180} />
                </View>
                <Text style={styles.inviteCodeText}>{inviteCode}</Text>
                <Text style={styles.inviteLinkText} numberOfLines={1}>{`${INVITE_BASE_URL}/${inviteCode}`}</Text>
                <TouchableOpacity style={styles.shareBtn} onPress={shareInvite}>
                  <Text style={styles.shareBtnText}>Share invite link</Text>
                </TouchableOpacity>
              </>
            )}
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={addFriendsVisible} transparent animationType="fade" onRequestClose={() => setAddFriendsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <GlassCard style={styles.addFriendsCard} blurAmount={24} tint={0.55}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setAddFriendsVisible(false)}>
              <X size={20} color="#0f0f1a" />
            </TouchableOpacity>
            <Text style={styles.inviteTitle}>Add friends to {group.name || 'group'}</Text>
            <TextInput
              style={styles.friendSearchInput}
              placeholder="Search friends..."
              placeholderTextColor="#9b9ba8"
              value={friendSearch}
              onChangeText={setFriendSearch}
            />
            <FlatList
              style={styles.friendList}
              data={friends.filter(f => f.username.toLowerCase().includes(friendSearch.toLowerCase()))}
              keyExtractor={f => String(f.id)}
              ListEmptyComponent={<Text style={styles.friendEmptyText}>No friends to add.</Text>}
              renderItem={({ item }) => {
                const isSelected = selectedFriendIds.includes(item.id);
                return (
                  <TouchableOpacity style={styles.friendRow} onPress={() => toggleFriendSelect(item.id)}>
                    <View style={[styles.memberDot, { backgroundColor: colorForId(item.id) }]}>
                      <Text style={styles.memberDotText}>{item.username?.[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={styles.memberName}>{item.username}</Text>
                      {item.verified && <BadgeCheck size={14} color={item.verified === 'cyan' ? '#0ea5e9' : '#9333ea'} />}
                    </View>
                    <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                      {isSelected && <Check size={14} color="white" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              style={[styles.shareBtn, !selectedFriendIds.length && styles.shareBtnDisabled]}
              onPress={submitAddFriends}
              disabled={!selectedFriendIds.length || addingMembers}
            >
              {addingMembers ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.shareBtnText}>
                  Add{selectedFriendIds.length ? ` (${selectedFriendIds.length})` : ''}
                </Text>
              )}
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff' },
  glassWrap: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  backBtnWrap: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  back: { fontSize: 22, color: '#0f0f1a' },
  title: { fontSize: 16, fontWeight: '700', color: '#0f0f1a' },
  centerCard: { padding: 20, alignItems: 'center', gap: 6, marginBottom: 16 },
  groupAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  groupAvatarText: { color: 'white', fontSize: 26, fontWeight: '700' },
  groupName: { fontSize: 16, fontWeight: '800', marginTop: 8, color: '#0f0f1a' },
  memberCount: { fontSize: 12, color: '#6b6b7a' },
  sectionTitle: { fontSize: 11.5, fontWeight: '700', color: '#6b6b7a', marginBottom: 6, marginTop: 16, textTransform: 'uppercase', marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)' },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#0f0f1a', flex: 1 },
  chevron: { fontSize: 18, color: '#c4c4cc' },
  memberDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  memberDotText: { color: 'white', fontWeight: '700' },
  memberName: { fontWeight: '600', color: '#0f0f1a' },
  badge: { fontSize: 10.5, fontWeight: '700', color: '#4f46e5', marginRight: 6 },
  actionLink: { fontSize: 12, fontWeight: '700', color: '#4f46e5' },
  dangerLabel: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,15,26,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  inviteCard: { width: '100%', padding: 24, alignItems: 'center', gap: 10 },
  closeBtn: { position: 'absolute', top: 12, right: 12, padding: 4 },
  inviteTitle: { fontSize: 15, fontWeight: '700', color: '#0f0f1a', marginBottom: 4, textAlign: 'center' },
  qrWrap: { backgroundColor: 'white', padding: 14, borderRadius: 16, marginVertical: 6 },
  inviteCodeText: { fontSize: 20, fontWeight: '800', letterSpacing: 2, color: '#4f46e5', marginTop: 4 },
  inviteLinkText: { fontSize: 11.5, color: '#6b6b7a', maxWidth: '100%' },
  shareBtn: { marginTop: 12, backgroundColor: '#4f46e5', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14, alignItems: 'center', justifyContent: 'center', minWidth: 120 },
  shareBtnDisabled: { backgroundColor: '#c4c4cc' },
  shareBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  addFriendIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: 'rgba(79,70,229,0.12)' },
  addFriendLabel: { fontWeight: '600', color: '#4f46e5' },
  addFriendsCard: { width: '100%', maxHeight: '75%', padding: 24, gap: 10 },
  friendSearchInput: { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f0f1a', marginTop: 4 },
  friendList: { maxHeight: 280, marginVertical: 6 },
  friendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  friendEmptyText: { textAlign: 'center', color: '#6b6b7a', fontSize: 13, paddingVertical: 20 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#c4c4cc', alignItems: 'center', justifyContent: 'center' },
  checkCircleSelected: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
});
