import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal,
  TextInput, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Eye, Radio, Send, X } from 'lucide-react-native';

const MY_STATUS = { id: 'me', name: 'My Status', color: '#4f46e5' };

const RECENT = [
  { id: '1', name: 'Joy', color: '#9333ea', viewed: false, segments: 3, time: '12m ago' },
  { id: '2', name: 'Derrick', color: '#f97316', viewed: false, segments: 1, time: '1h ago' },
];

const WATCHED = [
  { id: '3', name: 'Rita', color: '#db2777', viewed: true, segments: 2, time: 'Yesterday' },
  { id: '4', name: 'SafeBoda', color: '#0ea5a4', viewed: true, segments: 1, time: 'Yesterday' },
];

const CHANNELS = [
  { id: 'c1', name: 'B24 Announcements', color: '#0f172a', time: '3h ago' },
  { id: 'c2', name: 'Uganda Tech News', color: '#16a34a', time: '5h ago' },
];

function StatusCircle({ item, isMe, onOpen }) {
  return (
    <TouchableOpacity style={styles.circleWrap} onPress={() => onOpen(item)}>
      <View style={[styles.circleRing, { borderColor: item.viewed ? '#d1d5db' : item.color }]}>
        <View style={[styles.circleInner, { backgroundColor: item.color }]}>
          <Text style={styles.circleInitial}>{item.name[0]}</Text>
        </View>
      </View>
      {isMe && (
        <View style={styles.plusBadge}>
          <Text style={styles.plusBadgeText}>+</Text>
        </View>
      )}
      <Text style={styles.circleLabel} numberOfLines={1}>{isMe ? 'My Status' : item.name}</Text>
    </TouchableOpacity>
  );
}

function StoryViewer({ item, onClose }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 4000, useNativeDriver: false }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [item]);

  const widthInterpolate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[styles.storyScreen, { backgroundColor: item.color }]}>
      <View style={styles.storySegments}>
        {Array.from({ length: item.segments }).map((_, i) => (
          <View key={i} style={styles.segmentTrack}>
            <Animated.View style={[styles.segmentFill, i === 0 && { width: widthInterpolate }, i > 0 && { width: '0%' }]} />
          </View>
        ))}
      </View>
      <View style={styles.storyHeader}>
        <View style={styles.storyAvatar}><Text style={styles.storyAvatarText}>{item.name[0]}</Text></View>
        <Text style={styles.storyName}>{item.name}</Text>
        <Text style={styles.storyTime}>{item.time}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onClose}><X size={22} color="white" /></TouchableOpacity>
      </View>
      <View style={{ flex: 1 }} />
      <View style={styles.storyReplyRow}>
        <TextInput
          placeholder={`Reply to ${item.name}...`}
          placeholderTextColor="rgba(255,255,255,0.7)"
          style={styles.storyReplyInput}
        />
        <TouchableOpacity style={styles.storySendBtn}><Text style={{ color: 'white' }}><Send size={15} color="#0f0f1a" /></Text></TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Eye size={12} color="white" /><Text style={styles.storyViews}>14 views</Text></View>
    </View>
  );
}

export default function StatusScreen() {
  const navigation = useNavigation();
  const [watchedOpen, setWatchedOpen] = useState(false);
  const [openStory, setOpenStory] = useState(null);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backBtn}><ChevronLeft size={22} color="#0f0f1a" /></Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Status</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.circleRow}>
          <StatusCircle item={MY_STATUS} isMe onOpen={() => {}} />
          {RECENT.map(item => <StatusCircle key={item.id} item={item} onOpen={setOpenStory} />)}
        </ScrollView>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Channels</Text>
          <View style={styles.card}>
            {CHANNELS.map((c, i) => (
              <View key={c.id} style={[styles.channelRow, i < CHANNELS.length - 1 && styles.rowBorder]}>
                <View style={[styles.channelIcon, { backgroundColor: c.color }]}><Radio size={16} color="white" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.channelName}>{c.name}</Text>
                  <Text style={styles.channelTime}>{c.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.watchedHeader} onPress={() => setWatchedOpen(v => !v)}>
            <Text style={styles.watchedTitle}>Watched ({WATCHED.length})</Text>
            <Text style={styles.chevron}>{watchedOpen ? '⌃' : '⌄'}</Text>
          </TouchableOpacity>
          {watchedOpen && (
            <View style={[styles.card, { marginTop: 8 }]}>
              {WATCHED.map((w, i) => (
                <TouchableOpacity key={w.id} onPress={() => setOpenStory(w)} style={[styles.channelRow, i < WATCHED.length - 1 && styles.rowBorder]}>
                  <View style={[styles.channelIcon, { backgroundColor: w.color, borderRadius: 22 }]}><Text style={{ color: 'white', fontWeight: '700' }}>{w.name[0]}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.channelName}>{w.name}</Text>
                    <Text style={styles.channelTime}>{w.time}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={!!openStory} animationType="fade" onRequestClose={() => setOpenStory(null)}>
        {openStory && <StoryViewer item={openStory} onClose={() => setOpenStory(null)} />}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f6fa' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18, paddingBottom: 6 },
  backBtn: { fontSize: 26, color: '#0f0f1a' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0f0f1a' },
  circleRow: { paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  circleWrap: { alignItems: 'center', width: 64 },
  circleRing: { width: 58, height: 58, borderRadius: 29, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  circleInner: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  circleInitial: { color: 'white', fontWeight: '700' },
  plusBadge: { position: 'absolute', bottom: 20, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#0f0f1a', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white' },
  plusBadgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
  circleLabel: { fontSize: 10.5, fontWeight: '600', color: '#0f0f1a', marginTop: 6 },
  section: { paddingHorizontal: 20, marginTop: 10 },
  sectionTitle: { fontSize: 11.5, fontWeight: '700', color: '#6b6b7a', marginBottom: 8, textTransform: 'uppercase' },
  card: { backgroundColor: 'white', borderRadius: 16, overflow: 'hidden' },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f3' },
  channelIcon: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  channelName: { fontSize: 13.5, fontWeight: '700', color: '#0f0f1a' },
  channelTime: { fontSize: 11, color: '#9ca3af' },
  watchedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', borderRadius: 16, padding: 14 },
  watchedTitle: { fontSize: 13.5, fontWeight: '700', color: '#0f0f1a' },
  chevron: { fontSize: 16, color: '#6b6b7a' },
  storyScreen: { flex: 1 },
  storySegments: { flexDirection: 'row', gap: 4, padding: 10, paddingTop: 40 },
  segmentTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  segmentFill: { height: '100%', backgroundColor: 'white' },
  storyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  storyAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  storyAvatarText: { color: 'white', fontWeight: '700' },
  storyName: { color: 'white', fontWeight: '700', fontSize: 14 },
  storyTime: { color: 'rgba(255,255,255,0.7)', fontSize: 11.5 },
  storyClose: { color: 'white', fontSize: 20 },
  storyReplyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  storyReplyInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: 'white', fontSize: 13 },
  storySendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  storyViews: { textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 11, paddingBottom: 10 },
});
