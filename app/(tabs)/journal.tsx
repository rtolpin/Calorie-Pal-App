import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { useExerciseLogStore } from '../../store/exerciseLogStore';
import { FoodLogCard } from '../../components/FoodLogCard';
import { ExerciseLogCard } from '../../components/ExerciseLogCard';
import { GuestBanner } from '../../components/GuestBanner';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { getWaterCups, getWaterGoal, getMood, Mood } from '../../lib/asyncStorage';
import { toLocalDateStr } from '../../lib/dateUtils';
import { FoodLog, ExerciseLog } from '../../types';
import { Colors } from '../../constants/Colors';

const MOOD_META: Record<Mood, { emoji: string; label: string }> = {
  great: { emoji: '😄', label: 'Great' },
  good: { emoji: '😊', label: 'Good' },
  okay: { emoji: '😐', label: 'Okay' },
  low: { emoji: '😞', label: 'Low' },
  stressed: { emoji: '😤', label: 'Stressed' },
  tired: { emoji: '😴', label: 'Tired' },
};

interface DailyWellness {
  waterCups: number;
  waterGoal: number;
  mood: Mood | null;
}

type Filter = 'today' | 'week' | 'month' | 'all';
type EntryType = 'all' | 'food' | 'exercise';
type JournalEntry =
  | { type: 'food'; data: FoodLog }
  | { type: 'exercise'; data: ExerciseLog };

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = toLocalDateStr(new Date());
  const yesterday = toLocalDateStr(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function JournalScreen() {
  const { session, isGuest } = useAuthStore();
  const { logs, isLoading: foodLoading, fetchLogs, deleteLog } = useFoodLogStore();
  const { exerciseLogs, isLoading: exerciseLoading, fetchExerciseLogs, deleteExerciseLog } = useExerciseLogStore();
  const { isOnline } = useNetworkStatus();

  const [filter, setFilter] = useState<Filter>('today');
  const [entryType, setEntryType] = useState<EntryType>('all');
  const [search, setSearch] = useState('');
  const [wellnessMap, setWellnessMap] = useState<Record<string, DailyWellness>>({});
  const [waterGoalVal, setWaterGoalVal] = useState(8);

  const isLoading = foodLoading || exerciseLoading;

  useFocusEffect(
    useCallback(() => {
      fetchLogs(session?.user.id, isGuest);
      fetchExerciseLogs(session?.user.id, isGuest);
      getWaterGoal().then(setWaterGoalVal);
    }, [session?.user.id, isGuest])
  );

  const filterByDate = <T extends { logged_at: string }>(items: T[]): T[] => {
    const now = new Date();
    if (filter === 'today') {
      const today = toLocalDateStr(now);
      return items.filter((l) => toLocalDateStr(new Date(l.logged_at)) === today);
    }
    if (filter === 'week') {
      const cutoff = new Date(now.getTime() - 7 * 86400000);
      return items.filter((l) => new Date(l.logged_at) >= cutoff);
    }
    if (filter === 'month') {
      const cutoff = new Date(now.getTime() - 30 * 86400000);
      return items.filter((l) => new Date(l.logged_at) >= cutoff);
    }
    return items;
  };

  const allEntries = useMemo((): JournalEntry[] => {
    const q = search.trim().toLowerCase();

    let foodEntries: JournalEntry[] = filterByDate(logs)
      .filter((l) =>
        !q ||
        l.meal_name.toLowerCase().includes(q) ||
        l.foods_detected.some((f) => f.toLowerCase().includes(q))
      )
      .map((d) => ({ type: 'food' as const, data: d }));

    let exerciseEntries: JournalEntry[] = filterByDate(exerciseLogs)
      .filter((l) => !q || l.exercise_name.toLowerCase().includes(q))
      .map((d) => ({ type: 'exercise' as const, data: d }));

    if (entryType === 'food') exerciseEntries = [];
    if (entryType === 'exercise') foodEntries = [];

    return [...foodEntries, ...exerciseEntries].sort(
      (a, b) => new Date(b.data.logged_at).getTime() - new Date(a.data.logged_at).getTime()
    );
  }, [logs, exerciseLogs, filter, entryType, search]);

  // Group by date
  const grouped = useMemo(() => {
    const map: Record<string, JournalEntry[]> = {};
    allEntries.forEach((entry) => {
      const date = toLocalDateStr(new Date(entry.data.logged_at));
      if (!map[date]) map[date] = [];
      map[date].push(entry);
    });
    return map;
  }, [allEntries]);

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Load water + mood for every visible date whenever the date list changes
  useEffect(() => {
    if (sortedDates.length === 0) return;
    let cancelled = false;
    const goal = waterGoalVal;
    Promise.all(
      sortedDates.map(async (date) => {
        const [cups, mood] = await Promise.all([getWaterCups(date), getMood(date)]);
        return { date, cups, mood };
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, DailyWellness> = {};
      results.forEach(({ date, cups, mood }) => {
        map[date] = { waterCups: cups, waterGoal: goal, mood };
      });
      setWellnessMap(map);
    });
    return () => { cancelled = true; };
  }, [sortedDates.join(','), waterGoalVal]);

  const handleDeleteFood = (id: string) => deleteLog(id, session?.user.id, isGuest);
  const handleDeleteExercise = (id: string) => deleteExerciseLog(id, session?.user.id, isGuest);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'all', label: 'All Time' },
  ];

  const TYPE_FILTERS: { key: EntryType; label: string; emoji: string }[] = [
    { key: 'all', label: 'All', emoji: '📋' },
    { key: 'food', label: 'Meals', emoji: '🍽️' },
    { key: 'exercise', label: 'Exercise', emoji: '🏃' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {isGuest && <GuestBanner />}
      {!isOnline && <OfflineBanner />}

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>📓 Journal</Text>
          <TouchableOpacity
            style={styles.addExerciseBtn}
            onPress={() => router.push('/log-exercise')}
          >
            <Ionicons name="fitness-outline" size={18} color={Colors.secondary} />
            <Text style={styles.addExerciseText}>Log Exercise</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search meals & exercises..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textLight} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Date filter */}
        <View style={styles.segmentedControl}>
          {FILTERS.map((f, i) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.segment,
                filter === f.key && styles.segmentActive,
                i === 0 && styles.segmentFirst,
                i === FILTERS.length - 1 && styles.segmentLast,
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.segmentText, filter === f.key && styles.segmentTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Type filter */}
        <View style={styles.typeFilterRow}>
          {TYPE_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.typeChip, entryType === f.key && styles.typeChipActive]}
              onPress={() => setEntryType(f.key)}
            >
              <Text style={styles.typeEmoji}>{f.emoji}</Text>
              <Text style={[styles.typeText, entryType === f.key && styles.typeTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : allEntries.length === 0 ? (
          <Animated.View entering={FadeInDown.springify()} style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📷</Text>
            <Text style={styles.emptyTitle}>Nothing logged yet</Text>
            <Text style={styles.emptySubtitle}>
              Snap a meal or log a workout to get started!
            </Text>
          </Animated.View>
        ) : (
          sortedDates.map((date) => {
            const dayEntries = grouped[date];
            const dayCaloriesEaten = dayEntries
              .filter((e) => e.type === 'food')
              .reduce((s, e) => s + (e.data as FoodLog).calories, 0);
            const dayCaloriesBurned = dayEntries
              .filter((e) => e.type === 'exercise')
              .reduce((s, e) => s + (e.data as ExerciseLog).calories_burned, 0);
            const netCalories = dayCaloriesEaten - dayCaloriesBurned;

            let cardIndex = 0;
            return (
              <View key={date}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayLabel}>{formatDateHeader(date)}</Text>
                  <View style={styles.dayStats}>
                    {dayCaloriesEaten > 0 && (
                      <Text style={styles.dayCaloriesEaten}>
                        🍽️ {Math.round(dayCaloriesEaten)}
                      </Text>
                    )}
                    {dayCaloriesBurned > 0 && (
                      <Text style={styles.dayCaloriesBurned}>
                        🔥 −{Math.round(dayCaloriesBurned)}
                      </Text>
                    )}
                    <Text style={styles.dayNet}>= {Math.round(netCalories)} cal net</Text>
                  </View>
                </View>

                {/* Daily wellness summary — water + mood */}
                {(() => {
                  const w = wellnessMap[date];
                  if (!w || (w.waterCups === 0 && !w.mood)) return null;
                  return (
                    <View style={styles.wellnessCard}>
                      {w.waterCups > 0 && (
                        <View style={styles.wellnessPill}>
                          <Text style={styles.wellnessEmoji}>💧</Text>
                          <Text style={styles.wellnessText}>
                            {w.waterCups}/{w.waterGoal} cups
                          </Text>
                          {w.waterCups >= w.waterGoal && (
                            <Text style={styles.wellnessDone}>✅</Text>
                          )}
                        </View>
                      )}
                      {w.mood && (
                        <View style={styles.wellnessPill}>
                          <Text style={styles.wellnessEmoji}>{MOOD_META[w.mood].emoji}</Text>
                          <Text style={styles.wellnessText}>{MOOD_META[w.mood].label}</Text>
                        </View>
                      )}
                    </View>
                  );
                })()}

                {dayEntries.map((entry) =>
                  entry.type === 'food' ? (
                    <FoodLogCard
                      key={entry.data.id}
                      log={entry.data as FoodLog}
                      index={cardIndex++}
                      onDelete={handleDeleteFood}
                    />
                  ) : (
                    <ExerciseLogCard
                      key={entry.data.id}
                      log={entry.data as ExerciseLog}
                      index={cardIndex++}
                      onDelete={handleDeleteExercise}
                    />
                  )
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 16, paddingBottom: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 24, color: Colors.text },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.secondary + '20',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: Colors.secondary + '55',
  },
  addExerciseText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.secondary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: Colors.text,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  segmentFirst: { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  segmentLast: { borderRightWidth: 0, borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  segmentActive: { backgroundColor: Colors.primary },
  segmentText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: Colors.textLight },
  segmentTextActive: { color: Colors.textWhite },
  typeFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  typeChipActive: { borderColor: Colors.secondary, backgroundColor: Colors.secondary + '15' },
  typeEmoji: { fontSize: 14 },
  typeText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.textLight },
  typeTextActive: { color: Colors.secondary },
  content: { padding: 16, paddingBottom: 100 },
  dayHeader: {
    marginBottom: 10,
    marginTop: 4,
  },
  dayLabel: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
    color: Colors.text,
    marginBottom: 4,
  },
  dayStats: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dayCaloriesEaten: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.primary,
  },
  dayCaloriesBurned: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.success,
  },
  dayNet: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.textLight,
  },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: Colors.text, marginBottom: 8 },
  emptySubtitle: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: Colors.textLight },
  wellnessCard: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  wellnessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  wellnessEmoji: { fontSize: 14 },
  wellnessText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.text,
  },
  wellnessDone: { fontSize: 12 },
});
