import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, ImageBackground,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { BadgeCheck, ChevronLeft, Mic, Phone, Send, Settings, Video } from 'lucide-react-native';
import { io } from 'socket.io-client';

const DEFAULT_WALLPAPER = require('../../assets/wallpapers/default-papercut.png');

function verifiedColor(tick) {
  if (tick === 'cyan') return '#06b6d4';
  if (tick === 'blue') return '#3b82f6';
  return '#a855f7';
}
const MESSENGER_API = 'https://Brighton233j-Messenger-back-database.hf.space';

// Adjust these to match your backend's actual socket event names once
// group messaging endpoints exist server-side.
const EVENT_NEW_GROUP_MESSAGE = 'new_group_message';
const EVENT_SEND_GROUP_MESSAGE = 'send_group_message';
const EVENT_GROUP_TYPING = 'group_typing';
const EVENT_GROUP_STOP_TYPING = 'group_stop_typing';

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
  const { apiRequest, user, token } = useAuth();
  const group = route.params?.chat || { id: 'group', name: 'Group', color: '#4f46e5', onlineCount: 0 };
  const groupId = group.id;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState({}); // { userId: name }
  const [statusFlip, setStatusFlip] = useState(false);
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
  }), [user?.id]);

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

  // Real-time connection, scoped to this group
  useEffect(() => {
    if (!token) return;
    const socket = io(MESSENGER_API, { query: { token, group_id: groupId }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.emit('join_group', { token, group_id: groupId });

    socket.on(EVENT_NEW_GROUP_MESSAGE, (data) => {
      if (String(data.group_id) !== String(groupId)) return;
      setMessages(prev => [...prev, mapServerMessage(data)]);
    });

    socket.on(EVENT_GROUP_TYPING, (data) => {
      if (String(data.group_id) !== String(groupId) || data.user_id === user?.id) return;
      setTypingUsers(prev => ({ ...prev, [data.user_id]: data.username || 'Someone' }));
    });

    socket.on(EVENT_GROUP_STOP_TYPING, (data) => {
      if (String(data.group_id) !== String(groupId)) return;
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[data.user_id];
        return next;
      });
    });

    return () => {
      socket.emit('leave_group', { token, group_id: groupId });
      socket.disconnect();
    };
  }, [token, groupId, user?.id, mapServerMessage]);

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
                <Text style={[styles.msgText, { color: isMe ? 'white' : '#0f0f1a' }]}>{item.text}</Text>
              </View>
            </GlassView>
          </View>
        </View>
        <Text style={[styles.msgTime, { marginLeft: isMe ? 0 : 34 }]}>{item.time}</Text>
      </View>
    );
  };

  return (
    <ImageBackground source={DEFAULT_WALLPAPER} style={styles.screen} resizeMode="cover">
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

      <View style={styles.inputOuter}>
        <GlassView style={styles.inputInner} blurAmount={18}>
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
    </ImageBackground>
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
});
