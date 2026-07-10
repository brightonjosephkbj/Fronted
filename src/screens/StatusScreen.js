import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal,
  TextInput, Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Eye, Radio, Send, X, Plus, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const PALETTE = ["#9333ea", "#f97316", "#0ea5a4", "#4f46e5", "#db2777", "#16a34a", "#ea580c", "#0891b2", "#7c3aed", "#c026d3"];
function colorForId(id) {
  const n = typeof id === 'number' ? id : String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[n % PALETTE.length];
}

function timeAgo(unixSeconds) {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function GlassCard({ style, children, blurAmount = 18, tint = 0.35 }) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={blurAmount} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(255,255,255,${tint})` }]} />
      {children}
    </View>
  );
}

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
          <Plus size={12} color="white" strokeWidth={3} />
        </View>
      )}
      <Text style={styles.circleLabel} numberOfLines={1}>{isMe ? 'My Status' : item.name}</Text>
    </TouchableOpacity>
  );
}

function StoryViewer({ item, onClose }) {
  const [segIndex, setSegIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setSegIndex(0);
  }, [item]);

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: 4000, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (!finished) return;
      if (segIndex < item.segments - 1) setSegIndex(i => i + 1);
      else onClose();
    });
    return () => anim.stop();
  }, [item, segIndex]);

  const widthInterpolate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[styles.storyScreen, { backgroundColor: item.color }]}>
      <View style={styles.storySegments}>
        {Array.from({ length: item.segments }).map((_, i) => (
          <View key={i} style={styles.segmentTrack}>
            <Animated.View style={[
              styles.segmentFill,
              i < segIndex && { width: '100%' },
              i === segIndex && { width: widthInterpolate },
              i > segIndex && { width: '0%' },
            ]} />
          </View>
        ))}
      </View>

      <View style={styles.storyHeaderWrap}>
        <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={20} />
        <View style={styles.storyHeader}>
          <View style={styles.storyAvatar}><Text style={styles.storyAvatarText}>{item.name[0]}</Text></View>
          <Text style={styles.storyName}>{item.name}</Text>
          <Text style={styles.storyTime}>{item.time}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={onClose}><X size={22} color="white" /></TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.storyFooterWrap}>
        <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={20} />
        <View style={styles.storyReplyRow}>
          <TextInput
            placeholder={`Reply to ${item.name}...`}
            placeholderTextColor="rgba(255,255,255,0.7)"
            style={styles.storyReplyInput}
          />
          <TouchableOpacity style={styles.storySendBtn}>
            <Send size={15} color="white" />
          </TouchableOpacity>
        </View>
        <View style={styles.storyViewsRow}>
          <Eye size={12} color="rgba(255,255,255,0.7)" />
          <Text style={styles.storyViews}>14 views</Text>
        </View>
      </View>
    </View>
  );
}

function ComposeModal({ visible, onClose, onPosted }) {
  const { apiUpload } = useAuth();
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const bgColors = ['#4f46e5', '#db2777', '#16a34a', '#ea580c', '#0891b2'];
  const [bg, setBg] = useState(bgColors[0]);

  async function handlePost() {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const form = new FormData();
      form.append('content_type', 'text');
      form.append('text_content', text.trim());
      form.append('bg_color', bg);
      form.append('privacy', 'all');
      await apiUpload('/status/post', form);
      setText('');
      onPosted();
      onClose();
    } catch (e) {
      console.log('Failed to post status:', e);
    } finally {
      setPosting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.storyScreen, { backgroundColor: bg }]}>
        <View style={styles.composeHeader}>
          <TouchableOpacity onPress={onClose}><X size={24} color="white" /></TouchableOpacity>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {bgColors.map(c => (
              <TouchableOpacity key={c} onPress={() => setBg(c)} style={[styles.bgSwatch, { backgroundColor: c }, bg === c && styles.bgSwatchActive]} />
            ))}
          </View>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a status..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={styles.composeInput}
            multiline
            autoFocus
          />
        </View>
        <TouchableOpacity style={styles.composeSendBtn} onPress={handlePost} disabled={!text.trim() || posting}>
          <Send size={18} color={bg} />
          <Text style={[styles.composeSendText, { color: bg }]}>{posting ? 'Posting...' : 'Post status'}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export default function StatusScreen() {
  const navigation = useNavigation();
  const { user, apiRequest } = useAuth();
  const [watchedOpen, setWatchedOpen] = useState(false);
  const [openStory, setOpenStory] = useState(null);
  const [myStatuses, setMyStatuses] = useState([]);
  const [feed, setFeed] = useState([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [channelsLoaded, setChannelsLoaded] = useState(false);

  async function loadFeed() {
    try {
      const data = await apiRequest('/status/feed');
      setMyStatuses(data?.my_statuses || []);
      setFeed(data?.feed || []);
    } catch (e) {
      console.log('Failed to load status feed:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadChannels() {
    try {
      const data = await apiRequest('/groups/list');
      const groups = data?.groups || [];
      setChannels(groups.filter(g => g.type === 'channel'));
    } catch (e) {
      // offline or backend unreachable — leave whatever we had
    } finally {
      setChannelsLoaded(true);
    }
  }

  useEffect(() => {
    loadFeed();
    loadChannels();
  }, []);

  const recent = feed.filter(f => !f.all_viewed);
  const watched = feed.filter(f => f.all_viewed);

  function openFriendStory(entry) {
    const last = entry.statuses[entry.statuses.length - 1];
    setOpenStory({
      id: entry.user_id,
      name: entry.username,
      color: colorForId(entry.user_id),
      segments: entry.statuses.length,
      time: timeAgo(last.created_at),
      statusIds: entry.statuses.map(s => s.id),
    });
    entry.statuses.forEach(s => {
      apiRequest('/status/view', { method: 'POST', body: JSON.stringify({ status_id: s.id }) }).catch(() => {});
    });
  }

  function openChannel(channel) {
    navigation.navigate('GroupChatDetail', {
      chat: {
        id: String(channel.id),
        name: channel.name,
        color: colorForId(channel.id),
        isGroup: true,
        groupType: 'channel',
      },
    });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrap}>
          <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={14} />
          <ChevronLeft size={22} color="#0f0f1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Status</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.circleRow}>
          <StatusCircle
            item={{ id: 'me', name: user?.username || 'My Status', color: '#4f46e5' }}
            isMe
            onOpen={() => myStatuses.length ? setOpenStory({
              id: 'me', name: 'My Status', color: '#4f46e5',
              segments: myStatuses.length, time: timeAgo(myStatuses[myStatuses.length - 1].created_at),
            }) : setComposeOpen(true)}
          />
          {recent.map(entry => (
            <StatusCircle
              key={entry.user_id}
              item={{ id: entry.user_id, name: entry.username, color: colorForId(entry.user_id), viewed: false }}
              onOpen={() => openFriendStory(entry)}
            />
          ))}
        </ScrollView>

        {(channelsLoaded ? channels.length > 0 : true) && (
          <>
            <Text style={styles.sectionTitle}>Channels</Text>
            <GlassCard style={{ padding: 0 }}>
              {!channelsLoaded ? (
                <View style={styles.channelRow}>
                  <Text style={styles.channelEmptyText}>Loading channels...</Text>
                </View>
              ) : channels.length === 0 ? (
                <View style={styles.channelRow}>
                  <Text style={styles.channelEmptyText}>No channels yet — create one from the + menu on the main screen</Text>
                </View>
              ) : (
                channels.map((c, i) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.channelRow, i < channels.length - 1 && styles.rowBorder]}
                    onPress={() => openChannel(c)}
                  >
                    <View style={[styles.channelIcon, { backgroundColor: colorForId(c.id) }]}><Radio size={16} color="white" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.channelName}>{c.name}</Text>
                      <Text style={styles.channelTime}>Channel</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </GlassCard>
          </>
        )}

        {watched.length > 0 && (
          <>
            <TouchableOpacity onPress={() => setWatchedOpen(v => !v)} activeOpacity={0.8}>
              <GlassCard style={{ marginBottom: watchedOpen ? 0 : 16 }}>
                <View style={styles.watchedHeader}>
                  <Text style={styles.watchedTitle}>Watched ({watched.length})</Text>
                  {watchedOpen ? <ChevronUp size={17} color="#6b6b7a" /> : <ChevronDown size={17} color="#6b6b7a" />}
                </View>
              </GlassCard>
            </TouchableOpacity>
            {watchedOpen && (
              <GlassCard style={{ padding: 0, marginTop: 8 }}>
                {watched.map((entry, i) => (
                  <TouchableOpacity key={entry.user_id} onPress={() => openFriendStory(entry)} style={[styles.channelRow, i < watched.length - 1 && styles.rowBorder]}>
                    <View style={[styles.channelIcon, { backgroundColor: colorForId(entry.user_id), borderRadius: 21 }]}>
                      <Text style={{ color: 'white', fontWeight: '700' }}>{entry.username[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.channelName}>{entry.username}</Text>
                      <Text style={styles.channelTime}>{timeAgo(entry.statuses[entry.statuses.length - 1].created_at)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </GlassCard>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={!!openStory} animationType="fade" onRequestClose={() => setOpenStory(null)}>
        {openStory && <StoryViewer item={openStory} onClose={() => setOpenStory(null)} />}
      </Modal>

      <ComposeModal visible={composeOpen} onClose={() => setComposeOpen(false)} onPosted={loadFeed} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff' },
  glassWrap: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 10 },
  backBtnWrap: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f0f1a' },
  circleRow: { paddingHorizontal: 4, paddingVertical: 10, gap: 14 },
  circleWrap: { alignItems: 'center', width: 64 },
  circleRing: { width: 58, height: 58, borderRadius: 29, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  circleInner: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  circleInitial: { color: 'white', fontWeight: '700' },
  plusBadge: { position: 'absolute', bottom: 20, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white' },
  circleLabel: { fontSize: 10.5, fontWeight: '600', color: '#0f0f1a', marginTop: 6 },
  sectionTitle: { fontSize: 11.5, fontWeight: '700', color: '#6b6b7a', marginBottom: 8, marginTop: 4, marginLeft: 4, textTransform: 'uppercase' },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  channelEmptyText: { fontSize: 12.5, color: '#9ca3af', flex: 1 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)' },
  channelIcon: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  channelName: { fontSize: 13.5, fontWeight: '700', color: '#0f0f1a' },
  channelTime: { fontSize: 11, color: '#9ca3af' },
  watchedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  watchedTitle: { fontSize: 13.5, fontWeight: '700', color: '#0f0f1a' },
  storyScreen: { flex: 1 },
  storySegments: { flexDirection: 'row', gap: 4, padding: 10, paddingTop: 40, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 },
  segmentTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  segmentFill: { height: '100%', backgroundColor: 'white' },
  storyHeaderWrap: { paddingTop: 30, overflow: 'hidden' },
  storyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  storyAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  storyAvatarText: { color: 'white', fontWeight: '700' },
  storyName: { color: 'white', fontWeight: '700', fontSize: 14 },
  storyTime: { color: 'rgba(255,255,255,0.7)', fontSize: 11.5 },
  storyFooterWrap: { overflow: 'hidden', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  storyReplyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  storyReplyInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: 'white', fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  storySendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  storyViewsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 14, paddingHorizontal: 14 },
  storyViews: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  composeHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 50 },
  bgSwatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  bgSwatchActive: { borderColor: 'white' },
  composeInput: { color: 'white', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  composeSendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'white', margin: 20, borderRadius: 26, paddingVertical: 14 },
  composeSendText: { fontWeight: '700', fontSize: 14.5 },
});
