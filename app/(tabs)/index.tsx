import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from '../../lib/haptics';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { useExerciseLogStore } from '../../store/exerciseLogStore';
import { GuestBanner } from '../../components/GuestBanner';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { FoodLogCard } from '../../components/FoodLogCard';
import { ExerciseLogCard } from '../../components/ExerciseLogCard';
import { SkeletonDashboard } from '../../components/ui/SkeletonCard';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { MacroRow } from '../../components/ui/MacroBadge';
import { Colors } from '../../constants/Colors';
import { FoodLog, ExerciseLog } from '../../types';
import { getGuestProfile, saveGuestProfile, getWaterCups, setWaterCups, getWaterGoal, saveWaterGoal, getMood, setMood, Mood } from '../../lib/asyncStorage';
import { toLocalDateStr, getLocalDate } from '../../lib/dateUtils';

const MOTIVATIONAL_TIPS = [
  '💧 Staying hydrated can reduce hunger — aim for 8 glasses today!',
  '🥗 Try adding more leafy greens — packed with nutrients and low in calories!',
  '🚶 A 20-minute walk after meals can boost your metabolism!',
  '🍎 Whole foods over processed ones make a huge difference over time.',
  '😴 Quality sleep helps regulate hunger hormones — aim for 7-8 hours!',
  '🥚 Starting your day with protein keeps you fuller longer!',
  '🏃 Even a short workout earns back calories for a bigger meal — keep moving!',
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTodayString(): string {
  return toLocalDateStr(new Date());
}

type JournalEntry =
  | { type: 'food'; data: FoodLog }
  | { type: 'exercise'; data: ExerciseLog };

export default function HomeScreen() {
  const { session, profile, isGuest, updateProfile } = useAuthStore();
  const { logs, isLoading: logsLoading, fetchLogs, deleteLog } = useFoodLogStore();
  const { exerciseLogs, isLoading: exerciseLoading, fetchExerciseLogs, deleteExerciseLog } = useExerciseLogStore();
  const { isOnline } = useNetworkStatus();

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [guestCalorieGoal, setGuestCalorieGoal] = useState<number | null>(null);
  const [waterCups, setWaterCupsState] = useState(0);
  const [waterGoal, setWaterGoalState] = useState(8);
  const [editingWaterGoal, setEditingWaterGoal] = useState(false);
  const [waterGoalInput, setWaterGoalInput] = useState('8');
  const [todayMood, setTodayMood] = useState<Mood | null>(null);

  const tip = MOTIVATIONAL_TIPS[new Date().getDay() % MOTIVATIONAL_TIPS.length];
  const todayStr = getTodayString();
  const isLoading = logsLoading || exerciseLoading;

  const todayFoodLogs = logs.filter((l) => getLocalDate(l.logged_at) === todayStr);
  const todayExerciseLogs = exerciseLogs.filter((l) => getLocalDate(l.logged_at) === todayStr);

  // Calorie math: consumed - burned = net, remaining = goal - net
  const totalCaloriesEaten = todayFoodLogs.reduce((s, l) => s + l.calories, 0);
  const totalCaloriesBurned = todayExerciseLogs.reduce((s, l) => s + l.calories_burned, 0);
  const netCalories = Math.max(0, totalCaloriesEaten - totalCaloriesBurned);

  const totalProtein = todayFoodLogs.reduce((s, l) => s + l.protein_g, 0);
  const totalCarbs = todayFoodLogs.reduce((s, l) => s + l.carbs_g, 0);
  const totalFat = todayFoodLogs.reduce((s, l) => s + l.fat_g, 0);
  const totalFiber = todayFoodLogs.reduce((s, l) => s + l.fiber_g, 0);

  const calorieGoal = isGuest
    ? (guestCalorieGoal ?? 2000)
    : (profile?.daily_calorie_target ?? 2000);
  const remaining = Math.max(0, calorieGoal - netCalories);

  // Combine and sort recent entries by logged_at desc for the feed
  const recentEntries: JournalEntry[] = [
    ...logs.slice(0, 5).map((d): JournalEntry => ({ type: 'food', data: d })),
    ...exerciseLogs.slice(0, 5).map((d): JournalEntry => ({ type: 'exercise', data: d })),
  ]
    .sort((a, b) => new Date(b.data.logged_at).getTime() - new Date(a.data.logged_at).getTime())
    .slice(0, 3);

  useFocusEffect(
    useCallback(() => {
      fetchLogs(session?.user.id, isGuest);
      fetchExerciseLogs(session?.user.id, isGuest);
    }, [session?.user.id, isGuest])
  );

  useEffect(() => {
    if (isGuest) {
      getGuestProfile().then((p) => {
        if (p?.daily_calorie_target) setGuestCalorieGoal(p.daily_calorie_target);
      });
    }
  }, [isGuest]);

  useFocusEffect(
    useCallback(() => {
      getWaterCups(todayStr).then(setWaterCupsState);
      getMood(todayStr).then(setTodayMood);
      getWaterGoal().then((g) => { setWaterGoalState(g); setWaterGoalInput(String(g)); });
    }, [todayStr])
  );

  const handleWaterChange = async (delta: number) => {
    const next = Math.max(0, waterCups + delta);
    setWaterCupsState(next);
    await setWaterCups(todayStr, next);
  };

  const handleSaveWaterGoal = async () => {
    const val = parseInt(waterGoalInput, 10);
    if (!val || val < 1 || val > 20) {
      Alert.alert('Invalid Goal', 'Please enter a water goal between 1 and 20 cups.');
      return;
    }
    setWaterGoalState(val);
    setEditingWaterGoal(false);
    await saveWaterGoal(val);
  };

  const handleMoodSelect = async (mood: Mood) => {
    setTodayMood(mood);
    await setMood(todayStr, mood);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleOpenGoalEdit = () => {
    setGoalInput(String(calorieGoal));
    setEditingGoal(true);
  };

  const handleSaveGoal = async () => {
    const val = parseInt(goalInput, 10);
    if (!val || val < 500 || val > 10000) {
      Alert.alert('Invalid Goal', 'Please enter a calorie goal between 500 and 10,000.');
      return;
    }
    setSavingGoal(true);
    try {
      if (isGuest) {
        await saveGuestProfile({ daily_calorie_target: val });
        setGuestCalorieGoal(val);
      } else {
        await updateProfile({ daily_calorie_target: val });
      }
      setEditingGoal(false);
    } catch {
      Alert.alert('Error', 'Failed to save goal. Please try again.');
    } finally {
      setSavingGoal(false);
    }
  };

  const donutData = [
    { value: Math.min(netCalories, calorieGoal), color: Colors.primary },
    ...(totalCaloriesBurned > 0
      ? [{ value: Math.min(totalCaloriesBurned, calorieGoal), color: Colors.success }]
      : []),
    { value: Math.max(remaining, 1), color: Colors.borderLight },
  ];

  const handleDeleteFood = (id: string) => deleteLog(id, session?.user.id, isGuest);
  const handleDeleteExercise = (id: string) => deleteExerciseLog(id, session?.user.id, isGuest);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        {isGuest && <GuestBanner />}
        <SkeletonDashboard />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {isGuest && <GuestBanner />}
      {!isOnline && <OfflineBanner />}

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.springify()} style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {getGreeting()}, {isGuest ? 'friend' : (profile?.name?.split(' ')[0] || 'there')}! 👋
            </Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
        </Animated.View>

        {/* Action buttons */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.snapFAB}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(tabs)/snap');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.fabEmoji}>📷</Text>
            <Text style={styles.fabText}>Snap a Meal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exerciseFAB}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/log-exercise');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.fabEmoji}>🏃</Text>
            <Text style={styles.fabText}>Log Exercise</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.calorieCard}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.sectionTitle}>Today's Progress</Text>
            <TouchableOpacity onPress={handleOpenGoalEdit} style={styles.editGoalBtn}>
              <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
              <Text style={styles.editGoalText}>Set Goal</Text>
            </TouchableOpacity>
          </View>

          {editingGoal && (
            <View style={styles.goalEditCard}>
              <Text style={styles.goalEditLabel}>Daily Calorie Goal</Text>
              <View style={styles.goalEditInputRow}>
                <TextInput
                  style={styles.goalEditInput}
                  value={goalInput}
                  onChangeText={setGoalInput}
                  keyboardType="numeric"
                  autoFocus
                  selectTextOnFocus
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={styles.goalEditUnit}>cal</Text>
              </View>
              <View style={styles.goalEditActions}>
                <TouchableOpacity
                  style={styles.goalCancelBtn}
                  onPress={() => setEditingGoal(false)}
                >
                  <Text style={styles.goalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.goalSaveBtn}
                  onPress={handleSaveGoal}
                  disabled={savingGoal}
                >
                  {savingGoal
                    ? <ActivityIndicator size="small" color={Colors.textWhite} />
                    : <Text style={styles.goalSaveText}>Save</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.chartContainer}>
            <PieChart
              data={donutData}
              donut
              radius={90}
              innerRadius={66}
              centerLabelComponent={() => (
                <View style={styles.chartCenter}>
                  <Text style={styles.chartCalories}>{Math.round(netCalories)}</Text>
                  <Text style={styles.chartLabel}>net of {calorieGoal}</Text>
                  <Text style={styles.chartSubLabel}>cal goal</Text>
                </View>
              )}
            />
          </View>

          {/* Eaten / Burned / Remaining stats row */}
          <View style={styles.calorieStatsRow}>
            <View style={styles.calStat}>
              <Text style={styles.calStatEmoji}>🍽️</Text>
              <Text style={styles.calStatNum}>{Math.round(totalCaloriesEaten)}</Text>
              <Text style={styles.calStatLabel}>Eaten</Text>
            </View>
            <View style={styles.calStatDivider} />
            <View style={styles.calStat}>
              <Text style={styles.calStatEmoji}>🔥</Text>
              <Text style={[styles.calStatNum, { color: Colors.success }]}>
                {Math.round(totalCaloriesBurned)}
              </Text>
              <Text style={styles.calStatLabel}>Burned</Text>
            </View>
            <View style={styles.calStatDivider} />
            <View style={styles.calStat}>
              <Text style={styles.calStatEmoji}>🎯</Text>
              <Text style={[styles.calStatNum, { color: Colors.primary }]}>
                {Math.round(remaining)}
              </Text>
              <Text style={styles.calStatLabel}>Remaining</Text>
            </View>
          </View>

          <View style={styles.remainingBadge}>
            <Text style={styles.remainingText}>
              {totalCaloriesBurned > 0
                ? `🏃 Great work! Exercise earned back ${Math.round(totalCaloriesBurned)} cal`
                : `🎯 You have ${Math.round(remaining)} calories remaining today`}
            </Text>
          </View>

          <MacroRow
            protein={totalProtein}
            carbs={totalCarbs}
            fat={totalFat}
            fiber={totalFiber}
          />
        </Animated.View>

        {recentEntries.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/journal')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {recentEntries.map((entry, i) =>
              entry.type === 'food' ? (
                <FoodLogCard key={entry.data.id} log={entry.data} index={i} onDelete={handleDeleteFood} />
              ) : (
                <ExerciseLogCard key={entry.data.id} log={entry.data} index={i} onDelete={handleDeleteExercise} />
              )
            )}
          </Animated.View>
        )}

        {recentEntries.length === 0 && (
          <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyTitle}>No activity logged yet</Text>
            <Text style={styles.emptySubtitle}>Snap a meal or log a workout to get started!</Text>
          </Animated.View>
        )}

        {/* Water Intake */}
        <Animated.View entering={FadeInDown.delay(380).springify()} style={styles.waterCard}>
          <View style={styles.waterHeader}>
            <Text style={styles.waterTitle}>💧 Water Intake</Text>
            {editingWaterGoal ? (
              <View style={styles.waterGoalEditRow}>
                <TextInput
                  style={styles.waterGoalInput}
                  value={waterGoalInput}
                  onChangeText={setWaterGoalInput}
                  keyboardType="number-pad"
                  autoFocus
                  selectTextOnFocus
                  maxLength={2}
                />
                <Text style={styles.waterGoalInputLabel}>cups</Text>
                <TouchableOpacity onPress={handleSaveWaterGoal} style={styles.waterGoalSaveBtn}>
                  <Ionicons name="checkmark" size={16} color={Colors.textWhite} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingWaterGoal(false)}>
                  <Ionicons name="close" size={18} color={Colors.textLight} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { setEditingWaterGoal(true); setWaterGoalInput(String(waterGoal)); }} style={styles.waterGoalBtn}>
                <Text style={styles.waterGoal}>Goal: {waterGoal} cups</Text>
                <Ionicons name="pencil-outline" size={12} color={Colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.waterRow}>
            <TouchableOpacity style={styles.waterBtn} onPress={() => handleWaterChange(-1)}>
              <Text style={styles.waterBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.waterCountContainer}>
              <Text style={[styles.waterCount, waterCups >= waterGoal && styles.waterCountDone]}>
                {waterCups}
              </Text>
              <Text style={styles.waterUnit}>
                of {waterGoal} cups {waterCups >= waterGoal ? '✅' : ''}
              </Text>
            </View>
            <TouchableOpacity style={[styles.waterBtn, styles.waterBtnAdd]} onPress={() => handleWaterChange(1)}>
              <Text style={[styles.waterBtnText, { color: Colors.textWhite }]}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.waterDotsRow}>
            {Array.from({ length: Math.min(waterGoal, 12) }).map((_, i) => (
              <View
                key={i}
                style={[styles.waterDot, i < waterCups && styles.waterDotFilled]}
              />
            ))}
            {waterGoal > 12 && (
              <Text style={styles.waterDotsMore}>+{waterGoal - 12}</Text>
            )}
          </View>
        </Animated.View>

        {/* Mood Tracker */}
        <Animated.View entering={FadeInDown.delay(390).springify()} style={styles.moodCard}>
          <Text style={styles.moodTitle}>😊 How are you feeling today?</Text>
          <View style={styles.moodRow}>
            {(
              [
                { mood: 'great', emoji: '😄', label: 'Great' },
                { mood: 'good', emoji: '😊', label: 'Good' },
                { mood: 'okay', emoji: '😐', label: 'Okay' },
                { mood: 'low', emoji: '😞', label: 'Low' },
                { mood: 'stressed', emoji: '😤', label: 'Stressed' },
                { mood: 'tired', emoji: '😴', label: 'Tired' },
              ] as { mood: Mood; emoji: string; label: string }[]
            ).map(({ mood, emoji, label }) => (
              <TouchableOpacity
                key={mood}
                style={[styles.moodBtn, todayMood === mood && styles.moodBtnActive]}
                onPress={() => handleMoodSelect(mood)}
              >
                <Text style={styles.moodEmoji}>{emoji}</Text>
                <Text style={[styles.moodLabel, todayMood === mood && styles.moodLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 Tip of the Day</Text>
          <Text style={styles.tipText}>{tip}</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 20 },
  greeting: { fontFamily: 'Nunito_800ExtraBold', fontSize: 24, color: Colors.text },
  date: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: Colors.textLight, marginTop: 2 },
  calorieCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitle: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: Colors.text },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '18',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editGoalText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.primary,
  },
  goalEditCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary + '44',
  },
  goalEditLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.text,
    marginBottom: 8,
  },
  goalEditInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  goalEditInput: {
    flex: 1,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 26,
    color: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.primary + '55',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
  goalEditUnit: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: Colors.textLight,
  },
  goalEditActions: {
    flexDirection: 'row',
    gap: 10,
  },
  goalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  goalCancelText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.textLight,
  },
  goalSaveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  goalSaveText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.textWhite,
  },
  chartContainer: { alignItems: 'center', marginBottom: 16 },
  chartCenter: { alignItems: 'center' },
  chartCalories: { fontFamily: 'Nunito_800ExtraBold', fontSize: 28, color: Colors.text },
  chartLabel: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textLight },
  chartSubLabel: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: Colors.textLight },
  calorieStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 12,
  },
  calStat: { alignItems: 'center', gap: 2 },
  calStatEmoji: { fontSize: 18 },
  calStatNum: { fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: Colors.text },
  calStatLabel: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: Colors.textLight },
  calStatDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  remainingBadge: {
    backgroundColor: Colors.accent2 + '55',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  remainingText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.text,
    textAlign: 'center',
  },
  actionButtons: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  snapFAB: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  exerciseFAB: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.secondary,
    borderRadius: 18,
    paddingVertical: 16,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  fabEmoji: { fontSize: 20 },
  fabText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: Colors.textWhite },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAll: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: Colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 64, marginBottom: 12 },
  emptyTitle: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: Colors.text, marginBottom: 6 },
  emptySubtitle: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: Colors.textLight },
  tipCard: {
    backgroundColor: Colors.accent1 + '44',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.accent1,
  },
  tipTitle: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: Colors.text, marginBottom: 6 },
  tipText: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: Colors.text, lineHeight: 20 },

  // Water card
  waterCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  waterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  waterTitle: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: Colors.text },
  waterGoalBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  waterGoal: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textLight },
  waterGoalEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waterGoalInput: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: '#4FC3F7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    width: 40,
    textAlign: 'center',
  },
  waterGoalInputLabel: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textLight },
  waterGoalSaveBtn: {
    backgroundColor: '#4FC3F7',
    borderRadius: 8,
    padding: 4,
  },
  waterCountDone: { color: '#4FC3F7' },
  waterDotsMore: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.textLight,
    alignSelf: 'center',
  },
  waterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  waterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterBtnAdd: {
    backgroundColor: '#4FC3F7',
    borderColor: '#4FC3F7',
  },
  waterBtnText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: Colors.text,
    lineHeight: 26,
  },
  waterCountContainer: { alignItems: 'center' },
  waterCount: { fontFamily: 'Nunito_800ExtraBold', fontSize: 40, color: '#4FC3F7' },
  waterUnit: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textLight },
  waterDotsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  waterDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.borderLight,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  waterDotFilled: {
    backgroundColor: '#4FC3F7',
    borderColor: '#0288D1',
  },

  // Mood card
  moodCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  moodTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: Colors.text,
    marginBottom: 14,
  },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    flex: 1,
    marginHorizontal: 3,
  },
  moodBtnActive: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondary + '20',
  },
  moodEmoji: { fontSize: 22, marginBottom: 4 },
  moodLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: Colors.textLight,
    textAlign: 'center',
  },
  moodLabelActive: {
    fontFamily: 'Nunito_700Bold',
    color: Colors.secondary,
  },
});
