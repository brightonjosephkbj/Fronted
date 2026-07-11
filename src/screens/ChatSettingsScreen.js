import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, ImageBackground, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const CHAT_WALLPAPER_KEY = 'b24_chat_wallpapers';
const CHAT_BUBBLE_COLOR_KEY = 'b24_chat_bubble_colors';
const WALLPAPER_COLORS = ['#4f46e5', '#9333ea', '#f97316', '#0ea5a4', '#db2777', '#16a34a', '#0f172a', '#eab308'];

function GlassCard({ style, children, blurAmount = 18, tint = 0.35 }) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={blurAmount} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(255,255,255,${tint})` }]} />
      {children}
    </View>
  );
}

function resolveBackground(chat) {
  const bg = chat.customBackground;
  if (bg?.type === 'photo' && bg.value) return { type: 'photo', value: bg.value };
  if (bg?.type === 'video' && bg.value) return { type: 'video', value: bg.value };
  return { type: 'color', value: bg?.value || chat.color || '#4f46e5' };
}

const SECTIONS = [
  {
    title: 'Appearance',
    items: [
      { key: 'wallpaper', label: 'Wallpaper', sub: 'Dark papercut (default)' },
      { key: 'chatcolor', label: 'Chat color', sub: 'Bubble color override' },
      { key: 'font', label: 'Font type', sub: 'Default' },
    ],
  },
  {
    title: 'Privacy & Security',
    items: [
      { key: 'lock', label: 'Lock this chat', sub: 'Off' },
      { key: 'antidelete', label: 'Anti-delete messages', sub: 'Show placeholder' },
      { key: 'disappearing', label: 'Disappearing messages', sub: 'Off' },
      { key: 'encryption', label: 'Encryption info' },
    ],
  },
  {
    title: 'Data',
    items: [
      { key: 'media', label: 'Media, links & docs', sub: '128 items' },
      { key: 'search', label: 'Search in chat' },
      { key: 'export', label: 'Export chat' },
    ],
  },
  {
    title: 'Danger Zone',
    danger: true,
    items: [
      { key: 'block', label: 'Block contact' },
      { key: 'reportspam', label: 'Report spam/scam' },
      { key: 'restrict', label: 'Restrict account' },
      { key: 'unfriend', label: 'Unfriend / Remove contact' },
      { key: 'delete', label: 'Delete chat' },
      { key: 'clear', label: 'Clear chat history' },
      { key: 'mute', label: 'Mute notifications' },
    ],
  },
];

export default function ChatSettingsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { apiRequest } = useAuth();
  const chat = route.params?.chat || { id: 'unknown', name: 'Unknown', color: '#9333ea' };
  const [fullscreenPic, setFullscreenPic] = useState(false);
  const [muted, setMuted] = useState(!!chat.muted);
  const [busy, setBusy] = useState(false);
  const [chatWallpaper, setChatWallpaper] = useState(null);
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const [chatBubbleColor, setChatBubbleColor] = useState(null);
  const [bubbleColorPickerOpen, setBubbleColorPickerOpen] = useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const [wpRaw, bcRaw] = await Promise.all([
          AsyncStorage.getItem(CHAT_WALLPAPER_KEY),
          AsyncStorage.getItem(CHAT_BUBBLE_COLOR_KEY),
        ]);
        const wpMap = wpRaw ? JSON.parse(wpRaw) : {};
        const bcMap = bcRaw ? JSON.parse(bcRaw) : {};
        setChatWallpaper(wpMap[chat.id] || null);
        setChatBubbleColor(bcMap[chat.id] || null);
      } catch (e) {
        // fall back to no override
      }
    })();
  }, [chat.id]);

  async function handleSelectChatWallpaper(color) {
    setChatWallpaper(color);
    setWallpaperPickerOpen(false);
    try {
      const raw = await AsyncStorage.getItem(CHAT_WALLPAPER_KEY);
      const map = raw ? JSON.parse(raw) : {};
      if (color) map[chat.id] = color;
      else delete map[chat.id];
      await AsyncStorage.setItem(CHAT_WALLPAPER_KEY, JSON.stringify(map));
    } catch (e) {
      Alert.alert('Error', "Couldn't save wallpaper for this chat. Try again.");
    }
  }

  async function handleSelectChatBubbleColor(color) {
    setChatBubbleColor(color);
    setBubbleColorPickerOpen(false);
    try {
      const raw = await AsyncStorage.getItem(CHAT_BUBBLE_COLOR_KEY);
      const map = raw ? JSON.parse(raw) : {};
      if (color) map[chat.id] = color;
      else delete map[chat.id];
      await AsyncStorage.setItem(CHAT_BUBBLE_COLOR_KEY, JSON.stringify(map));
    } catch (e) {
      Alert.alert('Error', "Couldn't save chat color. Try again.");
    }
  }

  const background = resolveBackground(chat);
  const friendId = parseInt(chat.id, 10);

  function showComingSoon(label) {
    Alert.alert(label, "This isn't wired up yet — coming in a future update.");
  }

  async function toggleMute() {
    if (busy) return;
    const next = !muted;
    setBusy(true);
    try {
      await apiRequest(`/chats/${chat.id}/mute`, {
        method: 'POST',
        body: JSON.stringify({ muted: next, is_group: !!chat.isGroup }),
      });
      setMuted(next);
    } catch (e) {
      Alert.alert('Error', "Couldn't update mute setting. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  function confirmBlock() {
    Alert.alert(
      `Block ${chat.name}?`,
      "They won't be able to message you, and you won't see their messages.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: doBlock },
      ]
    );
  }

  async function doBlock() {
    setBusy(true);
    try {
      await apiRequest('/friends/block', {
        method: 'POST',
        body: JSON.stringify({ user_id: friendId }),
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', "Couldn't block this contact. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function confirmUnfriend() {
    Alert.alert(
      `Remove ${chat.name}?`,
      "You'll no longer be friends. They can send you a new friend request later.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doUnfriend },
      ]
    );
  }

  async function doUnfriend() {
    setBusy(true);
    try {
      await apiRequest('/friends/remove', {
        method: 'POST',
        body: JSON.stringify({ friend_id: friendId }),
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', "Couldn't remove this contact. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function confirmReport() {
    Alert.alert(
      `Report ${chat.name}?`,
      'This sends a report to B24 for review.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', style: 'destructive', onPress: doReport },
      ]
    );
  }

  async function doReport() {
    setBusy(true);
    try {
      await apiRequest('/report/user', {
        method: 'POST',
        body: JSON.stringify({ reported_user_id: friendId, reason: 'spam_or_scam' }),
      });
      Alert.alert('Reported', 'Thanks — our team will review this.');
    } catch (e) {
      Alert.alert('Error', "Couldn't send the report. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const actions = {
    mute: toggleMute,
    block: confirmBlock,
    unfriend: confirmUnfriend,
    reportspam: confirmReport,
    wallpaper: () => setWallpaperPickerOpen(true),
    chatcolor: () => setBubbleColorPickerOpen(true),
  };

  function renderSub(item) {
    if (item.key === 'mute') return muted ? 'On' : 'Off';
    if (item.key === 'wallpaper') return chatWallpaper ? 'Custom color' : 'Same as default';
    if (item.key === 'chatcolor') return chatBubbleColor ? 'Custom color' : 'Bubble color override';
    return item.sub;
  }

  function handlePress(item) {
    if (actions[item.key]) return actions[item.key]();
    showComingSoon(item.label);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrap}>
          <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={14} />
          <Text style={styles.backBtn}><ChevronLeft size={22} color="#0f0f1a" /></Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat Settings</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingTop: 6 }}>
        <GlassCard style={styles.profileCard}>
          <TouchableOpacity onPress={() => setFullscreenPic(true)}>
            <View style={[styles.profileAvatar, { backgroundColor: chat.color || '#9333ea' }]}>
              <Text style={styles.profileAvatarText}>{chat.name?.[0]?.toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{chat.name}</Text>
          <Text style={styles.profileAbout}>{chat.about || 'Building B24 one bug at a time 🛠️'}</Text>
        </GlassCard>

        {SECTIONS.map(section => (
          <View key={section.title} style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, section.danger && { color: '#ef4444' }]}>{section.title}</Text>
            <GlassCard style={{ padding: 0 }}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.row, i < section.items.length - 1 && styles.rowBorder]}
                  onPress={() => handlePress(item)}
                  disabled={busy}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, section.danger && { color: '#ef4444' }]}>{item.label}</Text>
                    {renderSub(item) && <Text style={styles.rowSub}>{renderSub(item)}</Text>}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </GlassCard>
          </View>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={fullscreenPic} animationType="fade" onRequestClose={() => setFullscreenPic(false)}>
        {background.type === 'photo' ? (
          <ImageBackground source={{ uri: background.value }} style={styles.fullscreenBg}>
            <FullscreenContent chat={chat} onBack={() => setFullscreenPic(false)} />
          </ImageBackground>
        ) : background.type === 'video' ? (
          <View style={[styles.fullscreenBg, { backgroundColor: chat.color || '#4f46e5' }]}>
            <FullscreenContent chat={chat} onBack={() => setFullscreenPic(false)} />
          </View>
        ) : (
          <View style={[styles.fullscreenBg, { backgroundColor: background.value }]}>
            <FullscreenContent chat={chat} onBack={() => setFullscreenPic(false)} />
          </View>
        )}
      </Modal>

      <Modal visible={wallpaperPickerOpen} transparent animationType="fade" onRequestClose={() => setWallpaperPickerOpen(false)}>
        <View style={styles.pickerBackdrop}>
          <GlassCard style={styles.pickerCard} tint={0.85}>
            <Text style={styles.pickerTitle}>Wallpaper for {chat.name}</Text>
            <View style={styles.pickerGrid}>
              <TouchableOpacity
                onPress={() => handleSelectChatWallpaper(null)}
                style={[styles.pickerSwatch, { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }, !chatWallpaper && styles.pickerSwatchActive]}
              >
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#6b6b7a' }}>Default</Text>
              </TouchableOpacity>
              {WALLPAPER_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  onPress={() => handleSelectChatWallpaper(color)}
                  style={[styles.pickerSwatch, { backgroundColor: color }, chatWallpaper === color && styles.pickerSwatchActive]}
                />
              ))}
            </View>
            <TouchableOpacity onPress={() => setWallpaperPickerOpen(false)} style={styles.pickerCancel}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={bubbleColorPickerOpen} transparent animationType="fade" onRequestClose={() => setBubbleColorPickerOpen(false)}>
        <View style={styles.pickerBackdrop}>
          <GlassCard style={styles.pickerCard} tint={0.85}>
            <Text style={styles.pickerTitle}>Chat color for {chat.name}</Text>
            <View style={styles.pickerGrid}>
              <TouchableOpacity
                onPress={() => handleSelectChatBubbleColor(null)}
                style={[styles.pickerSwatch, { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }, !chatBubbleColor && styles.pickerSwatchActive]}
              >
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#6b6b7a' }}>Default</Text>
              </TouchableOpacity>
              {WALLPAPER_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  onPress={() => handleSelectChatBubbleColor(color)}
                  style={[styles.pickerSwatch, { backgroundColor: color }, chatBubbleColor === color && styles.pickerSwatchActive]}
                />
              ))}
            </View>
            <TouchableOpacity onPress={() => setBubbleColorPickerOpen(false)} style={styles.pickerCancel}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

function FullscreenContent({ chat, onBack }) {
  return (
    <>
      <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={20} />
      <View style={styles.fullscreenHeader}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.fullscreenBack}><ChevronLeft size={22} color="#0f0f1a" /></Text>
        </TouchableOpacity>
      </View>
      <View style={styles.fullscreenCenter}>
        <View style={[styles.fullscreenImage, { backgroundColor: chat.color || '#9333ea' }]}>
          <Text style={styles.fullscreenImageText}>{chat.name?.[0]?.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.fullscreenName}>{chat.name}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff' },
  glassWrap: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingTop: 18 },
  backBtnWrap: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  backBtn: { fontSize: 22, color: '#0f0f1a' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#0f0f1a' },
  profileCard: { padding: 22, alignItems: 'center', gap: 8 },
  profileAvatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: 'white', fontSize: 32, fontWeight: '700' },
  profileName: { fontSize: 17, fontWeight: '800', color: '#0f0f1a', marginTop: 4 },
  profileAbout: { fontSize: 12.5, color: '#6b6b7a', textAlign: 'center' },
  sectionTitle: { fontSize: 11.5, fontWeight: '700', color: '#6b6b7a', textTransform: 'uppercase', marginBottom: 6, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)' },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#0f0f1a' },
  rowSub: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  chevron: { fontSize: 18, color: '#c4c4cc' },
  fullscreenBg: { flex: 1 },
  fullscreenHeader: { padding: 18, paddingTop: 40 },
  fullscreenBack: { fontSize: 26, color: 'white' },
  fullscreenCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fullscreenImage: { width: 240, height: 240, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  fullscreenImageText: { color: 'white', fontSize: 84, fontWeight: '700' },
  fullscreenName: { textAlign: 'center', color: 'white', fontSize: 15, fontWeight: '700', paddingBottom: 30 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  pickerCard: { width: '100%', maxWidth: 320, padding: 20, borderRadius: 24, alignItems: 'center' },
  pickerTitle: { fontSize: 15, fontWeight: '800', color: '#0f0f1a', marginBottom: 16, textAlign: 'center' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  pickerSwatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'transparent' },
  pickerSwatchActive: { borderColor: '#0f0f1a' },
  pickerCancel: { marginTop: 18 },
  pickerCancelText: { color: '#6b6b7a', fontWeight: '700', fontSize: 13.5 },
});
