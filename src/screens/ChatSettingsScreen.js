import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, ImageBackground,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';

function GlassCard({ style, children, blurAmount = 18, tint = 0.35 }) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={blurAmount} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(255,255,255,${tint})` }]} />
      {children}
    </View>
  );
}

// Resolves a user's custom background. Until they set a photo/video,
// this always falls back to a plain color (their chat.color or a default indigo).
function resolveBackground(chat) {
  const bg = chat.customBackground; // expected shape: { type: 'color'|'photo'|'video', value }
  if (bg?.type === 'photo' && bg.value) {
    return { type: 'photo', value: bg.value };
  }
  if (bg?.type === 'video' && bg.value) {
    return { type: 'video', value: bg.value };
  }
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
  const chat = route.params?.chat || { id: 'unknown', name: 'Unknown', color: '#9333ea' };
  const [fullscreenPic, setFullscreenPic] = useState(false);

  const background = resolveBackground(chat);

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrap}>
          <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={14} />
          <Text style={styles.backBtn}><ChevronLeft size={22} color="#0f0f1a" /></Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat Settings</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingTop: 6 }}>
        {/* profile header */}
        <GlassCard style={styles.profileCard}>
          <TouchableOpacity onPress={() => setFullscreenPic(true)}>
            <View style={[styles.profileAvatar, { backgroundColor: chat.color || '#9333ea' }]}>
              <Text style={styles.profileAvatarText}>{chat.name?.[0]?.toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{chat.name}</Text>
          <Text style={styles.profileAbout}>{chat.about || 'Building B24 one bug at a time 🛠️'}</Text>
        </GlassCard>

        {/* sections */}
        {SECTIONS.map(section => (
          <View key={section.title} style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, section.danger && { color: '#ef4444' }]}>{section.title}</Text>
            <GlassCard style={{ padding: 0 }}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.row, i < section.items.length - 1 && styles.rowBorder]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, section.danger && { color: '#ef4444' }]}>{item.label}</Text>
                    {item.sub && <Text style={styles.rowSub}>{item.sub}</Text>}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </GlassCard>
          </View>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* full-screen profile picture, backdrop = that user's own custom background */}
      <Modal visible={fullscreenPic} animationType="fade" onRequestClose={() => setFullscreenPic(false)}>
        {background.type === 'photo' ? (
          <ImageBackground source={{ uri: background.value }} style={styles.fullscreenBg}>
            <FullscreenContent chat={chat} onBack={() => setFullscreenPic(false)} />
          </ImageBackground>
        ) : background.type === 'video' ? (
          // Video backdrop: swap in react-native-video here once video URLs are wired up.
          // Falls back to a color tile in the meantime so nothing breaks.
          <View style={[styles.fullscreenBg, { backgroundColor: chat.color || '#4f46e5' }]}>
            <FullscreenContent chat={chat} onBack={() => setFullscreenPic(false)} />
          </View>
        ) : (
          <View style={[styles.fullscreenBg, { backgroundColor: background.value }]}>
            <FullscreenContent chat={chat} onBack={() => setFullscreenPic(false)} />
          </View>
        )}
      </Modal>
    </View>
  );
}

function FullscreenContent({ chat, onBack }) {
  return (
    <>
      <BlurView style={StyleSheet.absoluteFill} blurType="dark" blurAmount={20} />
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
});
