import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Image,
  Modal, Pressable, PanResponder, Animated, ScrollView, Easing, Alert, Share,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import Video from 'react-native-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { BadgeCheck } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useNavigation } from '@react-navigation/native';

const FOLDERS = ['All', 'Business', 'Groups', 'Favourites'];

const FAB_ITEMS = [
  { key: 'joy', label: 'Joy', sub: 'Chat with your AI assistant' },
  { key: 'addfriend', label: 'Add Friend', sub: 'Find someone by username' },
  { key: 'group', label: 'Create Group', sub: 'Start a group chat' },
  { key: 'channel', label: 'Create Channel', sub: 'Broadcast to followers' },
  { key: 'broadcast', label: 'Broadcast', sub: 'Send to multiple chats at once' },
];

const COLOR_PRESETS = ['#4f46e5', '#9333ea', '#db2777', '#f97316', '#16a34a', '#0891b2', '#c026d3', '#ef4444'];
const TOP_BAR_BG_KEY = 'b24_top_bar_bg';

const CHATS_CACHE_KEY = 'b24_chats_cache';
const CHAT_META_KEY = 'b24_chat_meta';
const APP_LOCK_PIN_KEY = 'appLockPin';
const PIN_LENGTH = 4;

function resolveBackground(bg) {
  if (bg?.type === 'photo' && bg.value) return { type: 'photo', value: bg.value };
  if (bg?.type === 'video' && bg.value) return { type: 'video', value: bg.value };
  return { type: 'color', value: bg?.value || '#4f46e5' };
}

function TopBarBackground({ bg }) {
  const resolved = resolveBackground(bg);
  if (resolved.type === 'photo') {
    return <Image source={{ uri: resolved.value }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />;
  }
  if (resolved.type === 'video') {
    return (
      <Video
        source={{ uri: resolved.value }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
        repeat
        muted
        paused={false}
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: resolved.value }]} />;
}

function GlassView({ style, children, blurType = 'light', blurAmount = 18 }) {
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <BlurView style={StyleSheet.absoluteFill} blurType={blurType} blurAmount={blurAmount} />
      <View style={styles.glassTint} />
      {children}
    </View>
  );
}

function verifiedColor(tick) {
  if (tick === 'cyan') return '#06b6d4';
  if (tick === 'blue') return '#3b82f6';
  return '#a855f7';
}

function Avatar({ name, color, size = 46, ring, imageUri, verified }) {
  const badgeSize = Math.max(14, Math.round(size * 0.32));
  return (
    <View style={{ width: size, height: size }}>
      {ring && (
        <View style={[styles.ringOuter, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, borderColor: ring, top: -3, left: -3 }]} />
      )}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: size / 2.3 }}>{name ? name[0].toUpperCase() : '?'}</Text>
        </View>
      )}
      {verified && (
        <View style={[
          styles.verifiedBadge,
          {
            width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2,
            backgroundColor: verifiedColor(verified),
            top: -badgeSize * 0.15, right: -badgeSize * 0.15,
          },
        ]}>
          <BadgeCheck size={badgeSize * 0.62} color="#fff" strokeWidth={3} />
        </View>
      )}
    </View>
  );
}

function ChatRow({ chat, onPress, onLongPress, onOpenProfile, onArchive, onMute }) {
  const translateX = useState(new Animated.Value(0))[0];
  const SWIPE_THRESHOLD = 60;
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderMove: (_, g) => translateX.setValue(Math.max(-90, Math.min(90, g.dx))),
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE_THRESHOLD) onArchive && onArchive(chat);
      else if (g.dx < -SWIPE_THRESHOLD) onMute && onMute(chat);
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    },
  });

  return (
    <View>
      <View style={styles.swipeBgWrap} pointerEvents="none">
        <View style={styles.swipeBgLeft}><Text style={styles.swipeBgText}>Archive</Text></View>
        <View style={styles.swipeBgRight}><Text style={styles.swipeBgText}>{chat.muted ? 'Unmute' : 'Mute'}</Text></View>
      </View>
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        <TouchableOpacity
          style={styles.chatRow}
          onPress={() => onPress(chat)}
          onLongPress={() => onLongPress(chat)}
          delayLongPress={450}
        >
        <Pressable onPress={() => onOpenProfile(chat)}>
          <Avatar name={chat.name} color={chat.color} verified={chat.verified} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {chat.pinned && <Text style={styles.pinIcon}>📌</Text>}
            <Text style={styles.chatName} numberOfLines={1}>{chat.name}</Text>
            {chat.muted && <Text style={styles.pinIcon}>🔇</Text>}
          </View>
          {chat.missedCall ? (
            <Text style={styles.missedCall}>Missed Call</Text>
          ) : (
            <Text style={styles.chatPreview} numberOfLines={1}>{chat.preview}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.chatTime}>{chat.time}</Text>
          {chat.unread ? (
            <View style={styles.unreadBadge}><Text style={styles.unreadText}>{chat.unread}</Text></View>
          ) : chat.unreadOverride ? (
            <View style={styles.unreadDot} />
          ) : null}
        </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// --- Confetti particle used by the level-up celebration ---
function ConfettiParticle({ delay, colorSet }) {
  const anim = useRef(new Animated.Value(0)).current;
  const startX = useRef(Math.random() * 280 - 140).current;
  const endX = useRef(startX + (Math.random() * 60 - 30)).current;
  const color = colorSet[Math.floor(Math.random() * colorSet.length)];

  useEffect(() => {
    anim.setValue(0);
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1, duration: 1200 + Math.random() * 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 90 + Math.random() * 40] });
  const translateXAnim = anim.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  const opacity = anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${Math.random() > 0.5 ? '' : '-'}360deg`] });

  return (
    <Animated.View
      style={{
        position: 'absolute', top: '40%', left: '50%', width: 8, height: 8, borderRadius: 2,
        backgroundColor: color, opacity,
        transform: [{ translateX: translateXAnim }, { translateY }, { rotate }],
      }}
    />
  );
}

function TopBarCelebration({ level }) {
  const particles = Array.from({ length: 24 });
  const colors = ['#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#a78bfa'];
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((_, i) => (
        <ConfettiParticle key={i} delay={i * 30} colorSet={colors} />
      ))}
      <View style={styles.achievementWrap}>
        <Text style={styles.achievementEmoji}>🏆</Text>
        <Text style={styles.achievementText}>Level {level} reached!</Text>
      </View>
    </View>
  );
}

export default function MainScreen() {
  const { user, apiRequest } = useAuth();
  const { banner, slideAnim, setActiveChatId, showBanner } = useNotifications();
  const navigation = useNavigation();
  const [chats, setChats] = useState([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [chatMeta, setChatMeta] = useState({});
  const [folder, setFolder] = useState('All');
  const [fabOpen, setFabOpen] = useState(false);
  const [longPressChat, setLongPressChat] = useState(null);
  const [profileChat, setProfileChat] = useState(null);
  const [activeTab, setActiveTab] = useState('Chats');
  const [celebrating, setCelebrating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [colorPickerChat, setColorPickerChat] = useState(null);
  const [topBarBg, setTopBarBg] = useState(null);
  const [topBarPickerOpen, setTopBarPickerOpen] = useState(false);
  const [pinPrompt, setPinPrompt] = useState(null); // chat pending PIN entry
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState(false);

  const points = user?.points ?? 30;
  const pointsTarget = user?.pointsTarget ?? 100;
  const level = user?.level ?? 3;
  const pct = Math.min(100, (points / pointsTarget) * 100);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const prevPointsRef = useRef(points);

  useEffect(() => {
    setActiveChatId(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TOP_BAR_BG_KEY);
        if (raw) setTopBarBg(JSON.parse(raw));
      } catch (e) {
        // fall back to the default color
      }
    })();
  }, []);

  async function saveTopBarBg(next) {
    setTopBarBg(next);
    setTopBarPickerOpen(false);
    try {
      if (next) await AsyncStorage.setItem(TOP_BAR_BG_KEY, JSON.stringify(next));
      else await AsyncStorage.removeItem(TOP_BAR_BG_KEY);
    } catch (e) {
      Alert.alert('Error', "Couldn't save your top bar background. Try again.");
    }
  }

  async function pickTopBarPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to set a background image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    saveTopBarBg({ type: 'photo', value: result.assets[0].uri });
  }

  async function pickTopBarVideo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to set a background video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    saveTopBarBg({ type: 'video', value: result.assets[0].uri });
  }

  // Poll for an active announcement and slide it into the top bar banner,
  // same slide-in/auto-dismiss mechanism already used for online/message alerts.
  useEffect(() => {
    let cancelled = false;

    async function checkAnnouncement() {
      try {
        const data = await apiRequest('/announcements/active');
        if (!cancelled && data?.announcement) {
          showBanner({
            type: 'announcement',
            title: data.announcement.title,
            subtitle: data.announcement.body || undefined,
          });
        }
      } catch (e) {
        // offline or backend unreachable - skip this cycle silently
      }
    }

    checkAnnouncement();
    const intervalId = setInterval(checkAnnouncement, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [apiRequest, showBanner]);

  // Load cached chats + local per-chat meta (pin/favourite/color/archive/lock/unread override)
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(CHATS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setChats(parsed);
        }
      } catch (e) {
        // corrupted cache, ignore
      }

      try {
        const meta = await AsyncStorage.getItem(CHAT_META_KEY);
        if (meta) setChatMeta(JSON.parse(meta));
      } catch (e) {
        // corrupted meta, ignore
      } finally {
        setChatsLoaded(true);
      }

      try {
        const data = await apiRequest('/chats');
        if (Array.isArray(data?.chats)) {
          setChats(data.chats);
          AsyncStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(data.chats)).catch(() => {});
        }
      } catch (e) {
        // offline or backend unreachable - keep showing cached chats
      }
    })();
  }, []);

  useEffect(() => {
    if (prevPointsRef.current < pointsTarget && points >= pointsTarget) {
      triggerCelebration();
    }
    prevPointsRef.current = points;
  }, [points, pointsTarget]);

  function triggerCelebration() {
    setCelebrating(true);
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    setTimeout(() => setCelebrating(false), 10000);
  }

  async function persistMeta(nextMeta) {
    setChatMeta(nextMeta);
    try {
      await AsyncStorage.setItem(CHAT_META_KEY, JSON.stringify(nextMeta));
    } catch (e) {
      // best-effort - not fatal if this write fails once
    }
  }

  function updateMeta(chatId, patch) {
    const nextMeta = { ...chatMeta, [chatId]: { ...chatMeta[chatId], ...patch } };
    persistMeta(nextMeta);
  }

  // Merge local meta into server chat objects for rendering/filtering/sorting
  const enrichedChats = chats.map(c => {
    const m = chatMeta[c.id] || {};
    return {
      ...c,
      pinned: !!m.pinned,
      muted: !!m.muted,
      favourite: !!m.favourite,
      archived: !!m.archived,
      locked: !!m.locked,
      unreadOverride: !!m.unread,
      color: m.color || c.color,
    };
  });

  let visibleChats = enrichedChats.filter(c => (showArchived ? c.archived : !c.archived));
  if (folder === 'Favourites') {
    visibleChats = visibleChats.filter(c => c.favourite);
  } else if (folder !== 'All') {
    visibleChats = visibleChats.filter(c => c.category === folder.toLowerCase());
  }
  visibleChats = [...visibleChats].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.time || 0) - (a.time || 0);
  });

  const archivedCount = enrichedChats.filter(c => c.archived).length;

  const openChat = useCallback((chat) => {
    if (chat.locked) {
      setPinPrompt(chat);
      setPinEntry('');
      setPinError(false);
      return;
    }
    if (chatMeta[chat.id]?.unread) {
      updateMeta(chat.id, { unread: false });
    }
    navigation.navigate(chat.isGroup ? 'GroupChatDetail' : 'ChatDetail', { chat });
  }, [navigation, chatMeta]);

  async function submitPin(pin) {
    try {
      const savedPin = await AsyncStorage.getItem(APP_LOCK_PIN_KEY);
      if (!savedPin) {
        setPinPrompt(null);
        Alert.alert('App Lock not set up', 'Set up a PIN in Settings > App Lock first before locking individual chats.');
        return;
      }
      if (pin === savedPin) {
        const chat = pinPrompt;
        setPinPrompt(null);
        if (chatMeta[chat.id]?.unread) updateMeta(chat.id, { unread: false });
        navigation.navigate(chat.isGroup ? 'GroupChatDetail' : 'ChatDetail', { chat });
      } else {
        setPinError(true);
        setPinEntry('');
      }
    } catch (e) {
      setPinError(true);
      setPinEntry('');
    }
  }

  function handlePinKey(key) {
    if (key === '') return;
    if (key === 'del') {
      setPinEntry(prev => prev.slice(0, -1));
      setPinError(false);
      return;
    }
    const next = pinEntry + String(key);
    setPinEntry(next);
    setPinError(false);
    if (next.length === PIN_LENGTH) submitPin(next);
  }

  const handleFabItem = (key) => {
    setFabOpen(false);
    if (key === 'joy') {
      const joyChat = chats.find(c => c.name === 'Joy') || { id: 'joy', name: 'Joy', color: '#9333ea' };
      navigation.navigate('ChatDetail', { chat: joyChat });
    } else if (key === 'addfriend') {
      navigation.navigate('AddFriend');
    } else if (key === 'group' || key === 'channel' || key === 'broadcast') {
      navigation.navigate('CreateNew', { type: key });
    }
  };

  async function exportChat(chat) {
    try {
      const path = chat.isGroup ? `/groups/${chat.id}/messages` : `/messages/${chat.id}`;
      const data = await apiRequest(path);
      const messages = data?.messages || [];
      if (messages.length === 0) {
        Alert.alert('Nothing to export', 'This chat has no messages yet.');
        return;
      }
      const lines = messages.map(m => {
        const who = m.sender_username || m.sender_name || (m.sender_id === user?.id ? 'You' : chat.name);
        const when = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString() : '';
        const text = m.media_type && m.media_type !== 'text' ? `[${m.media_type}]` : (m.content || '');
        return `${when}  ${who}: ${text}`;
      });
      await Share.share({
        title: `${chat.name} - chat export`,
        message: `Chat with ${chat.name}\n\n${lines.join('\n')}`,
      });
    } catch (e) {
      Alert.alert('Export failed', "Couldn't fetch messages to export. Check your connection.");
    }
  }

  function handleSheetAction(key) {
    const chat = longPressChat;
    setLongPressChat(null);
    if (!chat) return;
    const meta = chatMeta[chat.id] || {};

    switch (key) {
      case 'pin':
        updateMeta(chat.id, { pinned: !meta.pinned });
        break;
      case 'favourite':
        updateMeta(chat.id, { favourite: !meta.favourite });
        break;
      case 'unread':
        updateMeta(chat.id, { unread: !meta.unread });
        break;
      case 'color':
        setColorPickerChat(chat);
        break;
      case 'archive':
        updateMeta(chat.id, { archived: !meta.archived });
        break;
      case 'lock':
        if (!meta.locked) {
          AsyncStorage.getItem(APP_LOCK_PIN_KEY).then(pin => {
            if (!pin) {
              Alert.alert('App Lock not set up', 'Set up a PIN in Settings > App Lock first, then come back to lock this chat.');
            } else {
              updateMeta(chat.id, { locked: true });
            }
          });
        } else {
          updateMeta(chat.id, { locked: false });
        }
        break;
      case 'export':
        exportChat(chat);
        break;
      case 'mute':
        updateMeta(chat.id, { muted: !meta.muted });
        break;
      case 'block':
        Alert.alert(
          `Block ${chat.name}?`,
          "They won't be able to message you, and you won't see their messages.",
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block', style: 'destructive', onPress: async () => {
                try {
                  await apiRequest('/friends/block', {
                    method: 'POST',
                    body: JSON.stringify({ user_id: parseInt(chat.id, 10) }),
                  });
                  updateMeta(chat.id, { archived: true });
                } catch (e) {
                  Alert.alert('Error', "Couldn't block this contact. Try again.");
                }
              },
            },
          ]
        );
        break;
      case 'clear':
        Alert.alert(
          'Clear chat?',
          'This clears the chat history on your device only. The other person still has their copy.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear', style: 'destructive', onPress: async () => {
                try {
                  const key = `b24_msg_meta_${chat.id}`;
                  const raw = await AsyncStorage.getItem(key);
                  const existing = raw ? JSON.parse(raw) : {};
                  const next = { ...existing, clearedAt: Math.floor(Date.now() / 1000) };
                  await AsyncStorage.setItem(key, JSON.stringify(next));
                } catch (e) {
                  Alert.alert('Error', "Couldn't clear this chat. Try again.");
                }
              },
            },
          ]
        );
        break;
      case 'delete':
        Alert.alert(
          `Delete ${chat.name}?`,
          'This permanently deletes the chat history for both of you. This cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                  await apiRequest(`/messages/${parseInt(chat.id, 10)}`, { method: 'DELETE' });
                  updateMeta(chat.id, { archived: true });
                } catch (e) {
                  Alert.alert('Error', "Couldn't delete this chat. Try again.");
                }
              },
            },
          ]
        );
        break;
      default:
        break;
    }
  }

  function sheetActionsFor(chat) {
    const meta = (chat && chatMeta[chat.id]) || {};
    return [
      { key: 'pin', label: meta.pinned ? 'Unpin chat' : 'Pin chat' },
      { key: 'mute', label: meta.muted ? 'Unmute notifications' : 'Mute notifications' },
      { key: 'unread', label: meta.unread ? 'Mark as read' : 'Mark as unread' },
      { key: 'favourite', label: meta.favourite ? 'Remove from favourites' : 'Mark as favourite' },
      { key: 'color', label: 'Change chat color' },
      { key: 'archive', label: meta.archived ? 'Unarchive chat' : 'Archive chat' },
      { key: 'lock', label: meta.locked ? 'Unlock this chat' : 'Lock this chat' },
      { key: 'clear', label: 'Clear chat' },
      { key: 'export', label: 'Export chat' },
      { key: 'block', label: 'Block contact' },
      { key: 'delete', label: 'Delete chat', danger: true },
    ];
  }

  return (
    <View style={styles.screen}>
      {/* top bar */}
      <Animated.View style={[styles.topBarWrap, { transform: [{ rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
        <TopBarBackground bg={topBarBg || user?.topBar} />
        <BlurView style={StyleSheet.absoluteFill} blurType="dark" blurAmount={12} />

        {!celebrating && !banner && (
          <TouchableOpacity activeOpacity={0.9} onLongPress={() => setTopBarPickerOpen(true)} style={styles.topBarInner}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('Points')}>
              <Text style={styles.username}>{user?.username || 'you'}</Text>
              <Text style={styles.pointsText}>Level {level} · {points}/{pointsTarget} pts</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
              <Avatar name={user?.username} color="#1e1b4b" size={46} ring="#fbbf24" imageUri={user?.avatar_url} verified={user?.verified} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {celebrating && <TopBarCelebration level={level} />}

        {!celebrating && banner && (
          <Animated.View style={[styles.bannerRow, { transform: [{ translateY: slideAnim }] }]} onStartShouldSetResponder={() => true} onResponderRelease={() => banner.onPress && banner.onPress(navigation)}>
            <View style={[styles.bannerDot, { backgroundColor: banner.type === 'online' ? '#22c55e' : banner.type === 'announcement' ? '#f59e0b' : '#4f46e5' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
              {banner.subtitle && <Text style={styles.bannerSubtitle} numberOfLines={1}>{banner.subtitle}</Text>}
            </View>
          </Animated.View>
        )}
      </Animated.View>

      {/* search bar */}
      <TouchableOpacity onPress={() => navigation.navigate('Search')} style={styles.searchOuter}>
        <GlassView style={styles.searchBar}>
          <Text style={styles.searchPlaceholder}>Search friends</Text>
        </GlassView>
      </TouchableOpacity>

      {/* folder pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderRow} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {FOLDERS.map(f => (
          folder === f ? (
            <TouchableOpacity key={f} onPress={() => setFolder(f)} style={styles.folderPillActive}>
              <Text style={styles.folderTextActive}>{f}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity key={f} onPress={() => setFolder(f)}>
              <GlassView style={styles.folderPill}>
                <Text style={styles.folderText}>{f}</Text>
              </GlassView>
            </TouchableOpacity>
          )
        ))}
        <GlassView style={styles.folderPill}>
          <Text style={styles.folderText}>+ More</Text>
        </GlassView>
      </ScrollView>

      {archivedCount > 0 && (
        <TouchableOpacity onPress={() => setShowArchived(v => !v)} style={styles.archivedToggle}>
          <Text style={styles.archivedToggleText}>
            {showArchived ? '← Back to chats' : `Archived (${archivedCount})`}
          </Text>
        </TouchableOpacity>
      )}

      {/* chat list */}
      <FlatList
        data={visibleChats}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ChatRow
            chat={item}
            onPress={openChat}
            onLongPress={setLongPressChat}
            onOpenProfile={setProfileChat}
            onArchive={(c) => updateMeta(c.id, { archived: true })}
            onMute={(c) => updateMeta(c.id, { muted: !c.muted })}
          />
        )}
        style={{ flex: 1 }}
        ListEmptyComponent={chatsLoaded ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>{showArchived ? 'No archived chats' : 'No chats yet'}</Text>
            {!showArchived && <Text style={styles.emptySubtext}>Add a friend to start chatting</Text>}
          </View>
        ) : null}
      />

      {/* FAB */}
      {fabOpen && (
        <GlassView style={styles.fabMenu} blurAmount={22}>
          {FAB_ITEMS.map(item => (
            <TouchableOpacity key={item.key} style={styles.fabMenuItem} onPress={() => handleFabItem(item.key)}>
              <Text style={styles.fabMenuLabel}>{item.label}</Text>
              <Text style={styles.fabMenuSub}>{item.sub}</Text>
            </TouchableOpacity>
          ))}
        </GlassView>
      )}
      <View style={styles.fabWrap}>
        <BlurView style={StyleSheet.absoluteFill} blurType="dark" blurAmount={10} />
        <TouchableOpacity style={styles.fabInner} onPress={() => setFabOpen(v => !v)}>
          <Text style={styles.fabIcon}>{fabOpen ? '✕' : '+'}</Text>
        </TouchableOpacity>
      </View>

      {/* bottom nav */}
      <View style={styles.bottomNavWrap}>
        <View style={styles.bottomNav}>
          <BlurView style={StyleSheet.absoluteFill} blurType="dark" blurAmount={16} />
          {['Status', 'Chats', 'Requests'].map(label => {
            const isActive = activeTab === label;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.navTab, isActive && styles.navTabActive]}
                onPress={() => {
                  setActiveTab(label);
                  if (label === 'Status') navigation.navigate('Status');
                  if (label === 'Requests') navigation.navigate('Requests');
                }}
              >
                <Text style={[styles.navText, isActive && styles.navTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* long press action sheet */}
      <Modal visible={!!longPressChat} transparent animationType="fade" onRequestClose={() => setLongPressChat(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setLongPressChat(null)}>
          <GlassView style={styles.sheet} blurAmount={24}>
            {longPressChat && (
              <View style={styles.sheetHeader}>
                <Avatar name={longPressChat.name} color={longPressChat.color} size={36} />
                <Text style={styles.sheetHeaderText}>{longPressChat.name}</Text>
              </View>
            )}
            {sheetActionsFor(longPressChat).map(a => (
              <TouchableOpacity key={a.key} style={styles.sheetItem} onPress={() => handleSheetAction(a.key)}>
                <Text style={[styles.sheetItemText, a.danger && { color: '#ef4444' }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </GlassView>
        </Pressable>
      </Modal>

      {/* color picker */}
      <Modal visible={!!colorPickerChat} transparent animationType="fade" onRequestClose={() => setColorPickerChat(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setColorPickerChat(null)}>
          <GlassView style={styles.colorSheet} blurAmount={24}>
            <Text style={styles.sheetHeaderText}>Choose a color</Text>
            <View style={styles.colorGrid}>
              {COLOR_PRESETS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c }]}
                  onPress={() => {
                    updateMeta(colorPickerChat.id, { color: c });
                    setColorPickerChat(null);
                  }}
                />
              ))}
            </View>
          </GlassView>
        </Pressable>
      </Modal>

      {/* top bar background picker */}
      <Modal visible={topBarPickerOpen} transparent animationType="fade" onRequestClose={() => setTopBarPickerOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setTopBarPickerOpen(false)}>
          <GlassView style={styles.colorSheet} blurAmount={24}>
            <Text style={styles.sheetHeaderText}>Top bar background</Text>
            <TouchableOpacity style={styles.topBarOptionBtn} onPress={pickTopBarPhoto}>
              <Text style={styles.topBarOptionText}>Choose a photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBarOptionBtn} onPress={pickTopBarVideo}>
              <Text style={styles.topBarOptionText}>Choose a video</Text>
            </TouchableOpacity>
            <View style={styles.colorGrid}>
              {COLOR_PRESETS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c }]}
                  onPress={() => saveTopBarBg({ type: 'color', value: c })}
                />
              ))}
            </View>
            {topBarBg && (
              <TouchableOpacity style={styles.topBarOptionBtn} onPress={() => saveTopBarBg(null)}>
                <Text style={[styles.topBarOptionText, { color: '#ef4444' }]}>Reset to default</Text>
              </TouchableOpacity>
            )}
          </GlassView>
        </Pressable>
      </Modal>

      {/* per-chat PIN prompt */}
      <Modal visible={!!pinPrompt} transparent animationType="fade" onRequestClose={() => setPinPrompt(null)}>
        <Pressable style={styles.profileBackdrop} onPress={() => setPinPrompt(null)}>
          <BlurView style={StyleSheet.absoluteFill} blurType="dark" blurAmount={20} />
          <View style={styles.pinCard}>
            <Text style={styles.pinTitle}>Locked chat</Text>
            <Text style={styles.pinSubtitle}>Enter your PIN to open {pinPrompt?.name}</Text>
            <View style={styles.dotsRow}>
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <View key={i} style={[styles.dot, i < pinEntry.length && styles.dotFilled, pinError && styles.dotError]} />
              ))}
            </View>
            <View style={styles.keypad}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((k, i) => (
                <TouchableOpacity key={i} style={styles.key} disabled={k === ''} onPress={() => handlePinKey(k)}>
                  <Text style={styles.keyText}>{k === 'del' ? '⌫' : k}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* profile popup */}
      <Modal visible={!!profileChat} transparent animationType="fade" onRequestClose={() => setProfileChat(null)}>
        <Pressable style={styles.profileBackdrop} onPress={() => setProfileChat(null)}>
          <BlurView style={StyleSheet.absoluteFill} blurType="dark" blurAmount={20} />
          {profileChat && (
            <View style={styles.profileContent}>
              <Text style={styles.profileName}>{profileChat.name}</Text>
              <View style={[styles.profileImage, { backgroundColor: profileChat.color }]}>
                <Text style={styles.profileImageText}>{profileChat.name[0].toUpperCase()}</Text>
              </View>
              <Text style={styles.profileHint}>Info · Call · Change Ring · Online</Text>
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff' },
  glassTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.35)' },
  topBarWrap: { overflow: 'hidden', borderBottomLeftRadius: 22, borderBottomRightRadius: 22, minHeight: 96 },
  topBarInner: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, paddingBottom: 16 },
  username: { color: 'white', fontSize: 19, fontWeight: '800' },
  pointsText: { color: 'rgba(255,255,255,0.85)', fontSize: 11.5, marginTop: 2, fontWeight: '600' },
  progressTrack: { width: 130, height: 5, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, marginTop: 5 },
  progressFill: { height: '100%', backgroundColor: '#fbbf24', borderRadius: 3 },
  ringOuter: { position: 'absolute', borderWidth: 2 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  verifiedBadge: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },
  achievementWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  achievementEmoji: { fontSize: 30 },
  achievementText: { color: 'white', fontWeight: '800', fontSize: 15, marginTop: 4 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20 },
  bannerDot: { width: 8, height: 8, borderRadius: 4 },
  bannerTitle: { color: 'white', fontSize: 14, fontWeight: '700' },
  bannerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 11.5, marginTop: 1 },
  searchOuter: { marginHorizontal: 20, marginTop: 14, marginBottom: 10, borderRadius: 14 },
  searchBar: { borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  searchPlaceholder: { color: '#6b6b7a', fontSize: 14.5 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 100, paddingHorizontal: 40 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#0f0f1a' },
  emptySubtext: { fontSize: 13, color: '#9ca3af', marginTop: 6, textAlign: 'center' },
  folderRow: { maxHeight: 40, marginBottom: 6 },
  folderPill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', justifyContent: 'center' },
  folderPillActive: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(15,15,26,0.9)', justifyContent: 'center' },
  folderText: { fontSize: 12, fontWeight: '700', color: '#6b6b7a' },
  folderTextActive: { fontSize: 12, fontWeight: '700', color: 'white' },
  archivedToggle: { paddingHorizontal: 20, paddingBottom: 8 },
  archivedToggleText: { fontSize: 12, fontWeight: '700', color: '#4f46e5' },
  chatRow: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f0f0f3' },
  swipeBgWrap: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  swipeBgLeft: { flex: 1, backgroundColor: '#16a34a', justifyContent: 'center', paddingHorizontal: 22 },
  swipeBgRight: { flex: 1, backgroundColor: '#f59e0b', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 22 },
  swipeBgText: { color: 'white', fontWeight: '700', fontSize: 12.5 },
  pinIcon: { fontSize: 11 },
  chatName: { fontSize: 15, fontWeight: '700', color: '#0f0f1a', flexShrink: 1 },
  chatPreview: { color: '#8b8b9a', fontSize: 12.5, marginTop: 2 },
  missedCall: { color: '#ef4444', fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  chatTime: { color: '#9ca3af', fontSize: 11.5 },
  unreadBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#0f0f1a', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  unreadText: { color: 'white', fontSize: 11, fontWeight: '700' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4f46e5', marginTop: 8 },
  fabWrap: { position: 'absolute', bottom: 86, right: 20, width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
  fabInner: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,15,26,0.6)' },
  fabIcon: { color: 'white', fontSize: 24 },
  fabMenu: { position: 'absolute', bottom: 150, right: 20, borderRadius: 16, width: 220, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  fabMenuItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)' },
  fabMenuLabel: { fontSize: 13.5, fontWeight: '600', color: '#0f0f1a' },
  fabMenuSub: { fontSize: 10.5, color: '#6b6b7a', marginTop: 2 },
  bottomNavWrap: { alignItems: 'center', paddingBottom: 18, paddingTop: 6 },
  bottomNav: { flexDirection: 'row', borderRadius: 28, padding: 6, gap: 4, overflow: 'hidden' },
  navTab: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 22 },
  navTabActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  navText: { color: 'white', fontSize: 12.5, fontWeight: '700' },
  navTextActive: { fontSize: 13.5 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderBottomWidth: 0 },
  colorSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 20, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderBottomWidth: 0 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  colorSwatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)' },
  sheetHeaderText: { fontWeight: '700', fontSize: 15 },
  topBarOptionBtn: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)' },
  topBarOptionText: { fontSize: 14, fontWeight: '600', color: '#0f0f1a' },
  sheetItem: { paddingVertical: 13, paddingHorizontal: 20 },
  sheetItemText: { fontSize: 14.5, color: '#0f0f1a' },
  profileBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  profileContent: { alignItems: 'center', gap: 16 },
  profileName: { color: 'white', fontSize: 16, fontWeight: '700' },
  profileImage: { width: 220, height: 220, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  profileImageText: { color: 'white', fontSize: 64, fontWeight: '700' },
  profileHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  pinCard: { backgroundColor: '#1e1b3a', borderRadius: 24, padding: 28, alignItems: 'center', width: '85%', maxWidth: 320 },
  pinTitle: { color: 'white', fontSize: 17, fontWeight: '800' },
  pinSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12.5, marginTop: 4, marginBottom: 22, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 14, marginBottom: 26 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  dotFilled: { backgroundColor: 'white', borderColor: 'white' },
  dotError: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 230, justifyContent: 'space-between' },
  key: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  keyText: { color: 'white', fontSize: 22, fontWeight: '600' },
});
