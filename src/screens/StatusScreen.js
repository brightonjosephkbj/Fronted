import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal,
  TextInput, Animated, Image, Alert, Pressable, PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft, Eye, Radio, Send, X, Plus, ChevronUp, ChevronDown,
  Image as ImageIcon, Film, Music2, Type, Play, Pause,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

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

function StatusCircle({ item, isMe, hasStatuses, onOpen, onAdd }) {
  return (
    <TouchableOpacity
      style={styles.circleWrap}
      onPress={() => (isMe && !hasStatuses ? onAdd() : onOpen(item))}
    >
      <View style={[styles.circleRing, { borderColor: item.viewed ? '#d1d5db' : item.color }]}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.circleInnerImg} />
        ) : (
          <View style={[styles.circleInner, { backgroundColor: item.color }]}>
            <Text style={styles.circleInitial}>{item.name[0]}</Text>
          </View>
        )}
      </View>
      {isMe && (
        <TouchableOpacity style={styles.plusBadge} onPress={onAdd} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Plus size={12} color="white" strokeWidth={3} />
        </TouchableOpacity>
      )}
      <Text style={styles.circleLabel} numberOfLines={1}>{isMe ? 'My Status' : item.name}</Text>
    </TouchableOpacity>
  );
}

function StoryVideoSlide({ uri, onReady, onEnd }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.play();
  });
  useEffect(() => {
    const readySub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        const ms = player.duration ? Math.round(player.duration * 1000) : 15000;
        onReady(Math.max(2000, ms));
      }
    });
    const endSub = player.addListener('playToEnd', () => onEnd());
    return () => {
      readySub?.remove();
      endSub?.remove();
    };
  }, [player]);
  return (
    <VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit="contain" nativeControls={false} />
  );
}

function StoryAudioSlide({ uri, color, onReady, onEnd }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    player.play();
    return () => { try { player.pause(); } catch (e) {} };
  }, [player]);

  useEffect(() => {
    if (status?.duration) onReady(Math.max(2000, Math.round(status.duration * 1000)));
  }, [status?.duration]);

  useEffect(() => {
    if (status?.didJustFinish) onEnd();
  }, [status?.didJustFinish]);

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.audioSlide, { backgroundColor: color }]}>
      <View style={styles.audioIconWrap}>
        {status?.playing ? <Pause size={34} color="white" /> : <Play size={34} color="white" />}
      </View>
      <Text style={styles.audioSlideText}>Audio status</Text>
    </View>
  );
}

function StoryViewer({ item, isMe, onClose }) {
  const { apiRequest, token } = useAuth();
  const { socket } = useSocket();
  const [segIndex, setSegIndex] = useState(0);
  const [duration, setDuration] = useState(5000);
  const [viewCount, setViewCount] = useState(null);
  const progress = useRef(new Animated.Value(0)).current;
  const durationSetRef = useRef(false);
  const progressValueRef = useRef(0);
  const animRef = useRef(null);
  const pressStartRef = useRef(0);

  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewersList, setViewersList] = useState([]);
  const [viewersListLoading, setViewersListLoading] = useState(false);

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const mountedReplyRef = useRef(false);

  const statuses = item.statuses || [];
  const current = statuses[segIndex];

  useEffect(() => {
    setSegIndex(0);
  }, [item]);

  useEffect(() => {
    durationSetRef.current = false;
    setDuration(current && (current.content_type === 'text' || current.content_type === 'photo') ? 5000 : 15000);
  }, [segIndex, item]);

  function goNext() {
    if (segIndex < statuses.length - 1) setSegIndex(i => i + 1);
    else onClose();
  }

  useEffect(() => {
    const id = progress.addListener(({ value }) => { progressValueRef.current = value; });
    return () => progress.removeListener(id);
  }, [progress]);

  useEffect(() => {
    progress.setValue(0);
    progressValueRef.current = 0;
    const anim = Animated.timing(progress, { toValue: 1, duration, useNativeDriver: false });
    animRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => anim.stop();
  }, [segIndex, item, duration]);

  function pauseStory() {
    animRef.current?.stop();
  }

  function resumeStory() {
    const remaining = Math.max(50, (1 - progressValueRef.current) * duration);
    const anim = Animated.timing(progress, { toValue: 1, duration: remaining, useNativeDriver: false });
    animRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) goNext();
    });
  }

  function handleTapRelease(navigateFn) {
    const wasQuickTap = Date.now() - pressStartRef.current < 300;
    if (wasQuickTap) navigateFn();
    else resumeStory();
  }

  useEffect(() => {
    if (!isMe || !current) return;
    setViewCount(null);
    apiRequest(`/status/${current.id}/viewers`)
      .then(data => setViewCount(typeof data?.count === 'number' ? data.count : 0))
      .catch(() => setViewCount(0));
  }, [segIndex, item, isMe]);

  useEffect(() => {
    if (!mountedReplyRef.current) { mountedReplyRef.current = true; return; }
    if (replyOpen) pauseStory();
    else resumeStory();
  }, [replyOpen]);

  function setDynamicDuration(ms) {
    if (durationSetRef.current) return;
    durationSetRef.current = true;
    setDuration(ms);
  }

  function openViewersList() {
    if (!current) return;
    setViewersOpen(true);
    setViewersListLoading(true);
    pauseStory();
    apiRequest(`/status/${current.id}/viewers`)
      .then(data => setViewersList(data?.viewers || []))
      .catch(() => setViewersList([]))
      .finally(() => setViewersListLoading(false));
  }

  function closeViewersList() {
    setViewersOpen(false);
    resumeStory();
  }

  function sendReply() {
    if (!replyText.trim() || !socket) return;
    socket.emit('send_message', {
      token,
      recipient_id: item.id,
      content: `> Replied to your status\n${replyText.trim()}`,
    });
    setReplyText('');
    setReplyOpen(false);
  }

  const replyPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => pauseStory(),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -20) setReplyOpen(true);
        else resumeStory();
      },
    })
  ).current;

  const widthInterpolate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const bgColor = current?.bg_color || item.color;

  return (
    <View style={[styles.storyScreen, { backgroundColor: bgColor }]}>
      {current?.content_type === 'photo' && current.media_url && (
        <Image source={{ uri: current.media_url }} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
      )}
      {current?.content_type === 'video' && current.media_url && (
        <StoryVideoSlide uri={current.media_url} onReady={setDynamicDuration} onEnd={goNext} />
      )}
      {(current?.content_type === 'voice' || current?.content_type === 'song') && current.media_url && (
        <StoryAudioSlide uri={current.media_url} color={bgColor} onReady={setDynamicDuration} onEnd={goNext} />
      )}
      {current?.content_type === 'text' && (
        <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }]}>
          <Text style={styles.textSlideText}>{current.text_content}</Text>
        </View>
      )}

      <View style={styles.storySegments}>
        {statuses.map((_, i) => (
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
          <Text style={styles.storyTime}>{current ? timeAgo(current.created_at) : item.time}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={onClose}><X size={22} color="white" /></TouchableOpacity>
        </View>
      </View>

      <Pressable
        style={styles.storyTapLeft}
        onPressIn={() => { pressStartRef.current = Date.now(); pauseStory(); }}
        onPressOut={() => handleTapRelease(() => setSegIndex(i => Math.max(0, i - 1)))}
      />
      <Pressable
        style={styles.storyTapRight}
        onPressIn={() => { pressStartRef.current = Date.now(); pauseStory(); }}
        onPressOut={() => handleTapRelease(goNext)}
      />

      <View style={styles.storyFooterWrap}>
        <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={20} />
        {!isMe && !replyOpen && (
          <View {...replyPanResponder.panHandlers} style={styles.storyReplyHint}>
            <ChevronUp size={16} color="rgba(255,255,255,0.85)" />
            <Text style={styles.storyReplyHintText}>Swipe up to reply</Text>
          </View>
        )}
        {!isMe && replyOpen && (
          <View style={styles.storyReplyRow}>
            <TextInput
              autoFocus
              value={replyText}
              onChangeText={setReplyText}
              placeholder={`Reply to ${item.name}...`}
              placeholderTextColor="rgba(255,255,255,0.7)"
              style={styles.storyReplyInput}
              onSubmitEditing={sendReply}
              onBlur={() => { if (!replyText.trim()) setReplyOpen(false); }}
            />
            <TouchableOpacity style={styles.storySendBtn} onPress={sendReply}>
              <Send size={15} color="white" />
            </TouchableOpacity>
          </View>
        )}
        {isMe && (
          <TouchableOpacity style={styles.storyViewsRow} onPress={openViewersList} activeOpacity={0.7}>
            <Eye size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.storyViews}>
              {viewCount === null ? 'Loading views...' : `${viewCount} view${viewCount === 1 ? '' : 's'}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={viewersOpen} transparent animationType="slide" onRequestClose={closeViewersList}>
        <Pressable style={styles.viewersBackdrop} onPress={closeViewersList}>
          <View style={styles.viewersSheet}>
            <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={30} />
            <View style={styles.blockedHeader}>
              <Text style={styles.viewersSheetTitle}>Viewed by</Text>
              <TouchableOpacity onPress={closeViewersList}><X size={20} color="white" /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {viewersListLoading ? (
                <Text style={styles.viewersEmptyText}>Loading...</Text>
              ) : viewersList.length === 0 ? (
                <Text style={styles.viewersEmptyText}>No views yet.</Text>
              ) : (
                viewersList.map((v) => (
                  <View key={v.id} style={styles.viewersRow}>
                    <View style={styles.viewersAvatar}>
                      {v.avatar_url ? (
                        <Image source={{ uri: v.avatar_url }} style={styles.viewersAvatarImg} />
                      ) : (
                        <Text style={styles.viewersAvatarText}>{v.username[0]}</Text>
                      )}
                    </View>
                    <Text style={styles.viewersName}>{v.username}</Text>
                    <Text style={styles.viewersTime}>{timeAgo(v.viewed_at)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function AddStatusSheet({ visible, onClose, onPickText, onPickPhoto, onPickVideo, onPickAudio }) {
  const OPTIONS = [
    { key: 'text', label: 'Text', sub: 'Share a colored text update', Icon: Type, color: '#4f46e5', action: onPickText },
    { key: 'photo', label: 'Photo', sub: 'Post a picture from your gallery', Icon: ImageIcon, color: '#16a34a', action: onPickPhoto },
    { key: 'video', label: 'Video', sub: 'Share a short video clip', Icon: Film, color: '#ea580c', action: onPickVideo },
    { key: 'audio', label: 'Audio', sub: 'Post a voice note or song', Icon: Music2, color: '#db2777', action: onPickAudio },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <View style={styles.addSheetWrap}>
          <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={40} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.4)' }]} />
          <Text style={styles.addSheetTitle}>Add to Status</Text>
          {OPTIONS.map(opt => (
            <TouchableOpacity key={opt.key} style={styles.addSheetRow} onPress={() => { onClose(); opt.action(); }}>
              <View style={[styles.addSheetIcon, { backgroundColor: opt.color }]}>
                <opt.Icon size={18} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addSheetLabel}>{opt.label}</Text>
                <Text style={styles.addSheetSub}>{opt.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

function ComposeModal({ visible, mode, asset, onClose, onPosted }) {
  const { apiUpload, apiUploadFile } = useAuth();
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const bgColors = ['#4f46e5', '#db2777', '#16a34a', '#ea580c', '#0891b2'];
  const [bg, setBg] = useState(bgColors[0]);

  useEffect(() => {
    if (visible) { setText(''); setBg(bgColors[0]); }
  }, [visible]);

  const videoPlayer = useVideoPlayer(mode === 'video' && asset?.uri ? { uri: asset.uri } : null, (p) => {
    if (mode === 'video') p.play();
  });

  async function handlePostText() {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const form = new FormData();
      form.append('content_type', 'text');
      form.append('text_content', text.trim());
      form.append('bg_color', bg);
      form.append('privacy', 'all');
      await apiUpload('/status/post', form);
      onPosted();
      onClose();
    } catch (e) {
      console.log('Failed to post status:', e);
      Alert.alert('Post failed', String(e?.message || e));
    } finally {
      setPosting(false);
    }
  }

  async function handlePostMedia() {
    if (!asset?.uri || posting) return;
    setPosting(true);
    try {
      const contentType = mode === 'photo' ? 'photo' : mode === 'video' ? 'video' : 'song';
      await apiUploadFile('/status/post', asset.uri, {
        filename: asset.filename,
        mimeType: asset.mimeType,
        fields: {
          content_type: contentType,
          privacy: 'all',
          ...(text.trim() ? { text_content: text.trim() } : {}),
        },
      });
      onPosted();
      onClose();
    } catch (e) {
      console.log('Failed to post status:', e);
      Alert.alert('Post failed', String(e?.message || e));
    } finally {
      setPosting(false);
    }
  }

  if (mode === 'text') {
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
          <TouchableOpacity style={styles.composeSendBtn} onPress={handlePostText} disabled={!text.trim() || posting}>
            <Send size={18} color={bg} />
            <Text style={[styles.composeSendText, { color: bg }]}>{posting ? 'Posting...' : 'Post status'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.storyScreen, { backgroundColor: '#0f0f1a' }]}>
        <View style={styles.composeHeader}>
          <TouchableOpacity onPress={onClose}><X size={24} color="white" /></TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          {mode === 'photo' && asset?.uri && (
            <Image source={{ uri: asset.uri }} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
          )}
          {mode === 'video' && asset?.uri && (
            <VideoView player={videoPlayer} style={StyleSheet.absoluteFillObject} contentFit="contain" nativeControls={false} />
          )}
          {mode === 'audio' && asset?.uri && (
            <View style={[StyleSheet.absoluteFillObject, styles.audioSlide, { backgroundColor: '#db2777' }]}>
              <Music2 size={40} color="white" />
              <Text style={styles.audioSlideText} numberOfLines={1}>{asset.filename}</Text>
            </View>
          )}
        </View>
        <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Add a caption..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={styles.captionInput}
          />
        </View>
        <TouchableOpacity style={styles.composeSendBtn} onPress={handlePostMedia} disabled={posting}>
          <Send size={18} color="#0f0f1a" />
          <Text style={[styles.composeSendText, { color: '#0f0f1a' }]}>{posting ? 'Posting...' : 'Post status'}</Text>
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
      statuses: entry.statuses,
      time: timeAgo(last.created_at),
      isMe: false,
    });
    entry.statuses.forEach(s => {
      apiRequest('/status/view', { method: 'POST', body: JSON.stringify({ status_id: s.id }) }).catch(() => {});
    });
  }

  function openMyStory() {
    if (!myStatuses.length) return;
    const last = myStatuses[myStatuses.length - 1];
    setOpenStory({
      id: 'me',
      name: user?.username || 'My Status',
      color: '#4f46e5',
      statuses: myStatuses,
      time: timeAgo(last.created_at),
      isMe: true,
    });
  }

  const [composeConfig, setComposeConfig] = useState(null); // { mode, asset }
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  function openAddSheet() {
    setAddSheetOpen(true);
  }

  function pickTextStatus() {
    setComposeConfig({ mode: 'text', asset: null });
  }

  async function pickPhotoStatus() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to post a photo status.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    const a = result.assets[0];
    setComposeConfig({ mode: 'photo', asset: { uri: a.uri, filename: a.fileName || 'status.jpg', mimeType: a.mimeType || 'image/jpeg' } });
  }

  async function pickVideoStatus() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to post a video status.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    const a = result.assets[0];
    setComposeConfig({ mode: 'video', asset: { uri: a.uri, filename: a.fileName || 'status.mp4', mimeType: a.mimeType || 'video/mp4' } });
  }

  async function pickAudioStatus() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const a = result.assets[0];
      setComposeConfig({ mode: 'audio', asset: { uri: a.uri, filename: a.name || 'status.mp3', mimeType: a.mimeType || 'audio/mpeg' } });
    } catch (e) {
      Alert.alert('Error', "Couldn't open the audio picker.");
    }
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
            item={{ id: 'me', name: user?.username || 'My Status', color: '#4f46e5', avatarUrl: user?.avatar_url }}
            isMe
            hasStatuses={myStatuses.length > 0}
            onOpen={openMyStory}
            onAdd={openAddSheet}
          />
          {recent.map(entry => (
            <StatusCircle
              key={entry.user_id}
              item={{ id: entry.user_id, name: entry.username, color: colorForId(entry.user_id), viewed: false, avatarUrl: entry.avatar_url }}
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
        {openStory && <StoryViewer item={openStory} isMe={openStory.isMe} onClose={() => setOpenStory(null)} />}
      </Modal>

      <AddStatusSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onPickText={pickTextStatus}
        onPickPhoto={pickPhotoStatus}
        onPickVideo={pickVideoStatus}
        onPickAudio={pickAudioStatus}
      />

      <ComposeModal
        visible={!!composeConfig}
        mode={composeConfig?.mode}
        asset={composeConfig?.asset}
        onClose={() => setComposeConfig(null)}
        onPosted={loadFeed}
      />
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
  circleInnerImg: { width: 48, height: 48, borderRadius: 24 },
  textSlideText: { color: 'white', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  audioSlide: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  audioIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  audioSlideText: { color: 'white', fontSize: 14, fontWeight: '600', paddingHorizontal: 24 },
  storyTapLeft: { position: 'absolute', top: 80, bottom: 90, left: 0, width: '50%' },
  storyTapRight: { position: 'absolute', top: 80, bottom: 90, right: 0, width: '50%' },
  captionInput: { color: 'white', fontSize: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  addSheetWrap: { overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 18, paddingBottom: 30, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderBottomWidth: 0 },
  addSheetTitle: { fontSize: 13, fontWeight: '700', color: '#6b6b7a', textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 10 },
  addSheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  addSheetIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  addSheetLabel: { fontSize: 14.5, fontWeight: '700', color: '#0f0f1a' },
  addSheetSub: { fontSize: 11.5, color: '#6b6b7a', marginTop: 2 },
  storyReplyHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  storyReplyHintText: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: '600' },
  viewersBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  viewersSheet: { overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 },
  viewersSheetTitle: { fontSize: 15, fontWeight: '800', color: 'white' },
  viewersEmptyText: { fontSize: 12.5, color: 'rgba(255,255,255,0.6)', paddingVertical: 10 },
  viewersRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  viewersAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  viewersAvatarImg: { width: 34, height: 34, borderRadius: 17 },
  viewersAvatarText: { color: 'white', fontWeight: '700', fontSize: 13 },
  viewersName: { flex: 1, color: 'white', fontSize: 13.5, fontWeight: '600' },
  viewersTime: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  blockedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
});
