import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { useExerciseLogStore } from '../../store/exerciseLogStore';
import { GuestBanner } from '../../components/GuestBanner';
import { SuggestionsDisplay } from '../../components/SuggestionCard';
import { getNutritionSuggestions } from '../../lib/claude';
import { Colors } from '../../constants/Colors';
import { FoodLog } from '../../types';

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

function getDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

function getTopFoods(logs: FoodLog[]): { food: string; count: number }[] {
  const counts: Record<string, number> = {};
  logs.forEach((l) => l.foods_detected.forEach((f) => { counts[f] = (counts[f] || 0) + 1; }));
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([food, count]) => ({ food, count }));
}

const CITATION_SOURCES = [
  { label: 'USDA Dietary Guidelines for Americans', url: 'https://www.dietaryguidelines.gov' },
  { label: 'NIH Office of Dietary Supplements', url: 'https://ods.od.nih.gov' },
  { label: 'CDC Nutrition', url: 'https://www.cdc.gov/nutrition' },
  { label: 'Academy of Nutrition and Dietetics', url: 'https://www.eatright.org' },
  { label: 'Harvard T.H. Chan – The Nutrition Source', url: 'https://www.hsph.harvard.edu/nutritionsource' },
];

export default function InsightsScreen() {
  const { session, isGuest, profile } = useAuthStore();
  const { logs, fetchLogs } = useFoodLogStore();
  const { exerciseLogs, fetchExerciseLogs } = useExerciseLogStore();
  const [suggestions, setSuggestions] = useState<string>('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState('');

  const last7Days = getLast7Days();

  const recentLogs = useMemo(() => {
    const cutoff = new Date(Date.now() - 14 * 86400000).toISOString();
    return logs.filter((l) => l.logged_at >= cutoff);
  }, [logs]);

  // 7-day bar chart: grouped bars for eaten vs burned vs net
  const weeklyData = useMemo(() =>
    last7Days.map((date) => {
      const dayFood = logs.filter((l) => l.logged_at.startsWith(date));
      const dayExercise = exerciseLogs.filter((l) => l.logged_at.startsWith(date));
      const eaten = Math.round(dayFood.reduce((s, l) => s + l.calories, 0));
      const burned = Math.round(dayExercise.reduce((s, l) => s + l.calories_burned, 0));
      const net = Math.max(0, eaten - burned);
      return { date, label: getDayLabel(date), eaten, burned, net };
    }),
    [logs, exerciseLogs]
  );

  // Format for BarChart (showing net calories with burned overlay)
  const barChartData = weeklyData.map((d) => ({
    value: d.net,
    label: d.label,
    frontColor: Colors.primary,
    topLabelComponent: () => null,
  }));

  const burnedBarData = weeklyData.map((d) => ({
    value: d.burned,
    frontColor: Colors.success,
  }));

  const avgEaten = weeklyData.filter((d) => d.eaten > 0).length
    ? Math.round(weeklyData.reduce((s, d) => s + d.eaten, 0) / Math.max(1, weeklyData.filter((d) => d.eaten > 0).length))
    : 0;

  const avgBurned = weeklyData.filter((d) => d.burned > 0).length
    ? Math.round(weeklyData.reduce((s, d) => s + d.burned, 0) / Math.max(1, weeklyData.filter((d) => d.burned > 0).length))
    : 0;

  const avgNet = Math.max(0, avgEaten - avgBurned);

  const totalProtein = recentLogs.reduce((s, l) => s + l.protein_g, 0);
  const totalCarbs = recentLogs.reduce((s, l) => s + l.carbs_g, 0);
  const totalFat = recentLogs.reduce((s, l) => s + l.fat_g, 0);
  const macroTotal = totalProtein * 4 + totalCarbs * 4 + totalFat * 9;

  const macroPieData = macroTotal > 0 ? [
    { value: Math.round((totalProtein * 4 / macroTotal) * 100), color: Colors.protein, text: 'Protein' },
    { value: Math.round((totalCarbs * 4 / macroTotal) * 100), color: Colors.carbs, text: 'Carbs' },
    { value: Math.round((totalFat * 9 / macroTotal) * 100), color: Colors.fat, text: 'Fat' },
  ] : [{ value: 100, color: Colors.border, text: '' }];

  const topFoods = getTopFoods(recentLogs);

  // Most done exercises this week
  const exerciseCounts: Record<string, { count: number; emoji: string; burned: number }> = {};
  exerciseLogs.forEach((l) => {
    if (!exerciseCounts[l.exercise_name]) {
      exerciseCounts[l.exercise_name] = { count: 0, emoji: l.exercise_emoji, burned: 0 };
    }
    exerciseCounts[l.exercise_name].count++;
    exerciseCounts[l.exercise_name].burned += l.calories_burned;
  });
  const topExercises = Object.entries(exerciseCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5);

  useEffect(() => {
    fetchLogs(session?.user.id, isGuest);
    fetchExerciseLogs(session?.user.id, isGuest);
  }, [session?.user.id, isGuest]);

  const fetchSuggestions = async (forceRefresh = false) => {
    if (isGuest || !profile) return;
    setLoadingSuggestions(true);
    setSuggestionsError('');
    try {
      const text = await getNutritionSuggestions(recentLogs, profile, forceRefresh);
      setSuggestions(text);
    } catch {
      setSuggestionsError('Unable to load suggestions. Please try again.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (!isGuest && profile) fetchSuggestions();
  }, [isGuest, profile, recentLogs.length]);

  const calorieGoal = profile?.daily_calorie_target || 2000;
  const maxBarValue = Math.max(...weeklyData.map((d) => d.eaten), calorieGoal) + 200;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {isGuest && <GuestBanner />}
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>📊 Insights</Text>

        {/* 7-Day Calorie Chart */}
        <Animated.View entering={FadeInDown.springify()} style={styles.card}>
          <Text style={styles.cardTitle}>7-Day Calorie Overview</Text>
          <BarChart
            data={barChartData}
            barWidth={28}
            spacing={12}
            roundedTop
            hideRules
            xAxisThickness={0}
            yAxisThickness={0}
            yAxisTextStyle={styles.axisText}
            xAxisLabelTextStyle={styles.axisText}
            noOfSections={4}
            maxValue={maxBarValue}
            referenceLine1Position={calorieGoal}
            referenceLine1Config={{ color: Colors.secondary, dashWidth: 4, dashGap: 4, thickness: 1.5 }}
          />
          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendText}>Net calories</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.secondary, borderStyle: 'dashed', borderWidth: 1 }]} />
              <Text style={styles.legendText}>Daily goal</Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{avgEaten}</Text>
              <Text style={styles.statLabel}>Avg Eaten</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: Colors.success }]}>{avgBurned}</Text>
              <Text style={styles.statLabel}>Avg Burned</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: Colors.primary }]}>{avgNet}</Text>
              <Text style={styles.statLabel}>Avg Net</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, {
                color: avgNet <= calorieGoal ? Colors.success : Colors.error,
              }]}>
                {avgNet > 0 ? (avgNet <= calorieGoal ? `−${calorieGoal - avgNet}` : `+${avgNet - calorieGoal}`) : '—'}
              </Text>
              <Text style={styles.statLabel}>vs Goal</Text>
            </View>
          </View>
        </Animated.View>

        {/* Macro breakdown */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Macro Split</Text>
          {macroTotal > 0 ? (
            <View style={styles.pieContainer}>
              <PieChart
                data={macroPieData}
                radius={80}
                donut
                innerRadius={54}
                centerLabelComponent={() => (
                  <Text style={styles.pieCenter}>Macros</Text>
                )}
              />
              <View style={styles.pieLegend}>
                {macroPieData.map((item) => (
                  <View key={item.text} style={styles.pieLegendItem}>
                    <View style={[styles.pieDot, { backgroundColor: item.color }]} />
                    <Text style={styles.pieLegendText}>{item.text}: {item.value}%</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.noDataText}>Log some meals to see your macro breakdown</Text>
          )}
        </Animated.View>

        {/* Top foods */}
        {topFoods.length > 0 && (
          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.card}>
            <Text style={styles.cardTitle}>🍽️ Most Eaten Foods</Text>
            {topFoods.map(({ food, count }, i) => (
              <View key={food} style={styles.topRow}>
                <Text style={styles.topRank}>#{i + 1}</Text>
                <Text style={styles.topName}>{food}</Text>
                <View style={[styles.topBar, { width: `${(count / topFoods[0].count) * 55}%` }]} />
                <Text style={styles.topCount}>{count}x</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Top exercises */}
        {topExercises.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.card}>
            <Text style={styles.cardTitle}>🏃 Exercise Summary</Text>
            {topExercises.map(([name, { count, emoji, burned }]) => (
              <View key={name} style={styles.exerciseRow}>
                <Text style={styles.exerciseEmoji}>{emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{name}</Text>
                  <Text style={styles.exerciseSub}>{count} session{count > 1 ? 's' : ''}</Text>
                </View>
                <Text style={styles.exerciseBurned}>−{Math.round(burned)} cal</Text>
              </View>
            ))}
            <View style={styles.totalBurnedRow}>
              <Text style={styles.totalBurnedLabel}>Total calories burned this period</Text>
              <Text style={styles.totalBurnedValue}>
                {Math.round(exerciseLogs.reduce((s, l) => s + l.calories_burned, 0))} cal 🔥
              </Text>
            </View>
          </Animated.View>
        )}

        {/* AI Suggestions */}
        <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.card}>
          <View style={styles.suggestionHeader}>
            <Text style={styles.cardTitle}>🤖 AI Suggestions</Text>
            {!isGuest && (
              <TouchableOpacity onPress={() => fetchSuggestions(true)} disabled={loadingSuggestions}>
                <Text style={styles.refreshBtn}>Refresh 🔄</Text>
              </TouchableOpacity>
            )}
          </View>

          {!isGuest && (
            <View style={styles.citationsBox}>
              <Text style={styles.citationsTitle}>⚕️ Medical Disclaimer</Text>
              <Text style={styles.citationsText}>
                AI suggestions are for informational purposes only and are not a substitute for professional medical or dietary advice. Always consult a registered dietitian or qualified healthcare provider before making changes to your diet.
              </Text>
              <Text style={styles.citationsSubtitle}>Authoritative Nutrition Sources:</Text>
              {CITATION_SOURCES.map(({ label, url }) => (
                <TouchableOpacity key={url} onPress={() => Linking.openURL(url)} style={styles.citationRow}>
                  <Text style={styles.citationLink}>↗ {label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {isGuest ? (
            <View style={styles.guestTeaser}>
              <Text style={styles.guestTeaserEmoji}>🔒</Text>
              <Text style={styles.guestTeaserTitle}>Personalized AI Suggestions</Text>
              <Text style={styles.guestTeaserText}>
                Create a free account to unlock personalized nutrition and fitness advice powered by Claude AI.
              </Text>
              <TouchableOpacity
                style={styles.guestTeaserBtn}
                onPress={() => router.push('/(auth)/create-account')}
              >
                <Text style={styles.guestTeaserBtnText}>Create Free Account</Text>
              </TouchableOpacity>
            </View>
          ) : loadingSuggestions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.loadingText}>CaloriePal AI is analyzing your meals and workouts...</Text>
            </View>
          ) : suggestionsError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{suggestionsError}</Text>
              <TouchableOpacity onPress={() => fetchSuggestions(true)}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : suggestions ? (
            <SuggestionsDisplay markdown={suggestions} />
          ) : (
            <Text style={styles.noDataText}>
              Log some meals and workouts and we'll generate personalized suggestions! 🍽️🏃
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, paddingBottom: 100 },
  title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 24, color: Colors.text, marginBottom: 16 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: { fontFamily: 'Nunito_700Bold', fontSize: 17, color: Colors.text, marginBottom: 16 },
  axisText: { fontFamily: 'Nunito_400Regular', fontSize: 10, color: Colors.textLight },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 10, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textLight },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  statBox: { alignItems: 'center', gap: 4 },
  statNum: { fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: Colors.text },
  statLabel: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: Colors.textLight },
  pieContainer: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  pieCenter: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.textLight },
  pieLegend: { gap: 10, flex: 1 },
  pieLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pieDot: { width: 12, height: 12, borderRadius: 6 },
  pieLegendText: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: Colors.text },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  topRank: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.textLight, width: 24 },
  topName: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: Colors.text, flex: 1 },
  topBar: { height: 8, backgroundColor: Colors.secondary, borderRadius: 4 },
  topCount: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: Colors.textLight, width: 28, textAlign: 'right' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  exerciseEmoji: { fontSize: 24, width: 32 },
  exerciseName: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: Colors.text },
  exerciseSub: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textLight },
  exerciseBurned: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: Colors.success },
  totalBurnedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    marginTop: 4,
  },
  totalBurnedLabel: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: Colors.textLight, flex: 1 },
  totalBurnedValue: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: Colors.success },
  suggestionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  refreshBtn: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: Colors.secondary },
  guestTeaser: { alignItems: 'center', paddingVertical: 20 },
  guestTeaserEmoji: { fontSize: 48, marginBottom: 12 },
  guestTeaserTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: Colors.text, marginBottom: 8, textAlign: 'center' },
  guestTeaserText: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: Colors.textLight, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  guestTeaserBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  guestTeaserBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: Colors.textWhite },
  loadingContainer: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  loadingText: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: Colors.textLight, textAlign: 'center' },
  errorContainer: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  errorText: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: Colors.error, textAlign: 'center' },
  retryText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: Colors.primary },
  noDataText: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: Colors.textLight, textAlign: 'center', paddingVertical: 12, lineHeight: 22 },
  citationsBox: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#EAF6FF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#4ECDC4',
  },
  citationsTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: Colors.text, marginBottom: 8 },
  citationsText: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: Colors.text, lineHeight: 20, marginBottom: 12 },
  citationsSubtitle: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.text, marginBottom: 6 },
  citationRow: { paddingVertical: 4 },
  citationLink: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.secondary, textDecorationLine: 'underline', lineHeight: 22 },
});
