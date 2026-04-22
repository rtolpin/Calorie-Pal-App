import React, { useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart } from 'react-native-gifted-charts';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
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
  return new Date().toISOString().split('T')[0];
}

type JournalEntry =
  | { type: 'food'; data: FoodLog }
  | { type: 'exercise'; data: ExerciseLog };

export default function HomeScreen() {
  const { session, profile, isGuest } = useAuthStore();
  const { logs, isLoading: logsLoading, fetchLogs, deleteLog } = useFoodLogStore();
  const { exerciseLogs, isLoading: exerciseLoading, fetchExerciseLogs, deleteExerciseLog } = useExerciseLogStore();
  const { isOnline } = useNetworkStatus();

  const tip = MOTIVATIONAL_TIPS[new Date().getDay() % MOTIVATIONAL_TIPS.length];
  const todayStr = getTodayString();
  const isLoading = logsLoading || exerciseLoading;

  const todayFoodLogs = logs.filter((l) => l.logged_at.startsWith(todayStr));
  const todayExerciseLogs = exerciseLogs.filter((l) => l.logged_at.startsWith(todayStr));

  // Calorie math: consumed - burned = net, remaining = goal - net
  const totalCaloriesEaten = todayFoodLogs.reduce((s, l) => s + l.calories, 0);
  const totalCaloriesBurned = todayExerciseLogs.reduce((s, l) => s + l.calories_burned, 0);
  const netCalories = Math.max(0, totalCaloriesEaten - totalCaloriesBurned);

  const totalProtein = todayFoodLogs.reduce((s, l) => s + l.protein_g, 0);
  const totalCarbs = todayFoodLogs.reduce((s, l) => s + l.carbs_g, 0);
  const totalFat = todayFoodLogs.reduce((s, l) => s + l.fat_g, 0);
  const totalFiber = todayFoodLogs.reduce((s, l) => s + l.fiber_g, 0);

  const calorieGoal = profile?.daily_calorie_target || 2000;
  const remaining = Math.max(0, calorieGoal - netCalories);

  // Combine and sort recent entries by logged_at desc for the feed
  const recentEntries: JournalEntry[] = [
    ...logs.slice(0, 5).map((d): JournalEntry => ({ type: 'food', data: d })),
    ...exerciseLogs.slice(0, 5).map((d): JournalEntry => ({ type: 'exercise', data: d })),
  ]
    .sort((a, b) => new Date(b.data.logged_at).getTime() - new Date(a.data.logged_at).getTime())
    .slice(0, 3);

  useEffect(() => {
    fetchLogs(session?.user.id, isGuest);
    fetchExerciseLogs(session?.user.id, isGuest);
  }, [session?.user.id, isGuest]);

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
              {getGreeting()}, {isGuest ? 'friend' : profile?.name || 'there'}! 👋
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

        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.calorieCard}>
          <Text style={styles.sectionTitle}>Today's Progress</Text>

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

        {/* Action buttons */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.actionButtons}>
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
  sectionTitle: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: Colors.text, marginBottom: 16 },
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
});
