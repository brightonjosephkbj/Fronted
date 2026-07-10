import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput,
  Modal, Pressable, Animated, ImageBackground, Image, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import Video from 'react-native-video';
import Pdf from 'react-native-pdf';
import FileViewer from 'react-native-file-viewer';
import Clipboard from '@react-native-clipboard/clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth, API_BASE } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { BadgeCheck, Check, CheckCheck, ChevronLeft, FileText, Heart, Mic, Pause, Phone, Play, Plus, Send, Settings, Star, Video as VideoIcon, X } from 'lucide-react-native';

const DEFAULT_WALLPAPER = require('../../assets/wallpapers/default-papercut.png');
const WALLPAPER_CACHE_KEY = 'b24_default_wallpaper';
const CHAT_WALLPAPER_KEY = 'b24_chat_wallpapers';

function WallpaperBackground({ color, style, children }) {
  if (color) {
    return <View style={[style, { backgroundColor: color }]}>{children}</View>;
  }
  return (
    <ImageBackground source={DEFAULT_WALLPAPER} style={style} resizeMode="cover">
      {children}
    </ImageBackground>
  );
}

function verifiedColor(tick) {
  if (tick === 'cyan') return '#06b6d4';
  if (tick === 'blue') return '#3b82f6';
  return '#a855f7';
}

const ATTACH_GRID = [
  { key: 'photo', label: 'Photo' },
  { key: 'video', label: 'Video' },
  { key: 'document', label: 'Document' },
  { key: 'location', label: 'Location' },
  { key: 'contact', label: 'Contact' },
  { key: 'poll', label: 'Poll' },
];

function BubbleWrapper({ children, style }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
      {children}
    </Animated.View>
  );
}

function GlassView({ style, children, blurAmount = 18, tint = 0.35 }) {
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={blurAmount} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(255,255,255,${tint})` }]} />
      {children}
    </View>
  );
}

function TypewriterText({ text, style, onDone }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    const words = text.split(' ');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setShown(words.slice(0, i).join(' '));
      if (i >= words.length) {
        clearInterval(interval);
        onDone && onDone();
      }
    }, 110);
    return () => clearInterval(interval);
  }, [text]);
  return <Text style={style}>{shown}</Text>;
}

function ShimmerTypingBubble() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(anim, { toValue: 1, duration: 1100, useNativeDriver: true })).start();
  }, []);
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 90] });
  return (
    <GlassView style={styles.shimmerBubble} blurAmount={14}>
      <Animated.View style={[styles.shimmerSweep, { transform: [{ translateX }] }]} />
    </GlassView>
  );
}

function VoiceNoteBubble({ fromMe, uri }) {
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);
  const bars = useRef(Array.from({ length: 18 }, (_, i) => 4 + ((i * 37) % 14))).current;

  function formatSec(sec) {
    const totalSec = Math.floor(sec || 0);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  useEffect(() => {
    if (status.didJustFinish) {
      player.seekTo(0);
    }
  }, [status.didJustFinish]);

  function togglePlay() {
    if (!uri) return;
    try {
      if (status.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (e) {
      Alert.alert('Error', "Couldn't play this voice note.");
    }
  }

  return (
    <View style={styles.voiceRow}>
      <TouchableOpacity onPress={togglePlay} style={[styles.voicePlayBtn, { backgroundColor: fromMe ? 'rgba(255,255,255,0.9)' : '#0f0f1a' }]}>
        {status.playing ? <Pause size={11} color={fromMe ? '#4f46e5' : 'white'} /> : <Play size={11} color={fromMe ? '#4f46e5' : 'white'} />}
      </TouchableOpacity>
      <View style={styles.voiceBars}>
        {bars.map((h, i) => (
          <View key={i} style={[styles.voiceBar, { height: status.playing ? h + 4 : h, backgroundColor: fromMe ? 'rgba(255,255,255,0.7)' : '#c7c7d1' }]} />
        ))}
      </View>
      <Text style={[styles.voiceDuration, { color: fromMe ? 'rgba(255,255,255,0.75)' : '#9ca3af' }]}>{status.duration != null ? formatSec(status.duration) : '0:00'}</Text>
    </View>
  );
}

function ImageBubble({ item, onOpen }) {
  return (
    <TouchableOpacity onPress={() => onOpen(item)} style={styles.imageThumbWrap}>
      {item.fileUri ? (
        <Image source={{ uri: item.fileUri }} style={styles.imageThumbImage} resizeMode="cover" />
      ) : (
        <View style={[styles.imageThumbImage, { backgroundColor: '#1c1c26' }]} />
      )}
    </TouchableOpacity>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function VideoThumbBubble({ item, onOpen, downloading }) {
  return (
    <TouchableOpacity onPress={() => onOpen(item)} style={styles.videoThumbWrap} disabled={downloading}>
      {item.thumbnailUri ? (
        <Image source={{ uri: item.thumbnailUri }} style={styles.videoThumbImage} />
      ) : (
        <View style={[styles.videoThumbImage, { backgroundColor: '#1c1c26' }]} />
      )}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.videoPlayOverlay}>
          <GlassView style={styles.videoPlayCircle} blurAmount={14} tint={0.25}>
            {downloading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.videoPlayIcon}>▶</Text>}
          </GlassView>
        </View>
      </View>
      {!item.localUri && item.fileSize ? (
        <View style={styles.videoDurationBadge}>
          <Text style={styles.videoDurationText}>{downloading ? 'Downloading…' : formatBytes(item.fileSize)}</Text>
        </View>
      ) : item.duration && (
        <View style={styles.videoDurationBadge}>
          <Text style={styles.videoDurationText}>{item.duration}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function DocumentBubble({ item, fromMe, onOpen }) {
  return (
    <TouchableOpacity onPress={() => onOpen(item)} style={styles.docRow}>
      <View style={[styles.docIconBox, { backgroundColor: fromMe ? 'rgba(255,255,255,0.25)' : '#4f46e5' }]}>
        <FileText size={16} color="white" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.docName, { color: fromMe ? 'white' : '#0f0f1a' }]} numberOfLines={1}>
          {item.filename || 'Document'}
        </Text>
        <Text style={[styles.docMeta, { color: fromMe ? 'rgba(255,255,255,0.75)' : '#9ca3af' }]}>
          {item.filesize || ''} {item.fileExt ? `· ${item.fileExt.toUpperCase()}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function Ticks({ status }) {
  if (status === 'read') return <CheckCheck size={13} color="#93c5fd" />;
  if (status === 'delivered') return <CheckCheck size={13} color="rgba(255,255,255,0.6)" />;
  return <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}><Check size={13} color="#0f0f1a" /></Text>;
}

// Opens a document: PDFs get the in-app viewer, everything else
// falls back to the phone's default app. If that also fails
// (no app installed for the type), we just no-op quietly.
async function openDocument(item, setPdfViewer) {
  const ext = (item.fileExt || '').toLowerCase();
  if (ext === 'pdf' && item.fileUri) {
    setPdfViewer(item);
    return;
  }
  if (item.fileUri) {
    try {
      await FileViewer.open(item.fileUri, { showOpenWithDialog: true });
    } catch (e) {
      // no app available for this file type — fail silently for now,
      // could surface a toast here later
    }
  }
}

function msgMetaKey(chatId) {
  return `b24_msg_meta_${chatId}`;
}

export default function ChatDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { apiRequest, apiUpload, user, token } = useAuth();
  const { socket } = useSocket();
  const chat = route.params?.chat || { id: 'unknown', name: 'Unknown', color: '#9333ea' };
  const recipientId = parseInt(chat.id, 10);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(route.params?.prefill || '');
  const [attachOpen, setAttachOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [videoPlayer, setVideoPlayer] = useState(null);
  const [pdfViewer, setPdfViewer] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [forwardFriends, setForwardFriends] = useState([]);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [starredIds, setStarredIds] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [clearedAt, setClearedAt] = useState(0);
  const [reactions, setReactions] = useState({});
  const [popId, setPopId] = useState(null);
  const [wallpaperColor, setWallpaperColor] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [globalWp, chatWpRaw] = await Promise.all([
          AsyncStorage.getItem(WALLPAPER_CACHE_KEY),
          AsyncStorage.getItem(CHAT_WALLPAPER_KEY),
        ]);
        const chatWpMap = chatWpRaw ? JSON.parse(chatWpRaw) : {};
        const override = chatWpMap[chat.id];
        setWallpaperColor(override || globalWp || null);
      } catch (e) {
        // fall back to the default papercut image
      }
    })();
  }, [chat.id]);
  const popScale = useRef(new Animated.Value(0)).current;
  const [isRecording, setIsRecording] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState([]);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const lastTapRef = useRef({ id: null, time: 0 });
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const otherTypingTimeoutRef = useRef(null);

  const formatTime = (unixSeconds) => {
    const d = new Date(unixSeconds * 1000);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const mapServerMessage = useCallback((m) => {
    const base = {
      id: String(m.id),
      from: m.sender_id === user?.id ? 'me' : 'them',
      text: m.content,
      time: formatTime(m.timestamp),
      ts: m.timestamp,
      ticks: m.sender_id === user?.id ? (m.read_status ? 'read' : 'delivered') : undefined,
      voice: m.media_type === 'voice',
      mediaUrl: m.media_url,
      revealed: true,
    };
    if (m.media_type === 'image') {
      return { ...base, type: 'image', fileUri: m.media_url };
    }
    if (m.media_type === 'video') {
      let meta = {};
      try { meta = JSON.parse(m.content) || {}; } catch (e) {}
      return { ...base, type: 'video', fileId: m.media_url, filename: meta.filename, fileSize: meta.size, localUri: null };
    }
    if (m.media_type === 'document') {
      const ext = (m.content || '').split('.').pop();
      return { ...base, type: 'document', fileUri: m.media_url, filename: m.content, fileExt: ext };
    }
    return base;
  }, [user?.id]);

  // Load local per-chat meta: starred message ids + "deleted for me" ids
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(msgMetaKey(recipientId));
        if (raw) {
          const parsed = JSON.parse(raw);
          setStarredIds(parsed.starred || []);
          setDeletedIds(parsed.deletedForMe || []);
          setClearedAt(parsed.clearedAt || 0);
          setReactions(parsed.reactions || {});
        }
      } catch (e) {
        // corrupted local meta, ignore
      }
    })();
  }, [recipientId]);

  async function persistMsgMeta(nextStarred, nextDeleted, nextReactions = reactions) {
    setStarredIds(nextStarred);
    setDeletedIds(nextDeleted);
    if (nextReactions !== reactions) setReactions(nextReactions);
    try {
      await AsyncStorage.setItem(msgMetaKey(recipientId), JSON.stringify({ starred: nextStarred, deletedForMe: nextDeleted, clearedAt, reactions: nextReactions }));
    } catch (e) {
      // best-effort
    }
  }

  function toggleReaction(msgId, emoji = '❤️') {
    const next = { ...reactions };
    if (next[msgId] === emoji) {
      delete next[msgId];
    } else {
      next[msgId] = emoji;
    }
    persistMsgMeta(starredIds, deletedIds, next);
  }

  function triggerHeartPop(msgId) {
    setPopId(msgId);
    popScale.setValue(0);
    Animated.sequence([
      Animated.spring(popScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }),
      Animated.delay(250),
      Animated.timing(popScale, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setPopId(null));
  }

  // Load history
  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest(`/messages/${recipientId}`);
        if (Array.isArray(data?.messages)) {
          setMessages(data.messages.map(mapServerMessage));
        }
      } catch (e) {}
    })();
  }, [recipientId]);

  // Real-time updates — shared socket from SocketContext, not a new connection
  useEffect(() => {
    if (!socket) return;
    socketRef.current = socket;

    const onNewMessage = (data) => {
      const involvesThisChat =
        (data.sender_id === recipientId && data.recipient_id === user?.id) ||
        (data.sender_id === user?.id && data.recipient_id === recipientId);
      if (!involvesThisChat) return;

      const base = {
        id: String(data.id ?? Date.now()),
        from: data.sender_id === user?.id ? 'me' : 'them',
        text: data.content,
        time: formatTime(Math.floor(Date.now() / 1000)),
        ts: Math.floor(Date.now() / 1000),
        ticks: data.sender_id === user?.id ? 'sent' : undefined,
        voice: data.media_type === 'voice',
        mediaUrl: data.media_url,
        revealed: false,
      };
      let mapped = base;
      if (data.media_type === 'image') {
        mapped = { ...base, type: 'image', fileUri: data.media_url };
      } else if (data.media_type === 'video') {
        let meta = {};
        try { meta = JSON.parse(data.content) || {}; } catch (e) {}
        mapped = { ...base, type: 'video', fileId: data.media_url, filename: meta.filename, fileSize: meta.size, localUri: null };
      } else if (data.media_type === 'document') {
        const ext = (data.content || '').split('.').pop();
        mapped = { ...base, type: 'document', fileUri: data.media_url, filename: data.content, fileExt: ext };
      }
      setMessages(prev => [...prev, mapped]);
    };

    const onTyping = (data) => {
      if (data.sender_id !== recipientId) return;
      setOtherTyping(true);
      if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
      otherTypingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
    };
    const onStopTyping = (data) => {
      if (data.sender_id !== recipientId) return;
      if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
      setOtherTyping(false);
    };

    socket.on('new_message', onNewMessage);
    socket.on('typing', onTyping);
    socket.on('stop_typing', onStopTyping);
    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('typing', onTyping);
      socket.off('stop_typing', onStopTyping);
    };
  }, [socket, recipientId, user?.id]);

  const markRevealed = useCallback((id) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, revealed: true } : m));
  }, []);

  async function uploadAndSendAttachment(uri, filename, mimeType, mediaType) {
    if (!socketRef.current) return;
    try {
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: mimeType || 'application/octet-stream' });
      formData.append('type', mediaType);
      const result = await apiUpload('/media/upload', formData);
      socketRef.current.emit('send_message', {
        token,
        recipient_id: recipientId,
        content: filename,
        media_type: mediaType,
        media_url: result.url,
      });
    } catch (e) {
      Alert.alert('Upload failed', "Couldn't send that attachment. Check your connection and try again.");
    }
  }

  async function uploadAndSendLazyVideo(uri, filename, mimeType) {
    if (!socketRef.current) return;
    try {
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: mimeType || 'video/mp4' });
      const result = await apiUpload('/files/upload', formData);
      socketRef.current.emit('send_message', {
        token,
        recipient_id: recipientId,
        content: JSON.stringify({ filename: result.filename, size: result.size }),
        media_type: 'video',
        media_url: result.file_id,
      });
    } catch (e) {
      Alert.alert('Upload failed', "Couldn't send that video. Check your connection and try again.");
    }
  }

  async function downloadAndOpenVideo(item) {
    if (item.localUri) {
      setVideoPlayer({ ...item, fileUri: item.localUri });
      return;
    }
    if (downloadingIds.includes(item.id)) return;
    setDownloadingIds(prev => [...prev, item.id]);
    try {
      const safeName = (item.filename || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
      const dest = `${FileSystem.cacheDirectory}${item.id}_${safeName}`;
      const result = await FileSystem.downloadAsync(
        `${API_BASE}/files/download/${item.fileId}`,
        dest,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(prev => prev.map(m => m.id === item.id ? { ...m, localUri: result.uri } : m));
      setVideoPlayer({ ...item, fileUri: result.uri });
    } catch (e) {
      Alert.alert('Download failed', "Couldn't download this video — it may have already been downloaded on another device.");
    } finally {
      setDownloadingIds(prev => prev.filter(id => id !== item.id));
    }
  }

  async function pickPhoto() {
    setAttachOpen(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to send images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    uploadAndSendAttachment(asset.uri, asset.fileName || 'photo.jpg', asset.mimeType, 'image');
  }

  async function pickVideo() {
    setAttachOpen(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to send videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    uploadAndSendLazyVideo(asset.uri, asset.fileName || 'video.mp4', asset.mimeType);
  }

  async function pickDocument() {
    setAttachOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      uploadAndSendAttachment(asset.uri, asset.name || 'document', asset.mimeType, 'document');
    } catch (e) {
      Alert.alert('Error', "Couldn't open the document picker.");
    }
  }

  function handleSend() {
    if (!input.trim() || !socketRef.current) return;
    let text = input.trim();
    if (replyTo) {
      const quotedSnippet = (replyTo.text || '').slice(0, 80);
      text = `> ${quotedSnippet}\n${text}`;
    }
    setInput('');
    setReplyTo(null);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current.emit('stop_typing', { token, recipient_id: recipientId });
    socketRef.current.emit('send_message', {
      token,
      recipient_id: recipientId,
      content: text,
    });
  }

  async function startRecording() {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone access needed', 'Enable microphone permission to record voice notes.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (e) {
      Alert.alert('Error', "Couldn't start recording.");
    }
  }

  async function stopRecordingAndSend() {
    if (!isRecording) { setIsRecording(false); return; }
    setIsRecording(false);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri || !socketRef.current) return;

      const formData = new FormData();
      formData.append('file', { uri, name: 'voice.m4a', type: 'audio/m4a' });
      formData.append('type', 'voice');

      const res = await apiUpload('/media/upload', formData);
      const content = res?.transcription?.trim() || 'Voice message';

      socketRef.current.emit('send_message', {
        token,
        recipient_id: recipientId,
        content,
        media_type: 'voice',
        media_url: res.url,
      });
    } catch (e) {
      Alert.alert('Error', "Couldn't send voice note.");
    }
  }

  function handleInputChange(text) {
    setInput(text);
    if (!socketRef.current) return;
    socketRef.current.emit('typing', { token, recipient_id: recipientId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('stop_typing', { token, recipient_id: recipientId });
    }, 1500);
  }

  function handleDoubleTap(msgId) {
    const now = Date.now();
    if (lastTapRef.current.id === msgId && now - lastTapRef.current.time < 300) {
      lastTapRef.current = { id: null, time: 0 };
      toggleReaction(msgId);
      triggerHeartPop(msgId);
    } else {
      lastTapRef.current = { id: msgId, time: now };
    }
  }

  function handleActionSheet(key) {
    const msg = actionMsg;
    setActionMsg(null);
    if (!msg) return;

    switch (key) {
      case 'reply':
        setReplyTo(msg);
        break;
      case 'copy':
        Clipboard.setString(msg.text || '');
        break;
      case 'star': {
        const isStarred = starredIds.includes(msg.id);
        const next = isStarred ? starredIds.filter(id => id !== msg.id) : [...starredIds, msg.id];
        persistMsgMeta(next, deletedIds);
        break;
      }
      case 'delete':
        Alert.alert(
          'Delete message?',
          'This removes it from your view only. The other person will still see it.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive', onPress: () => {
                persistMsgMeta(starredIds, [...deletedIds, msg.id]);
              },
            },
          ]
        );
        break;
      case 'forward':
        openForwardPicker(msg);
        break;
      case 'react':
        toggleReaction(msg.id);
        break;
      default:
        break;
    }
  }

  async function openForwardPicker(msg) {
    setForwardMsg(msg);
    setForwardLoading(true);
    try {
      const data = await apiRequest('/friends/list');
      setForwardFriends(data?.friends || []);
    } catch (e) {
      setForwardFriends([]);
    } finally {
      setForwardLoading(false);
    }
  }

  function forwardToFriend(friend) {
    if (!forwardMsg || !socketRef.current) return;
    socketRef.current.emit('send_message', {
      token,
      recipient_id: friend.id,
      content: forwardMsg.text || '',
    });
    setForwardMsg(null);
    Alert.alert('Forwarded', `Sent to ${friend.username}`);
  }

  function actionSheetItemsFor(msg) {
    const isStarred = !!(msg && starredIds.includes(msg.id));
    return [
      { key: 'reply', label: 'Reply' },
      { key: 'forward', label: 'Forward' },
      { key: 'copy', label: 'Copy' },
      { key: 'react', label: 'React' },
      { key: 'star', label: isStarred ? 'Unstar' : 'Star' },
      { key: 'delete', label: 'Delete', danger: true },
    ];
  }

  const visibleMessages = messages.filter(m => !deletedIds.includes(m.id) && (!clearedAt || !m.ts || m.ts >= clearedAt));

  const renderMessage = ({ item }) => {
    const isMe = item.from === 'me';
    const isStarred = starredIds.includes(item.id);

    if (item.type === 'image') {
      return (
        <TouchableOpacity
          onLongPress={() => setActionMsg(item)}
          delayLongPress={400}
          style={[styles.msgRow, { alignItems: isMe ? 'flex-end' : 'flex-start' }]}
        >
          <ImageBubble item={item} onOpen={() => {}} />
          <View style={styles.msgMetaRow}>
            {isStarred && <Star size={10} color="#f59e0b" fill="#f59e0b" />}
            <Text style={styles.msgTime}>{item.time}</Text>
            {isMe && item.ticks && <Ticks status={item.ticks} />}
          </View>
        </TouchableOpacity>
      );
    }

    if (item.type === 'video') {
      return (
        <TouchableOpacity
          onLongPress={() => setActionMsg(item)}
          delayLongPress={400}
          style={[styles.msgRow, { alignItems: isMe ? 'flex-end' : 'flex-start' }]}
        >
          <VideoThumbBubble item={item} onOpen={downloadAndOpenVideo} downloading={downloadingIds.includes(item.id)} />
          <View style={styles.msgMetaRow}>
            {isStarred && <Star size={10} color="#f59e0b" fill="#f59e0b" />}
            <Text style={styles.msgTime}>{item.time}</Text>
            {isMe && item.ticks && <Ticks status={item.ticks} />}
          </View>
        </TouchableOpacity>
      );
    }

    if (item.type === 'document') {
      return (
        <TouchableOpacity
          onLongPress={() => setActionMsg(item)}
          delayLongPress={400}
          style={[styles.msgRow, { alignItems: isMe ? 'flex-end' : 'flex-start' }]}
        >
          <GlassView style={[styles.bubble, styles.docBubble, { backgroundColor: isMe ? 'rgba(79,70,229,0.55)' : undefined }]} tint={isMe ? 0 : 0.5} blurAmount={14}>
            <DocumentBubble item={item} fromMe={isMe} onOpen={(doc) => openDocument(doc, setPdfViewer)} />
          </GlassView>
          <View style={styles.msgMetaRow}>
            {isStarred && <Star size={10} color="#f59e0b" fill="#f59e0b" />}
            <Text style={styles.msgTime}>{item.time}</Text>
            {isMe && item.ticks && <Ticks status={item.ticks} />}
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleDoubleTap(item.id)}
        onLongPress={() => setActionMsg(item)}
        delayLongPress={400}
        style={[styles.msgRow, { alignItems: isMe ? 'flex-end' : 'flex-start' }]}
      >
        <GlassView style={[styles.bubble, { backgroundColor: isMe ? 'rgba(79,70,229,0.55)' : undefined }]} tint={isMe ? 0 : 0.5} blurAmount={14}>
          {item.voice ? (
            <VoiceNoteBubble fromMe={isMe} uri={item.mediaUrl} />
          ) : item.revealed ? (
            <Text style={[styles.msgText, { color: isMe ? 'white' : '#0f0f1a' }]}>{item.text}</Text>
          ) : (
            <TypewriterText
              text={item.text}
              style={[styles.msgText, { color: isMe ? 'white' : '#0f0f1a' }]}
              onDone={() => markRevealed(item.id)}
            />
          )}
        </GlassView>
        {popId === item.id && (
          <Animated.View pointerEvents="none" style={[styles.heartPopOverlay, { transform: [{ scale: popScale }] }]}>
            <Heart size={44} color="#ef4444" fill="#ef4444" />
          </Animated.View>
        )}
        <View style={styles.msgMetaRow}>
          {isStarred && <Star size={10} color="#f59e0b" fill="#f59e0b" />}
          {reactions[item.id] && <Text style={styles.reactionBadge}>{reactions[item.id]}</Text>}
          <Text style={styles.msgTime}>{item.time}</Text>
          {isMe && item.ticks && <Ticks status={item.ticks} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <WallpaperBackground color={wallpaperColor} style={styles.screen}>
      <View style={styles.headerOuter}>
        <GlassView style={styles.headerInner} blurAmount={18}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}><ChevronLeft size={22} color="#0f0f1a" /></Text>
          </TouchableOpacity>
          <View style={{ width: 36, height: 36 }}>
            <View style={[styles.headerAvatar, { backgroundColor: chat.color || '#9333ea' }]}>
              <Text style={styles.headerAvatarText}>{chat.name?.[0]?.toUpperCase()}</Text>
            </View>
            {chat.verified && (
              <View style={[styles.headerVerifiedBadge, { backgroundColor: verifiedColor(chat.verified) }]}>
                <BadgeCheck size={9} color="#fff" strokeWidth={3} />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>{chat.name}</Text>
            <Text style={[styles.headerStatus, otherTyping && { color: '#4f46e5' }]}>
              {otherTyping ? 'typing...' : 'online'}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Call', { contact: chat, callee_id: chat.id, call_type: 'video' })}><Text style={styles.headerIcon}><VideoIcon size={18} color="#0f0f1a" /></Text></TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Call', { contact: chat, callee_id: chat.id, call_type: 'voice' })}><Text style={styles.headerIcon}><Phone size={16} color="#0f0f1a" /></Text></TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('ChatSettings', { chat })}>
            <Text style={styles.headerIcon}><Settings size={18} color="#0f0f1a" /></Text>
          </TouchableOpacity>
        </GlassView>
      </View>

      <FlatList
        data={visibleMessages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 14, paddingTop: 6 }}
        style={{ flex: 1 }}
      />

      {otherTyping && (
        <View style={{ paddingHorizontal: 14, marginBottom: 8 }}>
          <ShimmerTypingBubble />
        </View>
      )}

      {attachOpen && (
        <GlassView style={styles.attachGridWrap} blurAmount={22}>
          <View style={styles.attachGrid}>
            {ATTACH_GRID.map(a => (
              <TouchableOpacity
                key={a.key}
                style={styles.attachItem}
                onPress={() => {
                  if (a.key === 'photo') return pickPhoto();
                  if (a.key === 'video') return pickVideo();
                  if (a.key === 'document') return pickDocument();
                  Alert.alert('Coming soon', `${a.label} sharing needs a native library we haven't added yet — on the list next.`);
                }}
              >
                <View style={styles.attachIconCircle}><Text style={{ color: 'white' }}>●</Text></View>
                <Text style={styles.attachLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassView>
      )}

      {replyTo && (
        <GlassView style={styles.replyBanner} blurAmount={18} tint={0.55}>
          <View style={{ flex: 1 }}>
            <Text style={styles.replyBannerLabel}>Replying to</Text>
            <Text style={styles.replyBannerText} numberOfLines={1}>{replyTo.text}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <X size={16} color="#6b6b7a" />
          </TouchableOpacity>
        </GlassView>
      )}

      <View style={styles.inputOuter}>
        <GlassView style={styles.inputInner} blurAmount={18}>
          <TouchableOpacity style={styles.inputIconBtn} onPress={() => setAttachOpen(v => !v)}>
            {attachOpen ? <X size={17} color="#0f0f1a" /> : <Plus size={17} color="#0f0f1a" />}
          </TouchableOpacity>
          <TextInput
            value={input}
            onChangeText={handleInputChange}
            placeholder="Type Here..."
            placeholderTextColor="#9ca3af"
            multiline
            style={styles.textInput}
          />
          <TouchableOpacity
            style={[styles.inputIconBtn, styles.sendBtn, isRecording && styles.recordingBtn]}
            onPress={() => {
              if (input.trim()) { handleSend(); return; }
              isRecording ? stopRecordingAndSend() : startRecording();
            }}
          >
            {input.trim() ? <Send size={15} color="white" /> : <Mic size={15} color={isRecording ? '#fff' : 'white'} />}
          </TouchableOpacity>
        </GlassView>
      </View>

      {/* long-press action sheet */}
      <Modal visible={!!actionMsg} transparent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setActionMsg(null)}>
          <GlassView style={styles.sheet} blurAmount={24}>
            {actionSheetItemsFor(actionMsg).map(a => (
              <TouchableOpacity key={a.key} style={styles.sheetItem} onPress={() => handleActionSheet(a.key)}>
                <Text style={[styles.sheetItemText, a.danger && { color: '#ef4444' }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </GlassView>
        </Pressable>
      </Modal>

      {/* forward picker */}
      <Modal visible={!!forwardMsg} transparent animationType="fade" onRequestClose={() => setForwardMsg(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setForwardMsg(null)}>
          <GlassView style={styles.forwardSheet} blurAmount={24}>
            <Text style={styles.sheetHeaderText}>Forward to</Text>
            {forwardLoading ? (
              <Text style={styles.forwardEmpty}>Loading friends...</Text>
            ) : forwardFriends.length === 0 ? (
              <Text style={styles.forwardEmpty}>No friends to forward to yet</Text>
            ) : (
              forwardFriends.map(f => (
                <TouchableOpacity key={f.id} style={styles.sheetItem} onPress={() => forwardToFriend(f)}>
                  <Text style={styles.sheetItemText}>{f.username}</Text>
                </TouchableOpacity>
              ))
            )}
          </GlassView>
        </Pressable>
      </Modal>

      {/* full-screen video player */}
      <Modal visible={!!videoPlayer} animationType="fade" onRequestClose={() => setVideoPlayer(null)}>
        <View style={styles.videoPlayerScreen}>
          {videoPlayer?.fileUri ? (
            <Video
              source={{ uri: videoPlayer.fileUri }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="contain"
              controls
              paused={false}
            />
          ) : (
            <Text style={{ color: 'white', textAlign: 'center', marginTop: 100 }}>Video unavailable</Text>
          )}
          <View style={styles.videoPlayerHeader}>
            <GlassView style={styles.videoCloseBtn} blurAmount={14} tint={0.25}>
              <TouchableOpacity onPress={() => setVideoPlayer(null)}>
                <X size={20} color="white" />
              </TouchableOpacity>
            </GlassView>
          </View>
        </View>
      </Modal>

      {/* in-app PDF viewer */}
      <Modal visible={!!pdfViewer} animationType="slide" onRequestClose={() => setPdfViewer(null)}>
        <View style={styles.pdfScreen}>
          <GlassView style={styles.pdfHeader} blurAmount={18}>
            <TouchableOpacity onPress={() => setPdfViewer(null)}>
              <Text style={styles.backArrow}><ChevronLeft size={22} color="#0f0f1a" /></Text>
            </TouchableOpacity>
            <Text style={styles.pdfTitle} numberOfLines={1}>{pdfViewer?.filename || 'Document'}</Text>
          </GlassView>
          {pdfViewer?.fileUri && (
            <Pdf
              source={{ uri: pdfViewer.fileUri, cache: true }}
              style={{ flex: 1 }}
              onError={() => {
                if (pdfViewer?.fileUri) {
                  FileViewer.open(pdfViewer.fileUri, { showOpenWithDialog: true }).catch(() => {});
                }
                setPdfViewer(null);
              }}
            />
          )}
        </View>
      </Modal>
    </WallpaperBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1c1c26' },
  headerOuter: { padding: 14, paddingBottom: 0 },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  backArrow: { fontSize: 24, color: '#0f0f1a', marginRight: 2 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerVerifiedBadge: { position: 'absolute', width: 13, height: 13, borderRadius: 6.5, top: -1, right: -1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff' },
  headerAvatarText: { color: 'white', fontWeight: '700' },
  headerName: { fontSize: 14.5, fontWeight: '700', color: '#0f0f1a' },
  headerStatus: { fontSize: 10.5, color: '#9ca3af', fontWeight: '600' },
  headerIconBtn: { paddingHorizontal: 6 },
  headerIcon: { fontSize: 16 },
  msgRow: { marginBottom: 12 },
  bubble: { maxWidth: '78%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  docBubble: { paddingVertical: 8, paddingHorizontal: 10 },
  msgText: { fontSize: 14.5 },
  msgMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  heartPopOverlay: { position: 'absolute', top: '15%', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  reactionBadge: { fontSize: 12 },
  msgTime: { fontSize: 10, color: '#e5e7eb' },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voicePlayBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  voiceBars: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  voiceBar: { width: 2.5, borderRadius: 1 },
  voiceDuration: { fontSize: 10.5 },
  shimmerBubble: { width: 90, height: 34, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  shimmerSweep: { position: 'absolute', top: 0, width: 40, height: '100%', backgroundColor: 'rgba(255,255,255,0.7)' },
  attachGridWrap: { marginHorizontal: 14, marginBottom: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12, justifyContent: 'space-between' },
  attachItem: { width: '28%', alignItems: 'center', gap: 6 },
  attachIconCircle: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  attachLabel: { fontSize: 10.5, color: '#0f0f1a', fontWeight: '600' },
  replyBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginBottom: 6, padding: 10, borderRadius: 14, borderLeftWidth: 3, borderLeftColor: '#4f46e5', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  replyBannerLabel: { fontSize: 10.5, fontWeight: '700', color: '#4f46e5' },
  replyBannerText: { fontSize: 12.5, color: '#0f0f1a', marginTop: 1 },
  inputOuter: { padding: 14, paddingTop: 0 },
  inputInner: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  inputIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(15,15,26,0.08)', alignItems: 'center', justifyContent: 'center' },
  sendBtn: { backgroundColor: '#0f0f1a' },
  recordingBtn: { backgroundColor: '#ef4444' },
  inputIcon: { fontSize: 15 },
  textInput: { flex: 1, fontSize: 14, color: '#0f0f1a', maxHeight: 100, paddingHorizontal: 4, paddingVertical: 8 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderBottomWidth: 0 },
  forwardSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 16, paddingHorizontal: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderBottomWidth: 0, maxHeight: '60%' },
  forwardEmpty: { fontSize: 13, color: '#9ca3af', paddingHorizontal: 20, paddingVertical: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)' },
  sheetHeaderText: { fontWeight: '700', fontSize: 15, paddingHorizontal: 20, paddingBottom: 8 },
  sheetItem: { paddingVertical: 13, paddingHorizontal: 20 },
  sheetItemText: { fontSize: 14.5, color: '#0f0f1a' },
  imageThumbWrap: { width: 220, height: 220, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  imageThumbImage: { width: '100%', height: '100%' },
  videoThumbWrap: { width: 220, height: 150, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  videoThumbImage: { width: '100%', height: '100%' },
  videoPlayOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  videoPlayCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  videoPlayIcon: { color: 'white', fontSize: 16 },
  videoDurationBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  videoDurationText: { color: 'white', fontSize: 10 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180 },
  docIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: 13.5, fontWeight: '600' },
  docMeta: { fontSize: 10.5, marginTop: 2 },
  videoPlayerScreen: { flex: 1, backgroundColor: 'black' },
  videoPlayerHeader: { position: 'absolute', top: 40, left: 16 },
  videoCloseBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  videoCloseIcon: { color: 'white', fontSize: 16 },
  pdfScreen: { flex: 1, backgroundColor: '#eef2ff' },
  pdfHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingTop: 44, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.5)' },
  pdfTitle: { fontSize: 14.5, fontWeight: '700', color: '#0f0f1a', flex: 1 },
});
