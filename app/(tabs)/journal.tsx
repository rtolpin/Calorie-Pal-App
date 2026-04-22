import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
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
import { FoodLog, ExerciseLog } from '../../types';
import { Colors } from '../../constants/Colors';

type Filter = 'today' | 'week' | 'month' | 'all';
type EntryType = 'all' | 'food' | 'exercise';
type JournalEntry =
  | { type: 'food'; data: FoodLog }
  | { type: 'exercise'; data: ExerciseLog };

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
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

  const isLoading = foodLoading || exerciseLoading;

  useEffect(() => {
    fetchLogs(session?.user.id, isGuest);
    fetchExerciseLogs(session?.user.id, isGuest);
  }, [session?.user.id, isGuest]);

  const filterByDate = <T extends { logged_at: string }>(items: T[]): T[] => {
    const now = new Date();
    if (filter === 'today') {
      const today = now.toISOString().split('T')[0];
      return items.filter((l) => l.logged_at.startsWith(today));
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
      const date = entry.data.logged_at.split('T')[0];
      if (!map[date]) map[date] = [];
      map[date].push(entry);
    });
    return map;
  }, [allEntries]);

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
  filterScroll: { marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.textLight },
  filterTextActive: { color: Colors.textWhite },
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
});
