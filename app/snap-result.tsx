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

const LOADING_STEPS = [
  'Identifying ingredients...',
  'Estimating portion sizes...',
  'Calculating nutrition...',
  'Almost done...',
];

function LoadingView() {
  const pulse = useSharedValue(0.6);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 800 }), withTiming(0.6, { duration: 800 })),
      -1,
      false
    );
    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingEmoji}>🍽️</Text>
      <Text style={styles.loadingTitle}>Analyzing your meal...</Text>
      <Text style={styles.loadingSubtitle}>{LOADING_STEPS[stepIndex]}</Text>
      <View style={styles.loadingDots}>
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { backgroundColor: Colors.primary }]}
            entering={FadeIn.delay(i * 200)}
          />
        ))}
      </View>
      <View style={styles.loadingSteps}>
        {LOADING_STEPS.slice(0, -1).map((step, i) => (
          <View key={step} style={styles.loadingStep}>
            <View style={[styles.loadingStepDot, i <= stepIndex && styles.loadingStepDotDone]} />
            <Text style={[styles.loadingStepText, i <= stepIndex && styles.loadingStepTextDone]}>
              {step}
            </Text>
          </View>
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

    // Photo upload is best-effort — a failure here must not block meal saving
    let photoUrl: string | undefined;
    if (capturedPhotoUri && !isGuest && session && capturedPhotoBase64) {
      try {
        const logId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const fileName = `${session.user.id}/${logId}.jpg`;

        // Convert base64 to binary for upload (avoids fetch+blob issues on some platforms)
        const binary = atob(capturedPhotoBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const { error: uploadError } = await supabase.storage
          .from('meal-photos')
          .upload(fileName, bytes.buffer, { contentType: 'image/jpeg', upsert: false });

        if (!uploadError) {
          const { data } = supabase.storage.from('meal-photos').getPublicUrl(fileName);
          photoUrl = data.publicUrl;
        }
      } catch {
        // Photo upload failed — meal still saves without a photo
      }
    } else if (capturedPhotoUri && isGuest) {
      photoUrl = capturedPhotoUri;
    }

    try {
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
      Alert.alert('Error', e.message || 'Failed to save your meal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (analyzing) {
    return (
      <SafeAreaView style={styles.safe}>
        {capturedPhotoUri && (
          <Image source={{ uri: capturedPhotoUri }} style={styles.previewImage} blurRadius={2} accessibilityLabel="Meal photo preview" />
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
              <Image source={{ uri: capturedPhotoUri }} style={styles.photo} accessibilityLabel="Captured meal photo" />
            </Animated.View>
          )}

          {!error && (
            <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.aiDisclaimerBox}>
              <Text style={styles.aiDisclaimerTitle}>📷 How AI Estimates Calories from Your Photo</Text>
              <Text style={styles.aiDisclaimerBody}>
                CaloriePal uses <Text style={styles.aiDisclaimerBold}>GPT-4o Vision</Text> to analyze your photo through a multi-step process:
              </Text>

              {[
                { step: '1', label: 'Container size', detail: 'Identifies the vessel (small bowl, dinner plate, takeout box) and estimates its volume.' },
                { step: '2', label: 'Fill level', detail: 'Estimates how full it is — quarter, half, heaped — to gauge total volume.' },
                { step: '3', label: 'Depth & height', detail: 'A heaped bowl holds far more than a flat one; the AI accounts for vertical depth.' },
                { step: '4', label: 'Food density', detail: 'Dense foods (rice, meat, cheese) are calorie-heavy vs light foods (salad, broth).' },
                { step: '5', label: 'Each component', detail: 'Every visible ingredient is identified and its weight estimated individually.' },
              ].map(({ step, label, detail }) => (
                <View key={step} style={styles.aiStep}>
                  <View style={styles.aiStepBadge}>
                    <Text style={styles.aiStepNum}>{step}</Text>
                  </View>
                  <View style={styles.aiStepContent}>
                    <Text style={styles.aiStepLabel}>{label}</Text>
                    <Text style={styles.aiStepDetail}>{detail}</Text>
                  </View>
                </View>
              ))}

              <View style={styles.aiLimitationsBox}>
                <Text style={styles.aiLimitationsTitle}>⚠️ Known limitations</Text>
                {[
                  'Hidden ingredients (oil, butter, sauces) are often underestimated',
                  'Overlapping or covered foods are invisible to the AI',
                  'Estimates assume standard recipes — homemade meals vary widely',
                  'Accuracy is lower for complex or mixed dishes',
                  'Macro ratios (protein/carbs/fat) are approximated from typical recipes',
                ].map((item, i) => (
                  <Text key={i} style={styles.aiLimitationItem}>• {item}</Text>
                ))}
              </View>

              <Text style={styles.aiDisclaimerFooter}>
                Always review and correct the values below before logging. These are starting estimates, not precise measurements. For accurate tracking, weigh your food with a kitchen scale.
              </Text>
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
            <Text style={styles.cardTitle}>📝 Your Notes</Text>
            <Text style={styles.notesHint}>
              How did it taste? How did you feel after? Any tweaks next time?
            </Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Felt great after this meal! Next time less salt."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
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
  loadingSteps: { marginTop: 28, gap: 12, width: '100%', paddingHorizontal: 8 },
  loadingStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingStepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  loadingStepDotDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  loadingStepText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
  },
  loadingStepTextDone: { color: Colors.text, fontFamily: 'Nunito_700Bold' },
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
  aiDisclaimerBox: {
    backgroundColor: '#EAF6FF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
  },
  aiDisclaimerTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
  },
  aiDisclaimerBody: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 10,
  },
  aiDisclaimerBold: { fontFamily: 'Nunito_700Bold' },
  aiStep: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  aiStepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  aiStepNum: { fontFamily: 'Nunito_800ExtraBold', fontSize: 11, color: Colors.textWhite },
  aiStepContent: { flex: 1 },
  aiStepLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: Colors.text },
  aiStepDetail: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: Colors.textLight, lineHeight: 16, marginTop: 1 },
  aiLimitationsBox: {
    backgroundColor: '#FFF8E7',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  aiLimitationsTitle: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: Colors.text, marginBottom: 6 },
  aiLimitationItem: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: Colors.text, lineHeight: 18 },
  aiDisclaimerFooter: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: Colors.textLight,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  notesHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 8,
    fontStyle: 'italic',
  },
});
