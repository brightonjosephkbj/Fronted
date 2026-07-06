import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';

function verifiedColor(tick) {
  if (tick === 'cyan') return '#06b6d4';
  if (tick === 'blue') return '#3b82f6';
  return '#a855f7'; // purple default
}

export default function Avatar({ uri, letter, size = 76, verified, fallbackColor = '#4f46e5' }) {
  const badgeSize = Math.max(16, Math.round(size * 0.28));
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: fallbackColor }]}>
          <Text style={[styles.letter, { fontSize: size * 0.37 }]}>{letter?.toUpperCase() || '?'}</Text>
        </View>
      )}
      {verified && (
        <View style={[
          styles.badge,
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

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: 'white', fontWeight: '700' },
  badge: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#ffffff',
  },
});
