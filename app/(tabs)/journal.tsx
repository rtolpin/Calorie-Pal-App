import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import {
  getWaterCups, getWaterGoal, getMood, setMood, getDailyNote, setDailyNote, Mood,
  getFavoriteMealNames, toggleFavoriteMeal,
  getFavoriteExerciseNames, toggleFavoriteExercise,
  getDayTemplate, saveDayTemplate, DayTemplate,
} from '../../lib/asyncStorage';
import { toLocalDateStr } from '../../lib/dateUtils';
import {
  getRecentPastEntries, groupEntriesByDate, getMoodColor, getMoodQuote,
  filterFavoriteEntries, filterByDateRange, parseUserDate,
} from '../../lib/journalUtils';
import { DayTemplateFood, DayTemplateExercise } from '../../types';
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
  note: string | null;
}

const MOODS: { mood: Mood; emoji: string; label: string }[] = [
  { mood: 'great', emoji: '😄', label: 'Great' },
  { mood: 'good', emoji: '😊', label: 'Good' },
  { mood: 'okay', emoji: '😐', label: 'Okay' },
  { mood: 'low', emoji: '😞', label: 'Low' },
  { mood: 'stressed', emoji: '😤', label: 'Stressed' },
  { mood: 'tired', emoji: '😴', label: 'Tired' },
];

type Filter = 'today' | 'week' | 'month' | 'all' | 'custom';
type EntryType = 'all' | 'food' | 'exercise' | 'favorites';
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

function WellnessBanner({ w, onEditNote }: { w: DailyWellness; onEditNote?: () => void }) {
  const moodColor = w.mood ? getMoodColor(w.mood) : null;
  const moodMeta = w.mood ? MOOD_META[w.mood] : null;

  if (!w.mood && w.waterCups === 0 && !w.note) return null;

  return (
    <View style={[styles.wellnessBanner, moodColor && { backgroundColor: moodColor.bg }]}>
      {w.mood && moodColor && moodMeta && (
        <View style={styles.wellnessMoodRow}>
          <Text style={styles.wellnessMoodEmoji}>{moodMeta.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.wellnessMoodLabel, { color: moodColor.text }]}>
              Feeling {moodMeta.label}
            </Text>
            <Text style={[styles.wellnessMoodQuote, { color: moodColor.text + 'CC' }]}>
              {getMoodQuote(w.mood)}
            </Text>
          </View>
        </View>
      )}

      {w.waterCups > 0 && (
        <View style={styles.wellnessWaterRow}>
          <Text style={styles.wellnessWaterIcon}>💧</Text>
          <Text style={styles.wellnessWaterText}>
            {w.waterCups} of {w.waterGoal} cups
          </Text>
          {w.waterCups >= w.waterGoal && <Text style={styles.wellnessDone}>✅ Goal met!</Text>}
        </View>
      )}

      {w.note ? (
        <View style={styles.wellnessNoteRow}>
          <Text style={styles.wellnessNoteIcon}>📝</Text>
          <Text style={styles.wellnessNoteText} numberOfLines={2}>{w.note}</Text>
          {onEditNote && (
            <TouchableOpacity onPress={onEditNote} style={styles.wellnessNoteEditBtn}>
              <Text style={styles.wellnessNoteEditText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : onEditNote ? (
        <TouchableOpacity onPress={onEditNote} style={styles.wellnessAddNoteBtn}>
          <Text style={styles.wellnessAddNoteText}>📝 Add a note for this day</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

interface DayGroupCtx {
  wellnessMap: Record<string, DailyWellness>;
  onDeleteFood: (id: string) => void;
  onDeleteExercise: (id: string) => void;
  onEditNote: (date: string) => void;
  favoriteMealNames: Set<string>;
  favoriteExerciseNames: Set<string>;
  onToggleFavoriteFood: (name: string) => void;
  onToggleFavoriteExercise: (name: string) => void;
  /** Date string for which the wellness banner should be suppressed (already shown in top banner). */
  hideWellnessBannerFor?: string;
}

function renderDayGroup(date: string, entries: JournalEntry[], ctx: DayGroupCtx) {
  const { wellnessMap, onDeleteFood, onDeleteExercise, onEditNote,
    favoriteMealNames, favoriteExerciseNames, onToggleFavoriteFood, onToggleFavoriteExercise } = ctx;
  const eaten = entries.filter((e) => e.type === 'food').reduce((s, e) => s + (e.data as FoodLog).calories, 0);
  const burned = entries.filter((e) => e.type === 'exercise').reduce((s, e) => s + (e.data as ExerciseLog).calories_burned, 0);
  const net = eaten - burned;
  const w = wellnessMap[date];
  let cardIndex = 0;
  return (
    <View key={date}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayLabel}>{formatDateHeader(date)}</Text>
        <View style={styles.dayStats}>
          {eaten > 0 && <Text style={styles.dayCaloriesEaten}>🍽️ {Math.round(eaten)}</Text>}
          {burned > 0 && <Text style={styles.dayCaloriesBurned}>🔥 −{Math.round(burned)}</Text>}
          <Text style={styles.dayNet}>= {Math.round(net)} cal net</Text>
        </View>
      </View>

      {w && date !== ctx.hideWellnessBannerFor && (
        <WellnessBanner w={w} onEditNote={() => onEditNote(date)} />
      )}

      {entries.map((entry) =>
        entry.type === 'food' ? (
          <FoodLogCard
            key={entry.data.id}
            log={entry.data as FoodLog}
            index={cardIndex++}
            onDelete={onDeleteFood}
            isFavorite={favoriteMealNames.has((entry.data as FoodLog).meal_name)}
            onToggleFavorite={() => onToggleFavoriteFood((entry.data as FoodLog).meal_name)}
          />
        ) : (
          <ExerciseLogCard
            key={entry.data.id}
            log={entry.data as ExerciseLog}
            index={cardIndex++}
            onDelete={onDeleteExercise}
            isFavorite={favoriteExerciseNames.has((entry.data as ExerciseLog).exercise_name)}
            onToggleFavorite={() => onToggleFavoriteExercise((entry.data as ExerciseLog).exercise_name)}
          />
        )
      )}
    </View>
  );
}

export default function JournalScreen() {
  const { session, isGuest } = useAuthStore();
  const { logs, isLoading: foodLoading, fetchLogs, deleteLog, addLog } = useFoodLogStore();
  const { exerciseLogs, isLoading: exerciseLoading, fetchExerciseLogs, deleteExerciseLog, addExerciseLog } = useExerciseLogStore();
  const { isOnline } = useNetworkStatus();

  const [filter, setFilter] = useState<Filter>('today');
  // Separate display (what user types) from applied (validated, drives the filter)
  const [customFromInput, setCustomFromInput] = useState('');
  const [customToInput, setCustomToInput] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [customDateError, setCustomDateError] = useState('');
  const [entryType, setEntryType] = useState<EntryType>('all');
  const [search, setSearch] = useState('');
  const [wellnessMap, setWellnessMap] = useState<Record<string, DailyWellness>>({});
  const [waterGoalVal, setWaterGoalVal] = useState(8);

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [modalNote, setModalNote] = useState('');
  const [modalMood, setModalMood] = useState<Mood | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  const [favoriteMealNames, setFavoriteMealNames] = useState<Set<string>>(new Set());
  const [favoriteExerciseNames, setFavoriteExerciseNames] = useState<Set<string>>(new Set());
  const [currentTemplate, setCurrentTemplate] = useState<DayTemplate | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  // Bumped on every focus to force wellness data (mood, water, notes) to reload
  // from AsyncStorage — ensures mood set on the Home tab is immediately visible here.
  const [wellnessRefreshKey, setWellnessRefreshKey] = useState(0);

  const isLoading = foodLoading || exerciseLoading;

  useFocusEffect(
    useCallback(() => {
      fetchLogs(session?.user.id, isGuest);
      fetchExerciseLogs(session?.user.id, isGuest);
      getWaterGoal().then(setWaterGoalVal);
      getFavoriteMealNames().then((names) => setFavoriteMealNames(new Set(names)));
      getFavoriteExerciseNames().then((names) => setFavoriteExerciseNames(new Set(names)));
      getDayTemplate().then(setCurrentTemplate);
      setWellnessRefreshKey((k) => k + 1);
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
    if (filter === 'custom') {
      return filterByDateRange(items, customFrom, customTo);
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

    const combined = [...foodEntries, ...exerciseEntries];
    if (entryType === 'favorites') {
      return filterFavoriteEntries(combined, [...favoriteMealNames], [...favoriteExerciseNames])
        .sort((a, b) => new Date(b.data.logged_at).getTime() - new Date(a.data.logged_at).getTime());
    }

    return combined.sort(
      (a, b) => new Date(b.data.logged_at).getTime() - new Date(a.data.logged_at).getTime()
    );
  }, [logs, exerciseLogs, filter, entryType, search, favoriteMealNames, favoriteExerciseNames, customFrom, customTo]);

  // Group today's entries by date
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

  // When the 'today' filter shows nothing, surface the most recent past entries
  const recentPastEntries = useMemo(
    () =>
      filter === 'today' && allEntries.length === 0
        ? getRecentPastEntries(logs, exerciseLogs, toLocalDateStr(new Date()), entryType)
        : [],
    [filter, allEntries.length, logs, exerciseLogs, entryType],
  );

  const recentPastGrouped = useMemo(
    () => groupEntriesByDate(recentPastEntries),
    [recentPastEntries],
  );

  const recentPastSortedDates = Object.keys(recentPastGrouped).sort((a, b) => b.localeCompare(a));

  // Load water + mood + note for every visible date; always include today when on Today filter
  const todayStr = toLocalDateStr(new Date());
  const wellnessDates = useMemo(() => {
    const base = sortedDates.length > 0 ? sortedDates : recentPastSortedDates;
    if (filter === 'today' && !base.includes(todayStr)) return [todayStr, ...base];
    return base;
  }, [sortedDates.join(','), recentPastSortedDates.join(','), filter, todayStr]);

  useEffect(() => {
    if (wellnessDates.length === 0) return;
    let cancelled = false;
    const goal = waterGoalVal;
    Promise.all(
      wellnessDates.map(async (date) => {
        const [cups, mood, note] = await Promise.all([getWaterCups(date), getMood(date), getDailyNote(date)]);
        return { date, cups, mood, note };
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, DailyWellness> = {};
      results.forEach(({ date, cups, mood, note }) => {
        map[date] = { waterCups: cups, waterGoal: goal, mood, note };
      });
      setWellnessMap(map);
    });
    return () => { cancelled = true; };
  }, [wellnessDates.join(','), waterGoalVal, wellnessRefreshKey]);

  const handleDeleteFood = (id: string) => deleteLog(id, session?.user.id, isGuest);
  const handleDeleteExercise = (id: string) => deleteExerciseLog(id, session?.user.id, isGuest);

  const handleApplyCustomDate = () => {
    const from = parseUserDate(customFromInput);
    const to   = parseUserDate(customToInput);
    if (!customFromInput && !customToInput) {
      setCustomFrom(''); setCustomTo(''); setCustomDateError(''); return;
    }
    if ((customFromInput && !from) || (customToInput && !to)) {
      setCustomDateError('Enter dates as MM/DD/YYYY (e.g. 01/15/2026)');
      return;
    }
    if (from && to && from > to) {
      setCustomDateError('"From" date must be on or before "To" date');
      return;
    }
    setCustomDateError('');
    setCustomFrom(from);
    setCustomTo(to);
  };

  const handleClearCustomDate = () => {
    setCustomFromInput(''); setCustomToInput('');
    setCustomFrom(''); setCustomTo(''); setCustomDateError('');
  };

  const handleToggleFavoriteFood = async (mealName: string) => {
    const isNow = await toggleFavoriteMeal(mealName);
    setFavoriteMealNames((prev) => {
      const next = new Set(prev);
      isNow ? next.add(mealName) : next.delete(mealName);
      return next;
    });
  };

  const handleToggleFavoriteExercise = async (exerciseName: string) => {
    const isNow = await toggleFavoriteExercise(exerciseName);
    setFavoriteExerciseNames((prev) => {
      const next = new Set(prev);
      isNow ? next.add(exerciseName) : next.delete(exerciseName);
      return next;
    });
  };

  const handleRepeatYesterday = () => {
    const yesterday = toLocalDateStr(new Date(Date.now() - 86400000));
    const yFoods = logs.filter((l) => toLocalDateStr(new Date(l.logged_at)) === yesterday);
    const yExercises = exerciseLogs.filter((l) => toLocalDateStr(new Date(l.logged_at)) === yesterday);
    if (yFoods.length === 0 && yExercises.length === 0) {
      Alert.alert('Nothing to Copy', 'No meals or exercises were logged yesterday.');
      return;
    }
    const parts: string[] = [];
    if (yFoods.length) parts.push(`${yFoods.length} meal${yFoods.length > 1 ? 's' : ''}`);
    if (yExercises.length) parts.push(`${yExercises.length} exercise${yExercises.length > 1 ? 's' : ''}`);
    Alert.alert('Repeat Yesterday', `Copy ${parts.join(' and ')} from yesterday to today?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Copy',
        onPress: async () => {
          const now = new Date().toISOString();
          try {
            await Promise.all([
              ...yFoods.map((f) => addLog({ user_id: session?.user.id, meal_name: f.meal_name,
                foods_detected: f.foods_detected, calories: f.calories, protein_g: f.protein_g,
                carbs_g: f.carbs_g, fat_g: f.fat_g, fiber_g: f.fiber_g, sugar_g: f.sugar_g,
                sodium_mg: f.sodium_mg, cholesterol_mg: f.cholesterol_mg, saturated_fat_g: f.saturated_fat_g,
                notes: f.notes, logged_at: now }, session?.user.id, isGuest)),
              ...yExercises.map((e) => addExerciseLog({ user_id: session?.user.id,
                exercise_name: e.exercise_name, exercise_emoji: e.exercise_emoji,
                duration_minutes: e.duration_minutes, calories_burned: e.calories_burned,
                felt: e.felt, notes: e.notes, logged_at: now }, session?.user.id, isGuest)),
            ]);
          } catch { Alert.alert('Error', 'Failed to copy. Please try again.'); }
        },
      },
    ]);
  };

  const handleSaveTemplate = async () => {
    const tStr = toLocalDateStr(new Date());
    const tFoods = logs.filter((l) => toLocalDateStr(new Date(l.logged_at)) === tStr);
    const tExercises = exerciseLogs.filter((l) => toLocalDateStr(new Date(l.logged_at)) === tStr);
    if (tFoods.length === 0 && tExercises.length === 0) {
      Alert.alert('Nothing to Save', 'Log some meals or exercises today first.');
      return;
    }
    const tmpl: DayTemplate = {
      savedAt: new Date().toISOString(),
      sourceDate: tStr,
      foods: tFoods.map((f): DayTemplateFood => ({ meal_name: f.meal_name, foods_detected: f.foods_detected,
        calories: f.calories, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g,
        fiber_g: f.fiber_g, sugar_g: f.sugar_g, sodium_mg: f.sodium_mg,
        cholesterol_mg: f.cholesterol_mg, saturated_fat_g: f.saturated_fat_g, notes: f.notes })),
      exercises: tExercises.map((e): DayTemplateExercise => ({ exercise_name: e.exercise_name,
        exercise_emoji: e.exercise_emoji, duration_minutes: e.duration_minutes,
        calories_burned: e.calories_burned, felt: e.felt, notes: e.notes })),
    };
    await saveDayTemplate(tmpl);
    setCurrentTemplate(tmpl);
    Alert.alert('Template Saved! 💾', 'Tap "Apply Template" on any future day to reuse it.');
  };

  const handleApplyTemplate = () => {
    if (!currentTemplate) return;
    const parts: string[] = [];
    if (currentTemplate.foods.length) parts.push(`${currentTemplate.foods.length} meal${currentTemplate.foods.length > 1 ? 's' : ''}`);
    if (currentTemplate.exercises.length) parts.push(`${currentTemplate.exercises.length} exercise${currentTemplate.exercises.length > 1 ? 's' : ''}`);
    Alert.alert('Apply Template', `Add ${parts.join(' and ')} from your saved template to today?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Apply',
        onPress: async () => {
          setApplyingTemplate(true);
          const now = new Date().toISOString();
          try {
            await Promise.all([
              ...currentTemplate.foods.map((f) => addLog({ user_id: session?.user.id, ...f, logged_at: now }, session?.user.id, isGuest)),
              ...currentTemplate.exercises.map((e) => addExerciseLog({ user_id: session?.user.id, ...e, logged_at: now }, session?.user.id, isGuest)),
            ]);
          } catch { Alert.alert('Error', 'Failed to apply template. Please try again.'); }
          finally { setApplyingTemplate(false); }
        },
      },
    ]);
  };

  const handleOpenNote = useCallback((date: string) => {
    setModalDate(date);
    const w = wellnessMap[date];
    setModalNote(w?.note ?? '');
    setModalMood(w?.mood ?? null);
    setShowNoteModal(true);
  }, [wellnessMap]);

  const handleSaveNote = async () => {
    setModalSaving(true);
    try {
      await setDailyNote(modalDate, modalNote);
      if (modalMood) await setMood(modalDate, modalMood);
      setWellnessMap((prev) => ({
        ...prev,
        [modalDate]: {
          ...(prev[modalDate] ?? { waterCups: 0, waterGoal: waterGoalVal }),
          mood: modalMood,
          note: modalNote.trim() || null,
        },
      }));
      setShowNoteModal(false);
    } finally {
      setModalSaving(false);
    }
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'today',  label: 'Today' },
    { key: 'week',   label: 'This Week' },
    { key: 'month',  label: 'This Month' },
    { key: 'all',    label: 'All Time' },
    { key: 'custom', label: '📅 Custom' },
  ];

  const TYPE_FILTERS: { key: EntryType; label: string; emoji: string }[] = [
    { key: 'all',       label: 'All',       emoji: '📋' },
    { key: 'food',      label: 'Meals',     emoji: '🍽️' },
    { key: 'exercise',  label: 'Exercise',  emoji: '🏃' },
    { key: 'favorites', label: 'Favorites', emoji: '⭐' },
  ];

  const dayCtx: DayGroupCtx = {
    wellnessMap,
    onDeleteFood: handleDeleteFood,
    onDeleteExercise: handleDeleteExercise,
    onEditNote: handleOpenNote,
    favoriteMealNames,
    favoriteExerciseNames,
    onToggleFavoriteFood: handleToggleFavoriteFood,
    onToggleFavoriteExercise: handleToggleFavoriteExercise,
    // When the Today filter is active the top banner already shows today's wellness,
    // so suppress it inside the day-group to avoid showing the quote twice.
    hideWellnessBannerFor: filter === 'today' ? todayStr : undefined,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {isGuest && <GuestBanner />}
      {!isOnline && <OfflineBanner />}

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>📓 Journal</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.noteBtn}
              onPress={() => router.push('/notes')}
              accessibilityLabel="Open journal notes"
            >
              <Ionicons name="journal-outline" size={16} color={Colors.primary} />
              <Text style={styles.noteBtnText}>Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addExerciseBtn}
              onPress={() => router.push('/log-exercise')}
              accessibilityRole="button"
              accessibilityLabel="Log an exercise"
            >
              <Ionicons name="fitness-outline" size={18} color={Colors.secondary} />
              <Text style={styles.addExerciseText}>Log Exercise</Text>
            </TouchableOpacity>
          </View>
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

        {/* Custom date range — shown only when Custom filter is active */}
        {filter === 'custom' && (
          <View style={styles.customDateSection}>
            <View style={styles.customDateRow}>
              <View style={styles.customDateField}>
                <Text style={styles.customDateLabel}>From</Text>
                <TextInput
                  style={styles.customDateInput}
                  value={customFromInput}
                  onChangeText={(v) => { setCustomFromInput(v); setCustomDateError(''); }}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={10}
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="next"
                  accessibilityLabel="Filter from date"
                />
              </View>
              <Text style={styles.customDateArrow}>→</Text>
              <View style={styles.customDateField}>
                <Text style={styles.customDateLabel}>To</Text>
                <TextInput
                  style={styles.customDateInput}
                  value={customToInput}
                  onChangeText={(v) => { setCustomToInput(v); setCustomDateError(''); }}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={10}
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="search"
                  onSubmitEditing={handleApplyCustomDate}
                  accessibilityLabel="Filter to date"
                />
              </View>
              <TouchableOpacity
                onPress={handleApplyCustomDate}
                style={styles.customDateApplyBtn}
                accessibilityLabel="Apply date filter"
              >
                <Ionicons name="search" size={16} color={Colors.textWhite} />
              </TouchableOpacity>
            </View>

            {customDateError ? (
              <Text style={styles.customDateError}>{customDateError}</Text>
            ) : (customFrom || customTo) ? (
              <View style={styles.customDateAppliedRow}>
                <Text style={styles.customDateAppliedText}>
                  Showing {allEntries.length} {allEntries.length === 1 ? 'result' : 'results'}
                </Text>
                <TouchableOpacity onPress={handleClearCustomDate} accessibilityLabel="Clear date filter">
                  <Text style={styles.customDateClearText}>Clear</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* Quick Fill row — only shown on Today filter */}
      {filter === 'today' && (
        <View style={styles.quickFillRow}>
          <TouchableOpacity style={styles.quickFillBtn} onPress={handleRepeatYesterday}>
            <Ionicons name="refresh-outline" size={14} color={Colors.secondary} />
            <Text style={styles.quickFillText}>Repeat Yesterday</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickFillBtn, currentTemplate && styles.quickFillBtnAlt]}
            onPress={currentTemplate ? handleApplyTemplate : handleSaveTemplate}
            disabled={applyingTemplate}
          >
            <Ionicons
              name={currentTemplate ? 'clipboard-outline' : 'save-outline'}
              size={14}
              color={currentTemplate ? Colors.primary : Colors.textLight}
            />
            <Text style={[styles.quickFillText, currentTemplate && { color: Colors.primary }]}>
              {currentTemplate ? 'Apply Saved Template' : 'Save Today as Template'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Today's wellness banner — always shown when on Today filter */}
        {filter === 'today' && wellnessMap[todayStr] && (
          <Animated.View entering={FadeInDown.springify()} style={styles.todayWellnessSection}>
            <Text style={styles.todayWellnessSectionLabel}>TODAY</Text>
            <WellnessBanner
              w={wellnessMap[todayStr]}
              onEditNote={() => handleOpenNote(todayStr)}
            />
          </Animated.View>
        )}

        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : allEntries.length === 0 ? (
          <>
            <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📷</Text>
              <Text style={styles.emptyTitle}>
                {filter === 'today' ? 'Nothing logged yet today' : 'Nothing logged yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Snap a meal or log a workout to get started!
              </Text>
            </Animated.View>

            {recentPastSortedDates.length > 0 && (
              <Animated.View entering={FadeInDown.delay(120).springify()}>
                <View style={styles.recentPastHeader}>
                  <Text style={styles.recentPastLabel}>Recent Activity</Text>
                </View>
                {recentPastSortedDates.map((date) =>
                  renderDayGroup(date, recentPastGrouped[date], dayCtx)
                )}
              </Animated.View>
            )}
          </>
        ) : (
          sortedDates.map((date) =>
            renderDayGroup(date, grouped[date], dayCtx)
          )
        )}
      </ScrollView>

      {/* Journal notes + mood modal */}
      <Modal
        visible={showNoteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNoteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: Colors.background }}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowNoteModal(false)} style={styles.modalCancelBtn}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {modalDate === todayStr ? '📝 Today\'s Notes' : `📝 ${formatDateHeader(modalDate)}`}
            </Text>
            <TouchableOpacity onPress={handleSaveNote} disabled={modalSaving} style={styles.modalSaveBtn}>
              <Text style={[styles.modalSaveText, modalSaving && { opacity: 0.5 }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalSectionLabel}>How are you feeling?</Text>
            <View style={styles.modalMoodGrid}>
              {MOODS.map(({ mood, emoji, label }) => {
                const mc = getMoodColor(mood);
                const active = modalMood === mood;
                return (
                  <TouchableOpacity
                    key={mood}
                    style={[styles.modalMoodBtn, active && { backgroundColor: mc.bg, borderColor: mc.border }]}
                    onPress={() => setModalMood(active ? null : mood)}
                  >
                    <Text style={styles.modalMoodEmoji}>{emoji}</Text>
                    <Text style={[styles.modalMoodLabel, active && { color: mc.text, fontFamily: 'Nunito_700Bold' }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.modalSectionLabel, { marginTop: 20 }]}>Your notes for this day</Text>
            <Text style={styles.modalNoteHint}>
              How did you feel after eating? Any wins or setbacks? What did you learn?
            </Text>
            <TextInput
              style={styles.modalNoteInput}
              value={modalNote}
              onChangeText={setModalNote}
              placeholder="Write anything on your mind — meals, energy, mood, goals…"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  typeFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
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
  recentPastHeader: {
    marginTop: 28,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
  },
  recentPastLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // Header actions row
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  noteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary + '18',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary + '55',
  },
  noteBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.primary },

  customDateSection: { paddingTop: 8, paddingBottom: 4, gap: 6 },
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  customDateField: { flex: 1 },
  customDateLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: Colors.textLight,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customDateInput: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: Colors.surface,
  },
  customDateArrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    color: Colors.textLight,
    paddingBottom: 10,
  },
  customDateApplyBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customDateError: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.error,
  },
  customDateAppliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customDateAppliedText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textLight,
  },
  customDateClearText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.primary,
  },
  quickFillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  quickFillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  quickFillBtnAlt: {
    borderColor: Colors.primary + '55',
    backgroundColor: Colors.primary + '08',
  },
  quickFillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: Colors.textLight,
  },
  // Today wellness section
  todayWellnessSection: { marginBottom: 4 },
  todayWellnessSectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  // Wellness banner (non-button, mood-colored info display)
  wellnessBanner: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    gap: 6,
  },
  wellnessMoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wellnessMoodEmoji: { fontSize: 18, lineHeight: 22 },
  wellnessMoodLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.text,
    marginBottom: 1,
  },
  wellnessMoodQuote: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: Colors.textLight,
    lineHeight: 15,
    fontStyle: 'italic',
  },
  wellnessWaterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wellnessWaterIcon: { fontSize: 15 },
  wellnessWaterText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  wellnessDone: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.success,
  },
  wellnessNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  wellnessNoteIcon: { fontSize: 13, marginTop: 1 },
  wellnessNoteText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
    flex: 1,
  },
  wellnessNoteEditBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: Colors.primary + '18',
    borderRadius: 8,
  },
  wellnessNoteEditText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: Colors.primary,
  },
  wellnessAddNoteBtn: {
    paddingVertical: 4,
  },
  wellnessAddNoteText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },

  // Notes modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalCancelBtn: { minWidth: 60 },
  modalCancelText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: Colors.textLight,
  },
  modalTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  modalSaveBtn: { minWidth: 60, alignItems: 'flex-end' },
  modalSaveText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: Colors.primary,
  },
  modalContent: { padding: 16, paddingBottom: 40 },
  modalSectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 10,
  },
  modalMoodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalMoodBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    minWidth: '30%',
    flex: 1,
  },
  modalMoodEmoji: { fontSize: 24, marginBottom: 4 },
  modalMoodLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: Colors.textLight,
  },
  modalNoteHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  modalNoteInput: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    minHeight: 160,
    backgroundColor: Colors.surface,
    lineHeight: 22,
  },
});
