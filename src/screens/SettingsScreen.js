import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Image, Modal } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import Avatar from '../components/Avatar';

function GlassCard({ style, children, blurAmount = 18, tint = 0.35 }) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={blurAmount} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(255,255,255,${tint})` }]} />
      {children}
    </View>
  );
}

function resolveBackground(banner) {
  if (banner?.type === 'photo' && banner.value) return { type: 'photo', value: banner.value };
  return { type: 'color', value: banner?.value || '#ffffff' };
}

function verifiedColor(tick) {
  if (tick === 'cyan') return '#06b6d4';
  if (tick === 'blue') return '#3b82f6';
  return '#a855f7'; // purple default
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { user, logout, apiRequest } = useAuth();

  const [lastSeen, setLastSeen] = useState(true);
  const [freezeLastSeen, setFreezeLastSeen] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [profilePhotoVisible, setProfilePhotoVisible] = useState(true);
  const [antiDelete, setAntiDelete] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [bannerPreviewOpen, setBannerPreviewOpen] = useState(false);

  const banner = resolveBackground(user?.banner);

  async function handleLogout() {
    try { await apiRequest('/auth/logout', { method: 'POST' }); } catch (e) {}
    logout();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 14 }}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrap}>
          <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={14} />
          <ChevronLeft size={22} color="#0f0f1a" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setBannerPreviewOpen(true)}
        style={[styles.profileCard, { backgroundColor: banner.type === 'color' ? banner.value : '#ffffff' }]}
      >
        {banner.type === 'photo' && (
          <Image source={{ uri: banner.value }} style={StyleSheet.absoluteFillObject} />
        )}
        <GlassCard style={styles.profileInner} tint={0.4}>
          <Avatar
            uri={user?.avatar_url}
            letter={user?.username?.[0]}
            size={76}
          />
          <Text style={styles.name}>{user?.username || 'you'}</Text>
          <Text style={styles.username}>{user?.username}@b24.me</Text>
          <Text style={styles.bio}>{user?.bio || "Hey there, I'm using B24"}</Text>
        </GlassCard>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Account & Identity</Text>
      <GlassCard style={{ padding: 0 }}>
        <Row label="Username" sub={user?.username} />
        <Row label="Phone number" sub={user?.phone || 'Not set'} />
        <Row label="Two-step verification" sub="Off" last />
      </GlassCard>

      <Text style={styles.sectionTitle}>Profile Banner</Text>
      <GlassCard style={{ padding: 0 }}>
        <NavRow label="Change banner" sub={banner.type === 'photo' ? 'Photo' : 'Color'} onPress={() => {}} last />
      </GlassCard>

      <Text style={styles.sectionTitle}>Privacy</Text>
      <GlassCard style={{ padding: 0 }}>
        <ToggleRow label="Last seen & online" value={lastSeen} onChange={setLastSeen} />
        <ToggleRow label="Freeze last seen" value={freezeLastSeen} onChange={setFreezeLastSeen} />
        <ToggleRow label="Ghost mode" value={ghostMode} onChange={setGhostMode} />
        <ToggleRow label="Profile photo visibility" value={profilePhotoVisible} onChange={setProfilePhotoVisible} />
        <NavRow label="Blocked contacts" sub="0" onPress={() => {}} />
        <ToggleRow label="Read receipts" value={readReceipts} onChange={setReadReceipts} />
        <ToggleRow label="Anti-delete messages" value={antiDelete} onChange={setAntiDelete} last />
      </GlassCard>

      <Text style={styles.sectionTitle}>Notifications</Text>
      <GlassCard style={{ padding: 0 }}>
        <ToggleRow label="Message notifications" value={notifications} onChange={setNotifications} last />
      </GlassCard>

      <Text style={styles.sectionTitle}>Chats</Text>
      <GlassCard style={{ padding: 0 }}>
        <NavRow label="Default wallpaper" sub="Papercut" onPress={() => {}} />
        <NavRow label="Font size" sub="Medium" onPress={() => {}} />
        <NavRow label="Chat backup" sub="Never" onPress={() => {}} last />
      </GlassCard>

      <Text style={styles.sectionTitle}>Storage & Data</Text>
      <GlassCard style={{ padding: 0 }}>
        <NavRow label="Manage storage" onPress={() => {}} />
        <NavRow label="Network usage" onPress={() => {}} last />
      </GlassCard>

      <Text style={styles.sectionTitle}>Help & About</Text>
      <GlassCard style={{ padding: 0 }}>
        <NavRow label="Help center" onPress={() => {}} />
        <NavRow label="Terms & Privacy Policy" onPress={() => {}} />
        <Row label="App version" sub="1.0.0" last />
      </GlassCard>

      <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Danger Zone</Text>
      <GlassCard style={{ padding: 0 }}>
        <TouchableOpacity style={styles.row} onPress={handleLogout}>
          <Text style={styles.dangerText}>Log out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.row, styles.rowLast]}>
          <Text style={styles.dangerText}>Delete account</Text>
        </TouchableOpacity>
      </GlassCard>

      <View style={{ height: 30 }} />

      <Modal visible={bannerPreviewOpen} transparent animationType="fade" onRequestClose={() => setBannerPreviewOpen(false)}>
        <View style={[styles.bannerModal, { backgroundColor: banner.type === 'color' ? banner.value : '#000' }]}>
          {banner.type === 'photo' && (
            <Image source={{ uri: banner.value }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          )}
          <TouchableOpacity style={styles.bannerCloseBtn} onPress={() => setBannerPreviewOpen(false)}>
            <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={20} />
            <X size={20} color="#0f0f1a" />
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Row({ label, sub, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      {sub && <Text style={styles.rowSub}>{sub}</Text>}
    </View>
  );
}

function NavRow({ label, sub, onPress, last }) {
  return (
    <TouchableOpacity style={[styles.row, last && styles.rowLast]} onPress={onPress}>
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      {sub && <Text style={styles.rowSub}>{sub}</Text>}
      <ChevronRight size={16} color="#9ca3af" style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

function ToggleRow({ label, value, onChange, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff' },
  glassWrap: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  backBtnWrap: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  title: { fontSize: 16, fontWeight: '700' },
  profileCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
  profileInner: { padding: 22, alignItems: 'center', gap: 6, borderRadius: 20, marginBottom: 0 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 76, height: 76, borderRadius: 38 },
  verifiedBadge: {
    position: 'absolute', bottom: -1, right: -1, width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff',
  },
  avatarFallback: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: 28, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  name: { fontSize: 16.5, fontWeight: '800' },
  username: { fontSize: 12, color: '#6b6b7a' },
  bio: { fontSize: 12.5, color: '#6b6b7a', textAlign: 'center' },
  sectionTitle: { fontSize: 11.5, fontWeight: '700', color: '#6b6b7a', textTransform: 'uppercase', marginBottom: 6, marginLeft: 4, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)' },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#0f0f1a' },
  rowSub: { fontSize: 12, color: '#9ca3af', marginLeft: 'auto' },
  dangerText: { color: '#ef4444', fontWeight: '600' },
  bannerModal: { flex: 1, alignItems: 'flex-end' },
  bannerCloseBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', margin: 16, marginTop: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
});
