import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { ChevronLeft, Check } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const TIERS = [
  { key: 'bronze', label: 'Bronze', color: '#b45309', min: 0 },
  { key: 'silver', label: 'Silver', color: '#94a3b8', min: 100 },
  { key: 'gold', label: 'Gold', color: '#f59e0b', min: 300 },
  { key: 'platinum', label: 'Platinum', color: '#818cf8', min: 700 },
];

function GlassCard({ style, children, blurAmount = 18, tint = 0.35 }) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={blurAmount} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(255,255,255,${tint})` }]} />
      {children}
    </View>
  );
}

function currentTierIndex(points) {
  let idx = 0;
  TIERS.forEach((t, i) => { if (points >= t.min) idx = i; });
  return idx;
}

export default function PointsScreen() {
  const navigation = useNavigation();
  const { user, apiRequest } = useAuth();
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(user?.points ?? 0);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [moreTasks, setMoreTasks] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest('/points/tasks');
        setPoints(data?.points ?? points);
        setCompletedTasks(data?.completed || []);
        setMoreTasks(data?.available || []);
      } catch (e) {
        // backend not ready yet — screen still renders with what we have
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tierIdx = currentTierIndex(points);
  const currentTier = TIERS[tierIdx];
  const nextTier = TIERS[tierIdx + 1];
  const pct = nextTier
    ? Math.min(100, ((points - currentTier.min) / (nextTier.min - currentTier.min)) * 100)
    : 100;

  const groupedTasks = moreTasks.reduce((acc, t) => {
    const cat = t.category || 'General';
    acc[cat] = acc[cat] || [];
    acc[cat].push(t);
    return acc;
  }, {});

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 14 }}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrap}>
          <ChevronLeft size={20} color="#0f0f1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Points & Level</Text>
      </View>

      {/* profile picture + progress */}
      <GlassCard style={styles.profileCard}>
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: currentTier.color }]}>
            <Text style={styles.avatarText}>{user?.username?.[0]?.toUpperCase() || '?'}</Text>
          </View>
        )}
        <Text style={styles.username}>{user?.username || 'you'}</Text>
        <Text style={styles.tierLabel}>{currentTier.label} Tier</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: currentTier.color }]} />
        </View>
        <Text style={styles.pointsText}>
          {points} pts{nextTier ? ` · ${nextTier.min - points} to ${nextTier.label}` : ' · Max tier reached'}
        </Text>

        {/* tier ladder */}
        <View style={styles.tierLadder}>
          {TIERS.map((t, i) => (
            <View key={t.key} style={styles.tierStep}>
              <View style={[
                styles.tierDot,
                { backgroundColor: i <= tierIdx ? t.color : '#e5e7eb' },
              ]} />
              <Text style={[styles.tierStepLabel, i <= tierIdx && { color: t.color, fontWeight: '700' }]}>
                {t.label}
              </Text>
            </View>
          ))}
        </View>
      </GlassCard>

      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}

      {!loading && completedTasks.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.sectionTitle}>Completed</Text>
          <GlassCard style={{ padding: 0 }}>
            {completedTasks.map((t, i) => (
              <View key={t.id || i} style={[styles.taskRow, i < completedTasks.length - 1 && styles.rowBorder]}>
                <View style={styles.checkCircle}>
                  <Check size={12} color="white" />
                </View>
                <Text style={[styles.taskLabel, { textDecorationLine: 'line-through', color: '#9ca3af' }]}>
                  {t.label}
                </Text>
                <Text style={styles.taskPoints}>+{t.points}</Text>
              </View>
            ))}
          </GlassCard>
        </View>
      )}

      {!loading && Object.keys(groupedTasks).map(category => (
        <View key={category} style={{ marginTop: 16 }}>
          <Text style={styles.sectionTitle}>{category}</Text>
          <GlassCard style={{ padding: 0 }}>
            {groupedTasks[category].map((t, i) => (
              <View key={t.id || i} style={[styles.taskRow, i < groupedTasks[category].length - 1 && styles.rowBorder]}>
                <View style={styles.emptyCircle} />
                <Text style={styles.taskLabel}>{t.label}</Text>
                <Text style={styles.taskPoints}>+{t.points}</Text>
              </View>
            ))}
          </GlassCard>
        </View>
      ))}

      {!loading && completedTasks.length === 0 && moreTasks.length === 0 && (
        <Text style={styles.emptyText}>Tasks will show up here once they're set up.</Text>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff' },
  glassWrap: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  backBtnWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0f0f1a' },
  profileCard: { padding: 22, alignItems: 'center', gap: 6 },
  avatarImg: { width: 76, height: 76, borderRadius: 38 },
  avatarFallback: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: 28, fontWeight: '700' },
  username: { fontSize: 16.5, fontWeight: '800', color: '#0f0f1a', marginTop: 6 },
  tierLabel: { fontSize: 12, color: '#6b6b7a', fontWeight: '700', marginBottom: 8 },
  progressTrack: { width: '100%', height: 8, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 4, marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 4 },
  pointsText: { fontSize: 12, color: '#6b6b7a', marginTop: 6 },
  tierLadder: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 },
  tierStep: { alignItems: 'center', gap: 4 },
  tierDot: { width: 14, height: 14, borderRadius: 7 },
  tierStepLabel: { fontSize: 10.5, color: '#9ca3af' },
  sectionTitle: { fontSize: 11.5, fontWeight: '700', color: '#6b6b7a', textTransform: 'uppercase', marginBottom: 6, marginLeft: 4 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)' },
  checkCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' },
  emptyCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#d1d5db' },
  taskLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#0f0f1a' },
  taskPoints: { fontSize: 12.5, fontWeight: '700', color: '#4f46e5' },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 30, fontSize: 13 },
});
