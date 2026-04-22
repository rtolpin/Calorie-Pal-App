import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import Animated, { FadeIn, FadeInDown, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from '../lib/haptics';
import { useAuthStore } from '../store/authStore';
import { useFoodLogStore } from '../store/foodLogStore';
import { analyzeMealPhoto } from '../lib/openai';
import { supabase } from '../lib/supabase';
import { MealAnalysis } from '../types';
import { MacroBadge } from '../components/ui/MacroBadge';
import { Button } from '../components/ui/Button';
import { Colors } from '../constants/Colors';

const MACROS: { key: keyof MealAnalysis; label: string; unit: string; emoji: string; color: string }[] = [
  { key: 'protein_g', label: 'Protein', unit: 'g', emoji: '💪', color: Colors.protein },
  { key: 'carbs_g', label: 'Carbohydrates', unit: 'g', emoji: '🌾', color: Colors.carbs },
  { key: 'fat_g', label: 'Fat', unit: 'g', emoji: '🥑', color: Colors.fat },
  { key: 'fiber_g', label: 'Fiber', unit: 'g', emoji: '🥦', color: Colors.fiber },
  { key: 'sugar_g', label: 'Sugar', unit: 'g', emoji: '🍬', color: Colors.sugar },
  { key: 'sodium_mg', label: 'Sodium', unit: 'mg', emoji: '🧂', color: Colors.sodium },
  { key: 'cholesterol_mg', label: 'Cholesterol', unit: 'mg', emoji: '🫀', color: '#DDA0DD' },
  { key: 'saturated_fat_g', label: 'Saturated Fat', unit: 'g', emoji: '🧈', color: '#CD853F' },
];

function LoadingView() {
  const pulse = useSharedValue(0.6);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 800 }), withTiming(0.6, { duration: 800 })),
      -1,
      false
    );
  }, []);

  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingEmoji}>🍽️</Text>
      <Text style={styles.loadingTitle}>Analyzing your meal...</Text>
      <Text style={styles.loadingSubtitle}>CaloriePal is figuring out the nutrition info</Text>
      <View style={styles.loadingDots}>
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { backgroundColor: Colors.primary }]}
            entering={FadeIn.delay(i * 200)}
          />
        ))}
      </View>
    </View>
  );
}

export default function SnapResultScreen() {
  const { session, isGuest } = useAuthStore();
  const { capturedPhotoUri, capturedPhotoBase64, clearCapturedPhoto, addLog } = useFoodLogStore();

  const [analyzing, setAnalyzing] = useState(true);
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);

  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
  const [macroValues, setMacroValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [confirmedFoods, setConfirmedFoods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!capturedPhotoBase64) {
      router.back();
      return;
    }
    runAnalysis();
    return () => clearCapturedPhoto();
  }, []);

  const runAnalysis = async () => {
    try {
      const result = await analyzeMealPhoto(capturedPhotoBase64!);
      setAnalysis(result);
      populateFromAnalysis(result);
      setAnalyzing(false);
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
      setAnalyzing(false);
      setManualMode(true);
      populateDefaults();
    }
  };

  const populateFromAnalysis = (result: MealAnalysis) => {
    setMealName(result.meal_name);
    setCalories(String(result.total_calories));
    setConfirmedFoods(result.foods);
    const vals: Record<string, string> = {};
    MACROS.forEach((m) => { vals[m.key] = String((result as any)[m.key] || 0); });
    setMacroValues(vals);
  };

  const populateDefaults = () => {
    setMealName('My Meal');
    setCalories('0');
    const vals: Record<string, string> = {};
    MACROS.forEach((m) => { vals[m.key] = '0'; });
    setMacroValues(vals);
  };

  const toggleFood = (food: string) => {
    setConfirmedFoods((prev) =>
      prev.includes(food) ? prev.filter((f) => f !== food) : [...prev, food]
    );
  };

  const handleLog = async () => {
    if (!mealName.trim()) {
      Alert.alert('Missing Info', 'Please enter a meal name.');
      return;
    }

    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      let photoUrl: string | undefined;

      if (capturedPhotoUri && !isGuest && session) {
        const logId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const fileName = `${session.user.id}/${logId}.jpg`;

        const response = await fetch(capturedPhotoUri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        const { error: uploadError } = await supabase.storage
          .from('meal-photos')
          .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

        if (!uploadError) {
          const { data } = supabase.storage.from('meal-photos').getPublicUrl(fileName);
          photoUrl = data.publicUrl;
        }
      } else if (capturedPhotoUri && isGuest) {
        photoUrl = capturedPhotoUri;
      }

      await addLog(
        {
          user_id: session?.user.id,
          meal_name: mealName.trim(),
          photo_url: photoUrl,
          foods_detected: confirmedFoods,
          calories: parseFloat(calories) || 0,
          protein_g: parseFloat(macroValues.protein_g) || 0,
          carbs_g: parseFloat(macroValues.carbs_g) || 0,
          fat_g: parseFloat(macroValues.fat_g) || 0,
          fiber_g: parseFloat(macroValues.fiber_g) || 0,
          sugar_g: parseFloat(macroValues.sugar_g) || 0,
          sodium_mg: parseFloat(macroValues.sodium_mg) || 0,
          cholesterol_mg: parseFloat(macroValues.cholesterol_mg) || 0,
          saturated_fat_g: parseFloat(macroValues.saturated_fat_g) || 0,
          notes: notes.trim() || undefined,
          logged_at: new Date().toISOString(),
        },
        session?.user.id,
        isGuest
      );

      Alert.alert('Logged! ✅', `"${mealName}" has been added to your journal.`, [
        { text: 'Great!', onPress: () => router.replace('/(tabs)/') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to save your meal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (analyzing) {
    return (
      <SafeAreaView style={styles.safe}>
        {capturedPhotoUri && (
          <Image source={{ uri: capturedPhotoUri }} style={styles.previewImage} blurRadius={2} />
        )}
        <LoadingView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.screenTitle}>
              {error ? '✏️ Manual Entry' : '✅ Meal Analyzed!'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {error && (
            <Animated.View entering={FadeInDown.springify()} style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>
                CaloriePal couldn't quite make out that meal — let's enter it manually! ✏️
              </Text>
            </Animated.View>
          )}

          {capturedPhotoUri && (
            <Animated.View entering={FadeIn} style={styles.photoContainer}>
              <Image source={{ uri: capturedPhotoUri }} style={styles.photo} />
            </Animated.View>
          )}

          {analysis?.foods && analysis.foods.length > 0 && !manualMode && (
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.foodsCard}>
              <Text style={styles.cardTitle}>Detected Foods (tap to remove)</Text>
              <View style={styles.foodTags}>
                {analysis.foods.map((food) => (
                  <TouchableOpacity
                    key={food}
                    style={[
                      styles.foodTag,
                      confirmedFoods.includes(food) ? styles.foodTagActive : styles.foodTagInactive,
                    ]}
                    onPress={() => toggleFood(food)}
                  >
                    <Text style={[
                      styles.foodTagText,
                      !confirmedFoods.includes(food) && styles.foodTagTextInactive,
                    ]}>
                      {food}
                    </Text>
                    {!confirmedFoods.includes(food) && (
                      <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.card}>
            <Text style={styles.cardTitle}>Meal Details</Text>

            <Text style={styles.fieldLabel}>Meal Name</Text>
            <TextInput
              style={styles.nameInput}
              value={mealName}
              onChangeText={setMealName}
              placeholder="e.g. Grilled Chicken Salad"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.fieldLabel}>Total Calories</Text>
            <View style={styles.calorieRow}>
              <TextInput
                style={styles.calorieInput}
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.calorieUnit}>cal</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.card}>
            <Text style={styles.cardTitle}>Macro Breakdown</Text>
            {MACROS.map((macro) => (
              <View key={macro.key} style={styles.macroInputRow}>
                <Text style={styles.macroEmoji}>{macro.emoji}</Text>
                <Text style={styles.macroLabel}>{macro.label}</Text>
                <TextInput
                  style={[styles.macroInput, { borderColor: macro.color + '66' }]}
                  value={macroValues[macro.key] || '0'}
                  onChangeText={(v) => setMacroValues((prev) => ({ ...prev, [macro.key]: v }))}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={styles.macroUnit}>{macro.unit}</Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.card}>
            <Text style={styles.cardTitle}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about this meal..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <Button
              title="✅ Log This Meal"
              gradient
              size="lg"
              loading={saving}
              onPress={handleLog}
              style={styles.logBtn}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => router.back()}
              style={styles.cancelBtn}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  previewImage: { ...StyleSheet.absoluteFillObject, opacity: 0.3 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  loadingEmoji: { fontSize: 72 },
  loadingTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: Colors.text,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: Colors.textLight,
    textAlign: 'center',
  },
  loadingDots: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  container: { padding: 16, paddingBottom: 40 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: Colors.text,
  },
  errorBanner: {
    backgroundColor: Colors.accent3,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorBannerText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  photoContainer: { marginBottom: 16 },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: Colors.border,
  },
  foodsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: Colors.text,
    marginBottom: 12,
  },
  foodTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foodTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  foodTagActive: {
    backgroundColor: Colors.secondary + '22',
    borderColor: Colors.secondary,
  },
  foodTagInactive: {
    backgroundColor: Colors.borderLight,
    borderColor: Colors.border,
  },
  foodTagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.text,
  },
  foodTagTextInactive: { color: Colors.textMuted },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  fieldLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.text,
    marginBottom: 6,
  },
  nameInput: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calorieInput: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    color: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.primary + '55',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
    textAlign: 'center',
  },
  calorieUnit: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    color: Colors.textLight,
  },
  macroInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  macroEmoji: { fontSize: 18, width: 24 },
  macroLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  macroInput: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 70,
    textAlign: 'center',
  },
  macroUnit: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textLight,
    width: 22,
  },
  notesInput: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  logBtn: { marginBottom: 12 },
  cancelBtn: {},
});
