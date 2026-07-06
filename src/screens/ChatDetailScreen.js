import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput,
  Modal, Pressable, Animated, ImageBackground, Image, Platform,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import Video from 'react-native-video';
import Pdf from 'react-native-pdf';
import FileViewer from 'react-native-file-viewer';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Check, CheckCheck, ChevronLeft, FileText, Mic, Pause, Phone, Play, Plus, Send, Settings, Video as VideoIcon, X } from 'lucide-react-native';
import { io } from 'socket.io-client';

const DEFAULT_WALLPAPER = require('../../assets/wallpapers/default-papercut.png');
const MESSENGER_API = 'https://Brighton233j-Messenger-back-database.hf.space';

const ATTACH_GRID = [
  { key: 'photo', label: 'Photo' },
  { key: 'video', label: 'Video' },
  { key: 'document', label: 'Document' },
  { key: 'location', label: 'Location' },
  { key: 'contact', label: 'Contact' },
  { key: 'poll', label: 'Poll' },
];

const ACTION_SHEET = [
  { key: 'reply', label: 'Reply' },
  { key: 'forward', label: 'Forward' },
  { key: 'copy', label: 'Copy' },
  { key: 'react', label: 'React' },
  { key: 'star', label: 'Star' },
  { key: 'delete', label: 'Delete', danger: true },
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

function VoiceNoteBubble({ fromMe }) {
  const [playing, setPlaying] = useState(false);
  const bars = useRef(Array.from({ length: 18 }, (_, i) => 4 + ((i * 37) % 14))).current;
  return (
    <View style={styles.voiceRow}>
      <TouchableOpacity onPress={() => setPlaying(p => !p)} style={[styles.voicePlayBtn, { backgroundColor: fromMe ? 'rgba(255,255,255,0.9)' : '#0f0f1a' }]}>
        {playing ? <Pause size={11} color={fromMe ? '#4f46e5' : 'white'} /> : <Play size={11} color={fromMe ? '#4f46e5' : 'white'} />}
      </TouchableOpacity>
      <View style={styles.voiceBars}>
        {bars.map((h, i) => (
          <View key={i} style={[styles.voiceBar, { height: playing ? h + 4 : h, backgroundColor: fromMe ? 'rgba(255,255,255,0.7)' : '#c7c7d1' }]} />
        ))}
      </View>
      <Text style={[styles.voiceDuration, { color: fromMe ? 'rgba(255,255,255,0.75)' : '#9ca3af' }]}>0:24</Text>
    </View>
  );
}

function VideoThumbBubble({ item, onOpen }) {
  return (
    <TouchableOpacity onPress={() => onOpen(item)} style={styles.videoThumbWrap}>
      {item.thumbnailUri ? (
        <Image source={{ uri: item.thumbnailUri }} style={styles.videoThumbImage} />
      ) : (
        <View style={[styles.videoThumbImage, { backgroundColor: '#1c1c26' }]} />
      )}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.videoPlayOverlay}>
          <GlassView style={styles.videoPlayCircle} blurAmount={14} tint={0.25}>
            <Text style={styles.videoPlayIcon}>▶</Text>
          </GlassView>
        </View>
      </View>
      {item.duration && (
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

export default function ChatDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { apiRequest, user, token } = useAuth();
  const chat = route.params?.chat || { id: 'unknown', name: 'Unknown', color: '#9333ea' };
  const recipientId = parseInt(chat.id, 10);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(route.params?.prefill || '');
  const [attachOpen, setAttachOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [videoPlayer, setVideoPlayer] = useState(null);
  const [pdfViewer, setPdfViewer] = useState(null);
  const lastTapRef = useRef({ id: null, time: 0 });
  const socketRef = useRef(null);

  const formatTime = (unixSeconds) => {
    const d = new Date(unixSeconds * 1000);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const mapServerMessage = useCallback((m) => ({
    id: String(m.id),
    from: m.sender_id === user?.id ? 'me' : 'them',
    text: m.content,
    time: formatTime(m.timestamp),
    ticks: m.sender_id === user?.id ? (m.read_status ? 'read' : 'delivered') : undefined,
    voice: m.media_type === 'voice',
    revealed: true,
  }), [user?.id]);

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

  // Real-time connection
  useEffect(() => {
    if (!token) return;
    const socket = io(MESSENGER_API, { query: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('new_message', (data) => {
      const involvesThisChat =
        (data.sender_id === recipientId && data.recipient_id === user?.id) ||
        (data.sender_id === user?.id && data.recipient_id === recipientId);
      if (!involvesThisChat) return;

      setMessages(prev => [...prev, {
        id: String(data.id ?? Date.now()),
        from: data.sender_id === user?.id ? 'me' : 'them',
        text: data.content,
        time: formatTime(Math.floor(Date.now() / 1000)),
        ticks: data.sender_id === user?.id ? 'sent' : undefined,
        voice: data.media_type === 'voice',
        revealed: false,
      }]);
    });

    return () => socket.disconnect();
  }, [token, recipientId, user?.id]);

  const markRevealed = useCallback((id) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, revealed: true } : m));
  }, []);

  function handleSend() {
    if (!input.trim() || !socketRef.current) return;
    const text = input.trim();
    setInput('');
    socketRef.current.emit('send_message', {
      token,
      recipient_id: recipientId,
      content: text,
    });
  }

  function handleDoubleTap(msgId) {
    const now = Date.now();
    if (lastTapRef.current.id === msgId && now - lastTapRef.current.time < 300) {
      lastTapRef.current = { id: null, time: 0 };
    } else {
      lastTapRef.current = { id: msgId, time: now };
    }
  }

  const renderMessage = ({ item }) => {
    const isMe = item.from === 'me';

    if (item.type === 'video') {
      return (
        <TouchableOpacity
          onLongPress={() => setActionMsg(item)}
          delayLongPress={400}
          style={[styles.msgRow, { alignItems: isMe ? 'flex-end' : 'flex-start' }]}
        >
          <VideoThumbBubble item={item} onOpen={setVideoPlayer} />
          <View style={styles.msgMetaRow}>
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
            <VoiceNoteBubble fromMe={isMe} />
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
        <View style={styles.msgMetaRow}>
          <Text style={styles.msgTime}>{item.time}</Text>
          {isMe && item.ticks && <Ticks status={item.ticks} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground source={DEFAULT_WALLPAPER} style={styles.screen} resizeMode="cover">
      <View style={styles.headerOuter}>
        <GlassView style={styles.headerInner} blurAmount={18}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}><ChevronLeft size={22} color="#0f0f1a" /></Text>
          </TouchableOpacity>
          <View style={[styles.headerAvatar, { backgroundColor: chat.color || '#9333ea' }]}>
            <Text style={styles.headerAvatarText}>{chat.name?.[0]?.toUpperCase()}</Text>
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
        data={messages}
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
              <TouchableOpacity key={a.key} style={styles.attachItem}>
                <View style={styles.attachIconCircle}><Text style={{ color: 'white' }}>●</Text></View>
                <Text style={styles.attachLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassView>
      )}

      <View style={styles.inputOuter}>
        <GlassView style={styles.inputInner} blurAmount={18}>
          <TouchableOpacity style={styles.inputIconBtn} onPress={() => setAttachOpen(v => !v)}>
            {attachOpen ? <X size={17} color="#0f0f1a" /> : <Plus size={17} color="#0f0f1a" />}
          </TouchableOpacity>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type Here..."
            placeholderTextColor="#9ca3af"
            multiline
            style={styles.textInput}
          />
          <TouchableOpacity style={[styles.inputIconBtn, styles.sendBtn]} onPress={handleSend}>
            {input.trim() ? <Send size={15} color="white" /> : <Mic size={15} color="white" />}
          </TouchableOpacity>
        </GlassView>
      </View>

      {/* long-press action sheet */}
      <Modal visible={!!actionMsg} transparent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setActionMsg(null)}>
          <GlassView style={styles.sheet} blurAmount={24}>
            {ACTION_SHEET.map(a => (
              <TouchableOpacity key={a.key} style={styles.sheetItem} onPress={() => setActionMsg(null)}>
                <Text style={[styles.sheetItemText, a.danger && { color: '#ef4444' }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
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
                // fall back to default app if in-app rendering fails
                if (pdfViewer?.fileUri) {
                  FileViewer.open(pdfViewer.fileUri, { showOpenWithDialog: true }).catch(() => {});
                }
                setPdfViewer(null);
              }}
            />
          )}
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1c1c26' },
  headerOuter: { padding: 14, paddingBottom: 0 },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  backArrow: { fontSize: 24, color: '#0f0f1a', marginRight: 2 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
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
  inputOuter: { padding: 14, paddingTop: 0 },
  inputInner: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  inputIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(15,15,26,0.08)', alignItems: 'center', justifyContent: 'center' },
  sendBtn: { backgroundColor: '#0f0f1a' },
  inputIcon: { fontSize: 15 },
  textInput: { flex: 1, fontSize: 14, color: '#0f0f1a', maxHeight: 100, paddingHorizontal: 4, paddingVertical: 8 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderBottomWidth: 0 },
  sheetItem: { paddingVertical: 13, paddingHorizontal: 20 },
  sheetItemText: { fontSize: 14.5, color: '#0f0f1a' },
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
