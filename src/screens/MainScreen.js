import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Image,
  Modal, Pressable, PanResponder, Animated, ScrollView,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
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

const LONG_PRESS_ACTIONS = [
  { key: 'pin', label: 'Pin chat' },
  { key: 'mute', label: 'Mute notifications' },
  { key: 'unread', label: 'Mark as unread' },
  { key: 'favourite', label: 'Mark as favourite' },
  { key: 'color', label: 'Change chat color' },
  { key: 'archive', label: 'Archive chat' },
  { key: 'lock', label: 'Lock this chat' },
  { key: 'clear', label: 'Clear chat' },
  { key: 'export', label: 'Export chat' },
  { key: 'block', label: 'Block contact' },
  { key: 'delete', label: 'Delete chat', danger: true },
];

const MOCK_CHATS = [
  { id: '1', name: 'Joy', preview: 'yeah give me a sec', time: '19:23', unread: 1, color: '#9333ea', category: 'all', isGroup: false },
  { id: '2', name: 'SafeBoda', preview: 'Your ride is arriving in 3 minutes', time: '10:17', unread: 3, color: '#0ea5a4', category: 'business', isGroup: false },
  { id: '3', name: 'Derrick', preview: '', time: 'Yesterday', missedCall: true, color: '#f97316', category: 'all', isGroup: false },
  { id: '4', name: 'B24 Builders', preview: 'Derrick: pushed the new build', time: 'Yesterday', color: '#4f46e5', category: 'groups', isGroup: true },
];

function resolveBackground(bg) {
  if (bg?.type === 'photo' && bg.value) return { type: 'photo', value: bg.value };
  if (bg?.type === 'video' && bg.value) return { type: 'video', value: bg.value };
  return { type: 'color', value: bg?.value || '#4f46e5' };
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

function ChatRow({ chat, onPress, onLongPress, onOpenProfile }) {
  const translateX = useState(new Animated.Value(0))[0];
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
    onPanResponderMove: (_, g) => translateX.setValue(Math.max(-90, Math.min(90, g.dx))),
    onPanResponderRelease: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(),
  });

  return (
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
          <Text style={styles.chatName}>{chat.name}</Text>
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
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
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
  const { banner, slideAnim, setActiveChatId } = useNotifications();
  const navigation = useNavigation();
  const [chats, setChats] = useState(MOCK_CHATS);
  const [folder, setFolder] = useState('All');
  const [fabOpen, setFabOpen] = useState(false);
  const [longPressChat, setLongPressChat] = useState(null);
  const [profileChat, setProfileChat] = useState(null);
  const [activeTab, setActiveTab] = useState('Chats');
  const [celebrating, setCelebrating] = useState(false);

  const points = user?.points ?? 30;
  const pointsTarget = user?.pointsTarget ?? 100;
  const level = user?.level ?? 3;
  const pct = Math.min(100, (points / pointsTarget) * 100);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const prevPointsRef = useRef(points);

  // Not viewing any specific chat while on MainScreen
  useEffect(() => {
    setActiveChatId(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest('/chats');
        if (Array.isArray(data?.chats)) setChats(data.chats);
      } catch (e) {}
    })();
  }, []);

  // Detect points hitting/crossing the target -> trigger shake + fireworks
  useEffect(() => {
    if (prevPointsRef.current < pointsTarget && points >= pointsTarget) {
      triggerCelebration();
    }
    prevPointsRef.current = points;
  }, [points, pointsTarget]);

  function triggerCelebration() {
    setCelebrating(true);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setCelebrating(false), 10000);
  }

  const visibleChats = folder === 'All' ? chats : chats.filter(c => c.category === folder.toLowerCase());

  const openChat = useCallback((chat) => {
    navigation.navigate(chat.isGroup ? 'GroupChatDetail' : 'ChatDetail', { chat });
  }, [navigation]);

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

  return (
    <View style={styles.screen}>
      {/* top bar */}
      <Animated.View style={[styles.topBarWrap, { transform: [{ translateX: shakeAnim }] }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: resolveBackground(user?.topBar).value }]} />
        <BlurView style={StyleSheet.absoluteFill} blurType="dark" blurAmount={12} />

        {!celebrating && !banner && (
          <TouchableOpacity activeOpacity={0.9} onLongPress={() => {}} style={styles.topBarInner}>
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
            <View style={[styles.bannerDot, { backgroundColor: banner.type === 'online' ? '#22c55e' : '#4f46e5' }]} />
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

      {/* chat list */}
      <FlatList
        data={visibleChats}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ChatRow chat={item} onPress={openChat} onLongPress={setLongPressChat} onOpenProfile={setProfileChat} />
        )}
        style={{ flex: 1 }}
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
            {LONG_PRESS_ACTIONS.map(a => (
              <TouchableOpacity key={a.key} style={styles.sheetItem} onPress={() => setLongPressChat(null)}>
                <Text style={[styles.sheetItemText, a.danger && { color: '#ef4444' }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </GlassView>
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
  folderRow: { maxHeight: 40, marginBottom: 10 },
  folderPill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', justifyContent: 'center' },
  folderPillActive: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(15,15,26,0.9)', justifyContent: 'center' },
  folderText: { fontSize: 12, fontWeight: '700', color: '#6b6b7a' },
  folderTextActive: { fontSize: 12, fontWeight: '700', color: 'white' },
  chatRow: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f0f0f3' },
  chatName: { fontSize: 15, fontWeight: '700', color: '#0f0f1a' },
  chatPreview: { color: '#8b8b9a', fontSize: 12.5, marginTop: 2 },
  missedCall: { color: '#ef4444', fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  chatTime: { color: '#9ca3af', fontSize: 11.5 },
  unreadBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#0f0f1a', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  unreadText: { color: 'white', fontSize: 11, fontWeight: '700' },
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
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)' },
  sheetHeaderText: { fontWeight: '700', fontSize: 15 },
  sheetItem: { paddingVertical: 13, paddingHorizontal: 20 },
  sheetItemText: { fontSize: 14.5, color: '#0f0f1a' },
  profileBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  profileContent: { alignItems: 'center', gap: 16 },
  profileName: { color: 'white', fontSize: 16, fontWeight: '700' },
  profileImage: { width: 220, height: 220, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  profileImageText: { color: 'white', fontSize: 64, fontWeight: '700' },
  profileHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
});
