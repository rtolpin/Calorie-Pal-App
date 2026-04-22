import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { calculateDailyCalorieTarget } from '../../lib/tdee';
import { ActivityLevel, Goal } from '../../types';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

const GOALS: { value: Goal; label: string; emoji: string; desc: string }[] = [
  { value: 'lose_weight', label: 'Lose Weight', emoji: '🔥', desc: 'Burn fat with a calorie deficit' },
  { value: 'maintain', label: 'Maintain', emoji: '⚖️', desc: 'Stay at your current weight' },
  { value: 'gain_muscle', label: 'Gain Muscle', emoji: '💪', desc: 'Build strength with a surplus' },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
  { value: 'lightly_active', label: 'Lightly Active', desc: '1–3 days/week exercise' },
  { value: 'active', label: 'Active', desc: '3–5 days/week exercise' },
  { value: 'very_active', label: 'Very Active', desc: '6–7 days/week exercise' },
];

export default function OnboardingScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { session, setProfile } = useAuthStore();
  const [step, setStep] = useState(0);
  const [age, setAge] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('lbs');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('ft');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [goal, setGoal] = useState<Goal>('maintain');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('lightly_active');
  const [customCalories, setCustomCalories] = useState('');
  const [loading, setLoading] = useState(false);

  const steps = ['goals', 'stats', 'activity', 'calories'] as const;
  const currentStep = steps[step];
  const progress = (step + 1) / steps.length;

  const weightInKg = (): number => {
    const val = parseFloat(weightInput) || 0;
    return weightUnit === 'lbs' ? val * 0.453592 : val;
  };

  const heightInCm = (): number => {
    if (heightUnit === 'cm') return parseFloat(heightCm) || 0;
    const ft = parseFloat(heightFt) || 0;
    const inches = parseFloat(heightIn) || 0;
    return (ft * 12 + inches) * 2.54;
  };

  const getRecommendedCalories = (): number => {
    const w = weightInKg() || 70;
    const h = heightInCm() || 170;
    const a = parseInt(age) || 30;
    return calculateDailyCalorieTarget(w, h, a, activityLevel, goal);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const dailyCalories = customCalories ? parseInt(customCalories) : getRecommendedCalories();

      const profileData = {
        id: session?.user.id,
        name: name || 'User',
        age: parseInt(age) || null,
        weight_kg: weightInKg() || null,
        height_cm: heightInCm() || null,
        goal,
        activity_level: activityLevel,
        daily_calorie_target: dailyCalories,
        protein_target_pct: 30,
        carbs_target_pct: 40,
        fat_target_pct: 30,
        notification_enabled: true,
        notification_time: '19:00',
        email: session?.user.email,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(profileData)
        .select()
        .single();

      if (error) throw error;
      setProfile(data as any);
      router.replace('/(tabs)/');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save profile. You can update this later in Settings.');
      router.replace('/(tabs)/');
    } finally {
      setLoading(false);
    }
  };

  const SelectButton = ({
    label,
    desc,
    emoji,
    selected,
    onPress,
  }: {
    label: string;
    desc?: string;
    emoji?: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.selectBtn, selected && styles.selectBtnActive]}
      onPress={onPress}
    >
      {emoji && <Text style={styles.selectEmoji}>{emoji}</Text>}
      <View style={{ flex: 1 }}>
        <Text style={[styles.selectLabel, selected && styles.selectLabelActive]}>{label}</Text>
        {desc && <Text style={styles.selectDesc}>{desc}</Text>}
      </View>
      {selected && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.stepText}>Step {step + 1} of {steps.length}</Text>
        </View>

        <Text style={styles.greeting}>Hey {name || 'there'}! 👋</Text>

        {currentStep === 'goals' && (
          <Animated.View entering={FadeInRight.springify()}>
            <Text style={styles.title}>What's your goal?</Text>
            <Text style={styles.subtitle}>We'll tailor your daily targets to match</Text>
            {GOALS.map((g) => (
              <SelectButton
                key={g.value}
                label={g.label}
                desc={g.desc}
                emoji={g.emoji}
                selected={goal === g.value}
                onPress={() => setGoal(g.value)}
              />
            ))}
          </Animated.View>
        )}

        {currentStep === 'stats' && (
          <Animated.View entering={FadeInRight.springify()}>
            <Text style={styles.title}>Tell us about yourself</Text>
            <Text style={styles.subtitle}>
              This helps calculate your personalized calorie targets (optional)
            </Text>
            <Input label="Age" value={age} onChangeText={setAge} placeholder="e.g. 28" keyboardType="numeric" />
            <View style={styles.weightRow}>
              <View style={{ flex: 1 }}>
                <Input
                  label={`Weight (${weightUnit})`}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  placeholder={weightUnit === 'lbs' ? 'e.g. 154' : 'e.g. 70'}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.unitToggle}>
                {(['lbs', 'kg'] as const).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitBtn, weightUnit === u && styles.unitBtnActive]}
                    onPress={() => setWeightUnit(u)}
                  >
                    <Text style={[styles.unitBtnText, weightUnit === u && styles.unitBtnTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.weightRow}>
              <View style={{ flex: 1 }}>
                {heightUnit === 'cm' ? (
                  <Input
                    label="Height (cm)"
                    value={heightCm}
                    onChangeText={setHeightCm}
                    placeholder="e.g. 170"
                    keyboardType="numeric"
                  />
                ) : (
                  <View>
                    <Text style={styles.inputLabel}>Height</Text>
                    <View style={styles.ftInRow}>
                      <View style={styles.ftField}>
                        <TextInput
                          style={styles.ftInput}
                          value={heightFt}
                          onChangeText={setHeightFt}
                          placeholder="5"
                          keyboardType="numeric"
                          placeholderTextColor={Colors.textMuted}
                        />
                        <Text style={styles.ftUnit}>ft</Text>
                      </View>
                      <View style={styles.ftField}>
                        <TextInput
                          style={styles.ftInput}
                          value={heightIn}
                          onChangeText={setHeightIn}
                          placeholder="6"
                          keyboardType="numeric"
                          placeholderTextColor={Colors.textMuted}
                        />
                        <Text style={styles.ftUnit}>in</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
              <View style={styles.unitToggle}>
                {(['ft', 'cm'] as const).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitBtn, heightUnit === u && styles.unitBtnActive]}
                    onPress={() => setHeightUnit(u)}
                  >
                    <Text style={[styles.unitBtnText, heightUnit === u && styles.unitBtnTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {currentStep === 'activity' && (
          <Animated.View entering={FadeInRight.springify()}>
            <Text style={styles.title}>How active are you?</Text>
            <Text style={styles.subtitle}>Pick the option that best describes your typical week</Text>
            {ACTIVITY_LEVELS.map((a) => (
              <SelectButton
                key={a.value}
                label={a.label}
                desc={a.desc}
                selected={activityLevel === a.value}
                onPress={() => setActivityLevel(a.value)}
              />
            ))}
          </Animated.View>
        )}

        {currentStep === 'calories' && (
          <Animated.View entering={FadeInRight.springify()}>
            <Text style={styles.title}>Your daily calorie target 🎯</Text>
            <Text style={styles.subtitle}>
              Based on your info, we recommend:
            </Text>
            <View style={styles.recommendedCard}>
              <Text style={styles.recommendedCalories}>{getRecommendedCalories()}</Text>
              <Text style={styles.recommendedLabel}>calories per day</Text>
            </View>
            <Text style={styles.customLabel}>Or set a custom target:</Text>
            <Input
              value={customCalories}
              onChangeText={setCustomCalories}
              placeholder={String(getRecommendedCalories())}
              keyboardType="numeric"
              leftIcon="flame-outline"
            />
            <Text style={styles.macroNote}>
              Default macro split: 30% Protein · 40% Carbs · 30% Fat{'\n'}
              (You can adjust this anytime in Profile settings)
            </Text>
          </Animated.View>
        )}

        <View style={styles.navButtons}>
          {step > 0 && (
            <Button title="Back" variant="outline" onPress={() => setStep(step - 1)} style={styles.backBtn} />
          )}
          {step < steps.length - 1 ? (
            <Button
              title="Continue"
              gradient
              onPress={() => setStep(step + 1)}
              style={styles.navBtn}
            />
          ) : (
            <Button
              title="Let's Go! 🚀"
              gradient
              loading={loading}
              onPress={handleFinish}
              style={styles.navBtn}
            />
          )}
        </View>

        {step === 0 && (
          <TouchableOpacity onPress={() => router.replace('/(tabs)/')}>
            <Text style={styles.skip}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24 },
  progressContainer: { marginBottom: 28 },
  progressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  stepText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'right',
  },
  greeting: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 24,
    color: Colors.primary,
    marginBottom: 4,
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: Colors.textLight,
    marginBottom: 20,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  selectBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  selectEmoji: { fontSize: 28 },
  selectLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  selectLabelActive: { color: Colors.primary },
  selectDesc: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  checkmark: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    color: Colors.primary,
  },
  recommendedCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  recommendedCalories: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 52,
    color: Colors.textWhite,
  },
  recommendedLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
  },
  customLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
  },
  macroNote: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  inputLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 6,
  },
  ftInRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  ftField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
  },
  ftInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: Colors.text,
  },
  ftUnit: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.textLight,
  },
  weightRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  unitToggle: {
    flexDirection: 'column',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  unitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  unitBtnActive: { backgroundColor: Colors.primary },
  unitBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.textLight },
  unitBtnTextActive: { color: Colors.textWhite },
  navButtons: { flexDirection: 'row', gap: 12, marginTop: 32, marginBottom: 16 },
  navBtn: { flex: 1 },
  backBtn: { paddingHorizontal: 8 },
  skip: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
