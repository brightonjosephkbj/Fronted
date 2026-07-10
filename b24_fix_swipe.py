#!/usr/bin/env python3
import os, sys

root = os.getcwd()
main_path = os.path.join(root, "src", "screens", "MainScreen.js")
app_path = os.path.join(root, "App.js")
if not os.path.isfile(main_path) or not os.path.isfile(app_path):
    print("[!] Could not find src/screens/MainScreen.js or App.js")
    print("    cd into your project root (the folder with src/ and App.js) and run again.")
    sys.exit(1)

FILES = {}

# ---- App.js: wire up GestureHandlerRootView ----
FILES[app_path] = [
    (
"""
if (!__DEV__) {""",
"""import 'react-native-gesture-handler';

if (!__DEV__) {"""
    ),
    (
"""import { NavigationContainer } from '@react-navigation/native';""",
"""import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';"""
    ),
    (
"""export default function App() {
  return (
    <AuthProvider>
      <FontPrefsProvider>
      <NotificationProvider>
      <SocketProvider>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
      </SocketProvider>
    </NotificationProvider>
      </FontPrefsProvider>
    </AuthProvider>
  );
}""",
"""export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AuthProvider>
      <FontPrefsProvider>
      <NotificationProvider>
      <SocketProvider>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
      </SocketProvider>
    </NotificationProvider>
      </FontPrefsProvider>
    </AuthProvider>
    </GestureHandlerRootView>
  );
}"""
    ),
]

# ---- MainScreen.js: replace PanResponder swipe with react-native-gesture-handler Swipeable ----
FILES[main_path] = [
    (
"""import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useNavigation } from '@react-navigation/native';""",
"""import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useNavigation } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';"""
    ),
    (
"""function ChatRow({ chat, onPress, onLongPress, onOpenProfile, onArchive, onMute }) {
  const translateX = useState(new Animated.Value(0))[0];
  const SWIPE_THRESHOLD = 60;
  const swipeBgOpacity = translateX.interpolate({
    inputRange: [-90, -12, 0, 12, 90],
    outputRange: [1, 0, 0, 0, 1],
    extrapolate: 'clamp',
  });
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
      <Animated.View style={[styles.swipeBgWrap, { opacity: swipeBgOpacity }]} pointerEvents="none">
        <View style={styles.swipeBgLeft}><Text style={styles.swipeBgText}>Archive</Text></View>
        <View style={styles.swipeBgRight}><Text style={styles.swipeBgText}>{chat.muted ? 'Unmute' : 'Mute'}</Text></View>
      </Animated.View>
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }], backgroundColor: '#fff' }}>
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
}""",
"""function ChatRow({ chat, onPress, onLongPress, onOpenProfile, onArchive, onMute }) {
  const swipeableRef = useRef(null);

  const renderLeftActions = (progress, dragX) => {
    const trans = dragX.interpolate({ inputRange: [0, 90], outputRange: [-30, 0], extrapolate: 'clamp' });
    return (
      <View style={styles.swipeBgLeft}>
        <Animated.Text style={[styles.swipeBgText, { transform: [{ translateX: trans }] }]}>Archive</Animated.Text>
      </View>
    );
  };
  const renderRightActions = (progress, dragX) => {
    const trans = dragX.interpolate({ inputRange: [-90, 0], outputRange: [0, 30], extrapolate: 'clamp' });
    return (
      <View style={styles.swipeBgRight}>
        <Animated.Text style={[styles.swipeBgText, { transform: [{ translateX: trans }] }]}>{chat.muted ? 'Unmute' : 'Mute'}</Animated.Text>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      leftThreshold={60}
      rightThreshold={60}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') onArchive && onArchive(chat);
        else if (direction === 'right') onMute && onMute(chat);
        swipeableRef.current?.close();
      }}
    >
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
    </Swipeable>
  );
}"""
    ),
    (
"""  swipeBgWrap: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  swipeBgLeft: { flex: 1, backgroundColor: '#16a34a', justifyContent: 'center', paddingHorizontal: 22 },
  swipeBgRight: { flex: 1, backgroundColor: '#f59e0b', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 22 },""",
"""  swipeBgLeft: { width: 90, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center' },
  swipeBgRight: { width: 90, backgroundColor: '#f59e0b', justifyContent: 'center', alignItems: 'center' },"""
    ),
]

ok, failed = 0, 0
for full, patches in FILES.items():
    rel = os.path.relpath(full, root)
    with open(full, "r", encoding="utf-8") as fh:
        src = fh.read()
    original = src
    for old, new in patches:
        count = src.count(old)
        if count != 1:
            print(f"[!] {rel}: expected 1 match, found {count} - skipping this hunk")
            continue
        src = src.replace(old, new, 1)
    if src == original:
        print(f"[=] {rel}: nothing changed")
        continue
    with open(full + ".bak", "w", encoding="utf-8") as fh:
        fh.write(original)
    with open(full, "w", encoding="utf-8") as fh:
        fh.write(src)
    print(f"[+] Patched {rel} (backup: {rel}.bak)")
    ok += 1

print()
print(f"Done. {ok} file(s) patched.")
if failed:
    print(f"{failed} file(s) missing - check your folder structure.")
