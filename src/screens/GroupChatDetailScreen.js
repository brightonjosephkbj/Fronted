import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, ImageBackground, Image, Alert, Linking,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { BadgeCheck, ChevronLeft, FileText, Mic, Phone, Plus, Send, Settings, Video } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import FileViewer from 'react-native-file-viewer';

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
// Adjust these to match your backend's actual socket event names once
// group messaging endpoints exist server-side.
const EVENT_NEW_GROUP_MESSAGE = 'new_group_message';
const EVENT_SEND_GROUP_MESSAGE = 'send_group_message';
const EVENT_GROUP_TYPING = 'group_typing';
const EVENT_GROUP_STOP_TYPING = 'group_stop_typing';

const ATTACH_GRID = [
  { key: 'photo', label: 'Photo' },
  { key: 'video', label: 'Video' },
  { key: 'document', label: 'Document' },
];

function GlassView({ style, children, blurAmount = 18, tint = 0.35 }) {
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={blurAmount} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(255,255,255,${tint})` }]} />
      {children}
    </View>
  );
}

function typingLabel(names) {
  if (!names.length) return null;
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return `${names[0]} and ${names.length - 1} others are typing`;
}

export default function GroupChatDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { apiRequest, apiUpload, user, token } = useAuth();
  const { socket } = useSocket();
  const group = route.params?.chat || { id: 'group', name: 'Group', color: '#4f46e5', onlineCount: 0 };
  const groupId = group.id;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState({}); // { userId: name }
  const [statusFlip, setStatusFlip] = useState(false);
  const [wallpaperColor, setWallpaperColor] = useState(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [myRole, setMyRole] = useState('member');
  const [sendPerm, setSendPerm] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const [globalWp, chatWpRaw] = await Promise.all([
          AsyncStorage.getItem(WALLPAPER_CACHE_KEY),
          AsyncStorage.getItem(CHAT_WALLPAPER_KEY),
        ]);
        const chatWpMap = chatWpRaw ? JSON.parse(chatWpRaw) : {};
        const override = chatWpMap[groupId];
        setWallpaperColor(override || globalWp || null);
      } catch (e) {
        // fall back to the default papercut image
      }
    })();
  }, [groupId]);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const formatTime = (unixSeconds) => {
    const d = new Date((unixSeconds || Date.now() / 1000) * 1000);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const mapServerMessage = useCallback((m) => ({
    id: String(m.id ?? Date.now()),
    sender: m.sender_id === user?.id ? 'me' : (m.sender_username || String(m.sender_id)),
    senderColor: m.sender_color,
    senderName: m.sender_name || m.sender_username,
    senderVerified: m.sender_verified,
    text: m.content,
    time: formatTime(m.timestamp),
    mediaType: m.media_type,
    mediaUrl: m.media_url,
  }), [user?.id]);

  // Who am I in this group, and who's allowed to send here (channels are
  // admin-only broadcast; regular groups respect the configurable send_perm).
  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest(`/groups/${groupId}/members/detailed`);
        const me = data?.members?.find(m => m.id === user?.id);
        if (me) setMyRole(me.role);
        if (data?.permissions?.send_perm) setSendPerm(data.permissions.send_perm);
      } catch (e) {
        // fall back to the safe default: everyone can send
      }
    })();
  }, [groupId, user?.id]);

  // Load history
  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest(`/groups/${groupId}/messages`);
        if (Array.isArray(data?.messages)) {
          setMessages(data.messages.map(mapServerMessage));
        }
      } catch (e) {
        // backend endpoint not ready yet, screen still works with empty history
      }
    })();
  }, [groupId]);

  // Real-time updates — shared socket from SocketContext, not a new connection
  useEffect(() => {
    if (!socket) return;
    socketRef.current = socket;

    socket.emit('join_group', { token, group_id: groupId });

    const onNewGroupMessage = (data) => {
      if (String(data.group_id) !== String(groupId)) return;
      setMessages(prev => [...prev, mapServerMessage(data)]);
    };
    const onGroupTyping = (data) => {
      if (String(data.group_id) !== String(groupId) || data.user_id === user?.id) return;
      setTypingUsers(prev => ({ ...prev, [data.user_id]: data.username || 'Someone' }));
    };
    const onGroupStopTyping = (data) => {
      if (String(data.group_id) !== String(groupId)) return;
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[data.user_id];
        return next;
      });
    };

    socket.on(EVENT_NEW_GROUP_MESSAGE, onNewGroupMessage);
    socket.on(EVENT_GROUP_TYPING, onGroupTyping);
    socket.on(EVENT_GROUP_STOP_TYPING, onGroupStopTyping);

    return () => {
      socket.emit('leave_group', { token, group_id: groupId });
      socket.off(EVENT_NEW_GROUP_MESSAGE, onNewGroupMessage);
      socket.off(EVENT_GROUP_TYPING, onGroupTyping);
      socket.off(EVENT_GROUP_STOP_TYPING, onGroupStopTyping);
    };
  }, [socket, token, groupId, user?.id, mapServerMessage]);

  useEffect(() => {
    const t = setInterval(() => setStatusFlip(v => !v), 3200);
    return () => clearInterval(t);
  }, []);

  function handleInputChange(text) {
    setInput(text);
    if (!socketRef.current) return;
    socketRef.current.emit(EVENT_GROUP_TYPING, { token, group_id: groupId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit(EVENT_GROUP_STOP_TYPING, { token, group_id: groupId });
    }, 1500);
  }

  function handleSend() {
    if (!input.trim() || !socketRef.current) return;
    const text = input.trim();
    setInput('');
    socketRef.current.emit(EVENT_GROUP_STOP_TYPING, { token, group_id: groupId });
    socketRef.current.emit(EVENT_SEND_GROUP_MESSAGE, {
      token,
      group_id: groupId,
      content: text,
    });
  }

  async function uploadAndSendGroupAttachment(uri, filename, mimeType, mediaType) {
    if (!socketRef.current) return;
    try {
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: mimeType || 'application/octet-stream' });
      formData.append('type', mediaType);
      const result = await apiUpload('/media/upload', formData);
      socketRef.current.emit(EVENT_SEND_GROUP_MESSAGE, {
        token,
        group_id: groupId,
        content: filename,
        media_type: mediaType,
        media_url: result.url,
      });
    } catch (e) {
      Alert.alert('Upload failed', "Couldn't send that attachment. Check your connection and try again.");
    }
  }

  async function pickGroupPhoto() {
    setAttachOpen(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to send images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    uploadAndSendGroupAttachment(asset.uri, asset.fileName || 'photo.jpg', asset.mimeType, 'image');
  }

  async function pickGroupVideo() {
    setAttachOpen(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to send videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    uploadAndSendGroupAttachment(asset.uri, asset.fileName || 'video.mp4', asset.mimeType, 'video');
  }

  async function pickGroupDocument() {
    setAttachOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      uploadAndSendGroupAttachment(asset.uri, asset.name || 'document', asset.mimeType, 'document');
    } catch (e) {
      Alert.alert('Error', "Couldn't open the document picker.");
    }
  }

  async function openGroupDocument(url, name) {
    try {
      await FileViewer.open(url, { showOpenWithDialog: true });
    } catch (e) {
      Alert.alert('Error', "Couldn't open that file.");
    }
  }

  const typingNames = Object.values(typingUsers);
  const typingLbl = typingLabel(typingNames);
  const headerStatus = typingLbl && statusFlip ? typingLbl : `${group.onlineCount || 0} online`;

  const renderMessage = ({ item }) => {
    const isMe = item.sender === 'me';
    return (
      <View style={[styles.msgRow, { alignItems: isMe ? 'flex-end' : 'flex-start' }]}>
        <View style={{ flexDirection: 'row', gap: 8, maxWidth: '82%', alignItems: 'flex-end' }}>
          {!isMe && (
            <View style={{ width: 26, height: 26 }}>
              <View style={[styles.memberAvatar, { backgroundColor: item.senderColor || '#9ca3af' }]}>
                <Text style={styles.memberAvatarText}>{item.senderName?.[0] || '?'}</Text>
              </View>
              {item.senderVerified && (
                <View style={[styles.memberVerifiedBadge, { backgroundColor: verifiedColor(item.senderVerified) }]}>
                  <BadgeCheck size={7} color="#fff" strokeWidth={3} />
                </View>
              )}
            </View>
          )}
          <View>
            {!isMe && <Text style={[styles.memberName, { color: item.senderColor || '#6b6b7a' }]}>{item.senderName}</Text>}
            <GlassView style={styles.bubble} tint={isMe ? 0 : 0.5} blurAmount={14}>
              <View style={isMe ? styles.bubbleMeBg : null}>
                {item.mediaType === 'image' && item.mediaUrl ? (
                  <Image source={{ uri: item.mediaUrl }} style={styles.groupMediaImage} resizeMode="cover" />
                ) : item.mediaType === 'video' && item.mediaUrl ? (
                  <TouchableOpacity onPress={() => Linking.openURL(item.mediaUrl)} style={styles.groupVideoBubble}>
                    <Video size={20} color={isMe ? 'white' : '#0f0f1a'} />
                    <Text style={[styles.msgText, { color: isMe ? 'white' : '#0f0f1a', marginLeft: 8 }]}>{item.text}</Text>
                  </TouchableOpacity>
                ) : item.mediaType === 'document' && item.mediaUrl ? (
                  <TouchableOpacity onPress={() => openGroupDocument(item.mediaUrl, item.text)} style={styles.groupDocBubble}>
                    <FileText size={20} color={isMe ? 'white' : '#0f0f1a'} />
                    <Text style={[styles.msgText, { color: isMe ? 'white' : '#0f0f1a', marginLeft: 8 }]} numberOfLines={1}>{item.text}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.msgText, { color: isMe ? 'white' : '#0f0f1a' }]}>{item.text}</Text>
                )}
              </View>
            </GlassView>
          </View>
        </View>
        <Text style={[styles.msgTime, { marginLeft: isMe ? 0 : 34 }]}>{item.time}</Text>
      </View>
    );
  };

  const isChannel = group.groupType === 'channel';
  const canSend = isChannel ? myRole === 'admin' : (sendPerm !== 'admins' || myRole === 'admin');

  return (
    <WallpaperBackground color={wallpaperColor} style={styles.screen}>
      <View style={styles.headerOuter}>
        <GlassView style={styles.headerInner} blurAmount={18}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={22} color="#0f0f1a" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('GroupSettings', { group })}>
            <Settings size={18} color="#0f0f1a" />
          </TouchableOpacity>
          <View style={[styles.headerAvatar, { backgroundColor: group.color || '#4f46e5' }]}>
            <Text style={styles.headerAvatarText}>{group.name?.[0]}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerName} numberOfLines={1}>{group.name}</Text>
            <Text style={[styles.headerStatus, typingLbl && statusFlip && { color: '#4f46e5' }]} numberOfLines={1}>
              {headerStatus}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Call', { contact: group })}>
            <Video size={18} color="#0f0f1a" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Call', { contact: group, audioOnly: true })} style={{ marginLeft: 10 }}>
            <Phone size={16} color="#0f0f1a" />
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

      {canSend ? (
        <>
          {attachOpen && (
            <GlassView style={styles.attachGridWrap} blurAmount={22}>
              <View style={styles.attachGrid}>
                {ATTACH_GRID.map(a => (
                  <TouchableOpacity
                    key={a.key}
                    style={styles.attachItem}
                    onPress={() => {
                      if (a.key === 'photo') return pickGroupPhoto();
                      if (a.key === 'video') return pickGroupVideo();
                      if (a.key === 'document') return pickGroupDocument();
                    }}
                  >
                    <View style={styles.attachIconCircle}><Text style={{ color: 'white' }}>●</Text></View>
                    <Text style={styles.attachLabel}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </GlassView>
          )}
          <View style={styles.inputOuter}>
            <GlassView style={styles.inputInner} blurAmount={18}>
              <TouchableOpacity style={styles.attachToggleBtn} onPress={() => setAttachOpen(v => !v)}>
                <Plus size={18} color="#0f0f1a" />
              </TouchableOpacity>
              <TextInput
                value={input}
                onChangeText={handleInputChange}
                placeholder={`Message ${group.name}...`}
                placeholderTextColor="#9ca3af"
                multiline
                style={styles.textInput}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                {input.trim() ? <Send size={15} color="white" /> : <Mic size={15} color="white" />}
              </TouchableOpacity>
            </GlassView>
          </View>
        </>
      ) : (
        <View style={styles.inputOuter}>
          <GlassView style={styles.restrictedNotice} blurAmount={18}>
            <Text style={styles.restrictedNoticeText}>
              {isChannel ? 'Only admins can post in this channel.' : 'Only admins can send messages in this group.'}
            </Text>
          </GlassView>
        </View>
      )}
    </WallpaperBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1c1c26' },
  headerOuter: { padding: 14, paddingBottom: 0 },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: 'white', fontWeight: '700' },
  headerName: { fontSize: 14.5, fontWeight: '700', color: '#0f0f1a' },
  headerStatus: { fontSize: 10.5, color: '#9ca3af', fontWeight: '600' },
  msgRow: { marginBottom: 12 },
  memberAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  memberVerifiedBadge: { position: 'absolute', width: 10, height: 10, borderRadius: 5, top: -1, right: -1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.2, borderColor: '#ffffff' },
  memberAvatarText: { color: 'white', fontSize: 11, fontWeight: '700' },
  memberName: { fontSize: 11, fontWeight: '700', marginBottom: 2, marginLeft: 2 },
  bubble: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  bubbleMeBg: { backgroundColor: 'rgba(79,70,229,0.55)', margin: -10, padding: 10, borderRadius: 18 },
  msgText: { fontSize: 14.5 },
  msgTime: { fontSize: 10, color: '#e5e7eb', marginTop: 4 },
  inputOuter: { padding: 14, paddingTop: 0 },
  inputInner: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  textInput: { flex: 1, fontSize: 14, color: '#0f0f1a', maxHeight: 100, paddingHorizontal: 8, paddingVertical: 8 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#0f0f1a', alignItems: 'center', justifyContent: 'center' },
  attachToggleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  attachGridWrap: { marginHorizontal: 14, marginBottom: 8, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
  attachItem: { width: '28%', alignItems: 'center', gap: 6 },
  attachIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  attachLabel: { fontSize: 11, fontWeight: '600', color: '#0f0f1a' },
  groupMediaImage: { width: 200, height: 200, borderRadius: 14 },
  groupVideoBubble: { flexDirection: 'row', alignItems: 'center' },
  groupDocBubble: { flexDirection: 'row', alignItems: 'center', maxWidth: 180 },
  restrictedNotice: { borderRadius: 20, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center' },
  restrictedNoticeText: { fontSize: 12.5, color: '#6b6b7a', fontWeight: '600', textAlign: 'center' },
});
