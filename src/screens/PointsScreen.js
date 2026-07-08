import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, CheckCircle2, Circle } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

function GlassCard({ style, children, blurAmount = 18, tint = 0.35 }) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={blurAmount} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(255,255,255,${tint})` }]} />
      {children}
    </View>
  );
}

const TIERS = [
  { key: 'bronze', label: 'Bronze', min: 0, color: '#b45309' },
  { key: 'silver', label: 'Silver', min: 100, color: '#64748b' },
  { key: 'gold', label: 'Gold', min: 300, color: '#ca8a04' },
  { key: 'platinum', label: 'Platinum', min: 700, color: '#7c3aed' },
];

function getTierInfo(points) {
  let current = TIERS[0];
  let next = TIERS[1];
  for (let i = 0; i < TIERS.length; i++) {
    if (points >= TIERS[i].min) {
      current = TIERS[i];
      next = TIERS[i + 1] || null;
    }
  }
  const progress = next ? (points - current.min) / (next.min - current.min) : 1;
  return { current, next, progress: Math.max(0, Math.min(1, progress)) };
}

function groupByCategory(tasks) {
  const groups = {};
  for (const t of tasks) {
    const cat = t.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
  }
  return Object.entries(groups);
}

export default function PointsScreen() {
  const navigation = useNavigation();
  const { apiRequest, user, updateUserPoints } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [points, setPoints] = useState(user?.points ?? 0);
  const [completed, setCompleted] = useState([]);
  const [available, setAvailable] = useState([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest('/points/tasks');
      setPoints(res.points ?? 0);
      setCompleted(res.completed || []);
      setAvailable(res.available || []);
      setFailed(false);
      if (updateUserPoints) updateUserPoints(res.points ?? 0);
    } catch (e) {
      setFailed(true);
    }
  }, [apiRequest, updateUserPoints]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const { current, next, progress } = getTierInfo(points);
  const availableByCategory = groupByCategory(available);

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrap}>
          <BlurView style={StyleSheet.absoluteFill} blurType="light" blurAmount={14} />
          <Text style={styles.back}><ChevronLeft size={22} color="#0f0f1a" /></Text>
        </TouchableOpacity>
        <Text style={styles.title}>Points</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingTop: 6 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <GlassCard style={styles.tierCard}>
          <Text style={styles.pointsValue}>{points}</Text>
          <Text style={styles.pointsLabel}>points</Text>
          <View style={styles.tierRow}>
            <View style={[styles.tierDot, { backgroundColor: current.color }]} />
            <Text style={styles.tierName}>{current.label}</Text>
            {next && <Text style={styles.tierNext}>  ·  {next.min - points} to {next.label}</Text>}
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: current.color }]} />
          </View>
        </GlassCard>

        {loading && <ActivityIndicator style={{ marginTop: 20 }} />}

        {!loading && failed && (
          <GlassCard style={styles.errorCard}>
            <Text style={styles.errorText}>Couldn't load your tasks right now. Pull down to try again.</Text>
          </GlassCard>
        )}

        {!loading && !failed && (
          <>
            {completed.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Completed</Text>
                <GlassCard style={{ padding: 0 }}>
                  {completed.map((t, i) => (
                    <View key={t.id} style={[styles.row, i < completed.length - 1 && styles.rowBorder]}>
                      <CheckCircle2 size={18} color="#22c55e" />
                      <Text style={[styles.rowLabel, { marginLeft: 10 }]}>{t.label}</Text>
                      <Text style={styles.rowPoints}>+{t.points}</Text>
                    </View>
                  ))}
                </GlassCard>
              </>
            )}

            {availableByCategory.map(([category, tasks]) => (
              <View key={category}>
                <Text style={styles.sectionTitle}>{category}</Text>
                <GlassCard style={{ padding: 0 }}>
                  {tasks.map((t, i) => (
                    <View key={t.id} style={[styles.row, i < tasks.length - 1 && styles.rowBorder]}>
                      <Circle size={18} color="#c4c4cc" />
                      <Text style={[styles.rowLabel, { marginLeft: 10, color: '#6b6b7a' }]}>{t.label}</Text>
                      <Text style={[styles.rowPoints, { color: '#9ca3af' }]}>+{t.points}</Text>
                    </View>
                  ))}
                </GlassCard>
              </View>
            ))}

            {completed.length === 0 && available.length === 0 && (
              <Text style={styles.emptyText}>No tasks yet — check back soon.</Text>
            )}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2ff' },
  glassWrap: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingTop: 18 },
  backBtnWrap: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  back: { fontSize: 22, color: '#0f0f1a' },
  title: { fontSize: 16, fontWeight: '700', color: '#0f0f1a' },
  tierCard: { padding: 22, alignItems: 'center', marginBottom: 8 },
  pointsValue: { fontSize: 38, fontWeight: '800', color: '#0f0f1a' },
  pointsLabel: { fontSize: 12, color: '#6b6b7a', marginTop: -4, marginBottom: 10 },
  tierRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  tierDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  tierName: { fontSize: 13, fontWeight: '700', color: '#0f0f1a' },
  tierNext: { fontSize: 12, color: '#9ca3af' },
  progressTrack: { width: '100%', height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  errorCard: { padding: 16 },
  errorText: { fontSize: 13, color: '#6b6b7a', textAlign: 'center' },
  sectionTitle: { fontSize: 11.5, fontWeight: '700', color: '#6b6b7a', textTransform: 'uppercase', marginTop: 16, marginBottom: 6, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)' },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#0f0f1a', flex: 1 },
  rowPoints: { fontSize: 13, fontWeight: '700', color: '#22c55e' },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 13 },
});
