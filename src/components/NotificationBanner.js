import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useNavigation } from '@react-navigation/native';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationBanner() {
  const { banner, slideAnim, dismissBanner } = useNotifications();
  const navigation = useNavigation();

  if (!banner) return null;

  function handlePress() {
    dismissBanner();
    if (banner.onPress) banner.onPress(navigation);
  }

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
        <View style={styles.glassOuter}>
          <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={22} />
          <View style={styles.tint} />
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: banner.type === 'online' ? '#22c55e' : '#4f46e5' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{banner.title}</Text>
              {banner.subtitle && <Text style={styles.subtitle} numberOfLines={1}>{banner.subtitle}</Text>}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 40, left: 14, right: 14, zIndex: 999 },
  glassOuter: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.55)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 13.5, fontWeight: '700', color: '#0f0f1a' },
  subtitle: { fontSize: 11.5, color: '#6b6b7a', marginTop: 1 },
});
