import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { GuestBanner } from '../../components/GuestBanner';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { calculateDailyCalorieTarget, WeightLossRate, WEIGHT_LOSS_DEFICITS } from '../../lib/tdee';
import {
  requestNotificationPermissions,
  scheduleDailyReminder,
  cancelDailyReminder,
} from '../../lib/notifications';
import { getTimeFormat, saveTimeFormat } from '../../lib/asyncStorage';
import {
  parseNotifTime, buildNotifTime,
  formatDisplayHour, isAmHour, toggleAmPm,
  adjustHour, adjustMinute,
} from '../../lib/timeUtils';
import { Colors } from '../../constants/Colors';
import { Gender, Goal, ActivityLevel } from '../../types';

const GOALS: { value: Goal; label: string; emoji: string; desc: string }[] = [
  { value: 'lose_weight', label: 'Lose Weight', emoji: '🔥', desc: 'Calorie deficit to burn fat' },
  { value: 'maintain', label: 'Maintain', emoji: '⚖️', desc: 'Balance intake & expenditure' },
  { value: 'gain_muscle', label: 'Gain Muscle', emoji: '💪', desc: 'Surplus to support growth' },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
  { value: 'lightly_active', label: 'Lightly Active', desc: '1–3 days/week' },
  { value: 'active', label: 'Active', desc: '3–5 days/week' },
  { value: 'very_active', label: 'Very Active', desc: '6–7 days/week' },
];

const GOAL_CONTEXT: Record<Goal, { headline: string; detail: string; tips: string[] }> = {
  lose_weight: {
    headline: '~0.5 kg (1 lb) fat loss per week',
    detail:
      'A 500 cal/day deficit creates a weekly shortfall of ~3,500 calories, which corresponds to roughly 0.5 kg (1 lb) of fat. Losing weight slower than this is also healthy and sustainable.',
    tips: [
      'Aim for ≥ 1.6 g protein per kg of body weight to preserve muscle',
      'Prioritise whole foods and fibre to stay full on fewer calories',
      'Pair your deficit with strength training to maintain muscle mass',
      'Avoid dropping below 1,200 cal/day without medical supervision',
    ],
  },
  maintain: {
    headline: 'Balance calories in and out',
    detail:
      'Maintenance calories equal your Total Daily Energy Expenditure (TDEE). Eating at this level keeps your weight stable over time.',
    tips: [
      'Focus on nutrient density — vitamins, minerals, and fibre matter as much as calories',
      'Track protein to support muscle health and satiety',
      'Allow ±10% daily variation — it all averages out over the week',
      'Regular exercise helps keep your metabolism active',
    ],
  },
  gain_muscle: {
    headline: '~0.25–0.5 kg (0.5–1 lb) muscle per month',
    detail:
      'A modest 300 cal/day surplus provides energy for muscle synthesis without excessive fat gain. Natural muscle growth is slow — patience and consistent training matter most.',
    tips: [
      'Aim for 1.8–2.2 g protein per kg of body weight daily',
      'Focus on progressive overload in resistance training',
      'Prioritise sleep — most muscle repair happens at night',
      'Track strength gains, not just the scale',
    ],
  },
};

function MacroSlider({
  label,
  value,
  color,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.sliderRow}>
      <View style={[styles.sliderDot, { backgroundColor: color }]} />
      <Text style={styles.sliderLabel}>{label}</Text>
      <View style={styles.sliderControls}>
        <TouchableOpacity onPress={() => onChange(Math.max(10, value - 5))} style={styles.sliderBtn}>
          <Ionicons name="remove" size={16} color={Colors.text} />
        </TouchableOpacity>
        <Text style={[styles.sliderValue, { color }]}>{value}%</Text>
        <TouchableOpacity onPress={() => onChange(Math.min(80, value + 5))} style={styles.sliderBtn}>
          <Ionicons name="add" size={16} color={Colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { session, profile, isGuest, updateProfile, signOut } = useAuthStore();
  const { logs, clearLogs } = useFoodLogStore();

  // ── Unit preferences ──────────────────────────────────────────────────────
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('lbs');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('ft');

  // ── Editable profile fields ───────────────────────────────────────────────
  const [selectedGender, setSelectedGender] = useState<Gender>(profile?.gender || 'other');
  const [selectedGoal, setSelectedGoal] = useState<Goal>(profile?.goal || 'maintain');
  const [weightLossRate, setWeightLossRate] = useState<WeightLossRate>(1);
  const [selectedActivity, setSelectedActivity] = useState<ActivityLevel>(
    profile?.activity_level || 'lightly_active'
  );
  const [weightInput, setWeightInput] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  // ── Daily targets ─────────────────────────────────────────────────────────
  const [calorieGoal, setCalorieGoal] = useState(String(profile?.daily_calorie_target || 2000));
  const [proteinPct, setProteinPct] = useState(profile?.protein_target_pct || 30);
  const [carbsPct, setCarbsPct] = useState(profile?.carbs_target_pct || 40);
  const [fatPct, setFatPct] = useState(profile?.fat_target_pct || 30);
  const [notificationsOn, setNotificationsOn] = useState(profile?.notification_enabled || false);
  const [notifHour, setNotifHour] = useState(19);
  const [notifMinute, setNotifMinute] = useState(0);
  const [timeFormat, setTimeFormatState] = useState<'12h' | '24h'>('12h');
  const [saving, setSaving] = useState(false);

  // ── Time picker helpers ───────────────────────────────────────────────────
  const notifTime = buildNotifTime(notifHour, notifMinute);
  const displayHour = formatDisplayHour(notifHour, timeFormat);
  const displayMinute = String(notifMinute).padStart(2, '0');
  const isAm = isAmHour(notifHour);

  const handleSetTimeFormat = async (fmt: '12h' | '24h') => {
    setTimeFormatState(fmt);
    await saveTimeFormat(fmt);
  };

  const macroTotal = proteinPct + carbsPct + fatPct;
  const macroValid = macroTotal === 100;

  // Populate fields from profile on load
  useEffect(() => {
    if (!profile) return;
    setSelectedGender(profile.gender || 'other');
    setSelectedGoal(profile.goal || 'maintain');
    setSelectedActivity(profile.activity_level || 'lightly_active');
    setCalorieGoal(String(profile.daily_calorie_target));
    setProteinPct(profile.protein_target_pct);
    setCarbsPct(profile.carbs_target_pct);
    setFatPct(profile.fat_target_pct);
    setNotificationsOn(profile.notification_enabled);
    const { hour, minute } = parseNotifTime(profile.notification_time || '19:00');
    setNotifHour(hour);
    setNotifMinute(minute);
    getTimeFormat().then(setTimeFormatState);

    if (profile.weight_kg) {
      setWeightInput(
        weightUnit === 'lbs'
          ? String(Math.round(profile.weight_kg * 2.20462))
          : String(profile.weight_kg)
      );
    }
    if (profile.height_cm) {
      const totalIn = profile.height_cm / 2.54;
      setHeightFt(String(Math.floor(totalIn / 12)));
      setHeightIn(String(Math.round(totalIn % 12)));
      setHeightCm(String(Math.round(profile.height_cm)));
    }
    if (profile.age) setAgeInput(String(profile.age));
  }, [profile]);

  // Reformat weight when unit changes
  useEffect(() => {
    if (!profile?.weight_kg) return;
    setWeightInput(
      weightUnit === 'lbs'
        ? String(Math.round(profile.weight_kg * 2.20462))
        : String(profile.weight_kg)
    );
  }, [weightUnit]);

  // ── Live TDEE recalculation ───────────────────────────────────────────────
  const recommendedCalories = useMemo(() => {
    const weightKg =
      weightUnit === 'lbs'
        ? (parseFloat(weightInput) || 0) * 0.453592
        : parseFloat(weightInput) || 0;
    const heightCmVal =
      heightUnit === 'ft'
        ? (parseFloat(heightFt) || 0) * 30.48 + (parseFloat(heightIn) || 0) * 2.54
        : parseFloat(heightCm) || 0;
    const age = parseInt(ageInput) || 0;
    if (!weightKg || !heightCmVal || !age) return null;
    return calculateDailyCalorieTarget(weightKg, heightCmVal, age, selectedActivity, selectedGoal, weightLossRate, selectedGender);
  }, [weightInput, heightFt, heightIn, heightCm, ageInput, selectedActivity, selectedGoal, weightLossRate, weightUnit, heightUnit, selectedGender]);

  // ── Save handlers ─────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (isGuest) return;
    setProfileSaving(true);
    try {
      const weightKg =
        weightUnit === 'lbs'
          ? (parseFloat(weightInput) || 0) * 0.453592
          : parseFloat(weightInput) || 0;
      const heightCmVal =
        heightUnit === 'ft'
          ? (parseFloat(heightFt) || 0) * 30.48 + (parseFloat(heightIn) || 0) * 2.54
          : parseFloat(heightCm) || 0;

      await updateProfile({
        gender: selectedGender,
        goal: selectedGoal,
        activity_level: selectedActivity,
        weight_kg: weightKg || undefined,
        height_cm: heightCmVal || undefined,
        age: parseInt(ageInput) || undefined,
      });
      Alert.alert('Saved! ✅', 'Your profile has been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePickProfilePhoto = async () => {
    if (isGuest) {
      Alert.alert('Sign In Required', 'Create an account to add a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Error', 'Could not read image data. Please try again.');
      return;
    }
    if (!session) return;

    setAvatarLoading(true);
    try {
      // Path must start with the user's own ID to satisfy RLS policies
      const fileName = `${session.user.id}/profile.jpg`;
      const binary = atob(asset.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const { error: uploadError } = await supabase.storage
        .from('meal-photos')
        .upload(fileName, bytes.buffer, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('meal-photos').getPublicUrl(fileName);
      await updateProfile({ avatar_url: data.publicUrl });
    } catch (e: any) {
      Alert.alert('Upload Failed', e?.message || 'Failed to upload profile photo. Please try again.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleApplyRecommended = () => {
    if (!recommendedCalories) return;
    setCalorieGoal(String(recommendedCalories));
    Alert.alert(
      'Calorie Target Updated',
      `Your daily target has been set to ${recommendedCalories} cal based on your profile. Tap "Save Targets" to apply.`
    );
  };

  const handleSaveTargets = async () => {
    if (!macroValid) {
      Alert.alert('Invalid Macros', 'Protein + Carbs + Fat must equal 100%');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        daily_calorie_target: parseInt(calorieGoal) || 2000,
        protein_target_pct: proteinPct,
        carbs_target_pct: carbsPct,
        fat_target_pct: fatPct,
        notification_enabled: notificationsOn,
        notification_time: notifTime,
      });
      Alert.alert('Saved! ✅', 'Your targets have been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save targets. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          'Permission Needed',
          'Please enable notifications in your iPhone Settings to receive daily reminders.'
        );
        return;
      }
      await scheduleDailyReminder(notifTime);
    } else {
      await cancelDailyReminder();
    }
    setNotificationsOn(enabled);
    if (!isGuest) updateProfile({ notification_enabled: enabled });
  };

  const handleExportCSV = async () => {
    const header = 'Date,Meal,Calories,Protein(g),Carbs(g),Fat(g),Fiber(g),Sugar(g),Sodium(mg)\n';
    const rows = logs
      .map((l) =>
        [
          new Date(l.logged_at).toLocaleDateString(),
          `"${l.meal_name}"`,
          l.calories,
          l.protein_g,
          l.carbs_g,
          l.fat_g,
          l.fiber_g,
          l.sugar_g,
          l.sodium_mg,
        ].join(',')
      )
      .join('\n');
    await Share.share({ message: header + rows, title: 'CaloriePal Food Journal' });
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          clearLogs();
          await signOut();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const handleChangePassword = async () => {
    const userEmail = session?.user.email;
    if (!userEmail) return;
    Alert.alert(
      'Change Password',
      `We'll send a password reset link to ${userEmail}. Check your inbox to set a new password.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Reset Email',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(userEmail);
              if (error) throw error;
              Alert.alert('Email Sent ✉️', `A password reset link has been sent to ${userEmail}.`);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not send reset email. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ Delete Account',
      'This will permanently delete all your meal logs, exercise logs, and profile data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Are you absolutely sure?',
              'All your data will be erased immediately. Your account login will be deactivated within 24 hours.',
              [
                { text: 'Go Back', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const uid = session?.user.id;
                      if (uid) {
                        // Delete all user data — food logs, exercise logs, profile
                        await supabase.from('food_logs').delete().eq('user_id', uid);
                        await supabase.from('exercise_logs').delete().eq('user_id', uid);
                        await supabase.from('profiles').delete().eq('id', uid);
                      }
                      clearLogs();
                      await signOut();
                      router.replace('/(auth)/welcome');
                      Alert.alert(
                        'Account Deleted',
                        'All your data has been deleted. Your login credentials will be fully removed within 24 hours. Thank you for using CaloriePal.'
                      );
                    } catch {
                      Alert.alert('Error', 'Failed to delete account data. Please try again or contact support@caloriepal.app.');
                    }
                  },
                },
              ]
            ),
        },
      ]
    );
  };

  const initials = profile?.name
    ? profile.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : isGuest
    ? 'G'
    : '?';

  const goalCtx = GOAL_CONTEXT[selectedGoal];
  const currentCalories = parseInt(calorieGoal) || 2000;
  const proteinGrams = Math.round((currentCalories * (proteinPct / 100)) / 4);
  const carbsGrams = Math.round((currentCalories * (carbsPct / 100)) / 4);
  const fatGrams = Math.round((currentCalories * (fatPct / 100)) / 9);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {isGuest && <GuestBanner />}
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>👤 Profile</Text>

        {/* ── Avatar card ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.profileCard}>
          <TouchableOpacity onPress={handlePickProfilePhoto} style={styles.avatarWrapper}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} accessibilityLabel="Your profile photo" />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            {!isGuest && (
              <View style={styles.avatarCameraBadge}>
                {avatarLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.avatarCameraIcon}>📷</Text>
                )}
              </View>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>
              {isGuest ? 'Guest User' : profile?.name || 'User'}
            </Text>
            <Text style={styles.profileEmail}>
              {isGuest ? 'Not signed in' : session?.user.email || ''}
            </Text>
            {!isGuest && (
              <Text style={styles.avatarHint}>Tap photo to change</Text>
            )}
          </View>
        </Animated.View>

        {/* ── Editable goals & stats ──────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.card}>
          <Text style={styles.sectionTitle}>🎯 My Fitness Goal</Text>
          <View style={styles.goalGrid}>
            {GOALS.map((g) => (
              <TouchableOpacity
                key={g.value}
                style={[styles.goalBtn, selectedGoal === g.value && styles.goalBtnActive]}
                onPress={() => setSelectedGoal(g.value)}
                disabled={isGuest}
              >
                <Text style={styles.goalEmoji}>{g.emoji}</Text>
                <Text style={[styles.goalLabel, selectedGoal === g.value && styles.goalLabelActive]}>
                  {g.label}
                </Text>
                <Text style={styles.goalDesc}>{g.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedGoal === 'lose_weight' && (
            <View style={styles.lossRateSection}>
              <Text style={styles.lossRateTitle}>📉 Weight Loss Rate</Text>
              <Text style={styles.lossRateSubtitle}>
                Choose how aggressively you want to lose weight. Slower is more sustainable and preserves more muscle.
              </Text>
              <View style={styles.lossRateGrid}>
                {([
                  { rate: 1 as WeightLossRate, label: '1 lb / week', deficit: '−500 cal/day', tag: 'Recommended', tagColor: Colors.success },
                  { rate: 1.5 as WeightLossRate, label: '1.5 lb / week', deficit: '−750 cal/day', tag: 'Moderate', tagColor: Colors.warning },
                  { rate: 2 as WeightLossRate, label: '2 lb / week', deficit: '−1,000 cal/day', tag: 'Aggressive', tagColor: Colors.error },
                ]).map(({ rate, label, deficit, tag, tagColor }) => (
                  <TouchableOpacity
                    key={rate}
                    style={[styles.lossRateBtn, weightLossRate === rate && styles.lossRateBtnActive]}
                    onPress={() => setWeightLossRate(rate)}
                    disabled={isGuest}
                  >
                    <View style={[styles.lossRateTag, { backgroundColor: tagColor + '22', borderColor: tagColor }]}>
                      <Text style={[styles.lossRateTagText, { color: tagColor }]}>{tag}</Text>
                    </View>
                    <Text style={[styles.lossRateLabel, weightLossRate === rate && styles.lossRateLabelActive]}>
                      {label}
                    </Text>
                    <Text style={styles.lossRateDeficit}>{deficit}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.lossRateWarning}>
                <Text style={styles.lossRateWarningText}>
                  ⚠️ Losing more than 1–1.5 lb/week increases risk of muscle loss, nutritional deficiencies, and metabolic slowdown. A deficit below 1,200 cal/day is not recommended without medical supervision. Consult your physician or a registered dietitian before pursuing aggressive weight loss, especially if you have a medical condition, take medications, or are pregnant.
                </Text>
              </View>
            </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>🏃 Activity Level</Text>
          <View style={styles.activityGrid}>
            {ACTIVITY_LEVELS.map((a) => (
              <TouchableOpacity
                key={a.value}
                style={[styles.activityBtn, selectedActivity === a.value && styles.activityBtnActive]}
                onPress={() => setSelectedActivity(a.value)}
                disabled={isGuest}
              >
                <Text
                  style={[
                    styles.activityLabel,
                    selectedActivity === a.value && styles.activityLabelActive,
                  ]}
                >
                  {a.label}
                </Text>
                <Text style={styles.activityDesc}>{a.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>⚥ Biological Sex</Text>
          <Text style={styles.statsHint}>Used in the Mifflin-St Jeor BMR equation for accurate calorie targets.</Text>
          <View style={styles.genderRow}>
            {([
              { value: 'male',   label: '♂ Male' },
              { value: 'female', label: '♀ Female' },
              { value: 'other',  label: '⚧ Other' },
            ] as { value: Gender; label: string }[]).map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[styles.genderBtn, selectedGender === value && styles.genderBtnActive]}
                onPress={() => setSelectedGender(value)}
                disabled={isGuest}
              >
                <Text style={[styles.genderBtnText, selectedGender === value && styles.genderBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>📏 Physical Stats</Text>
          <Text style={styles.statsHint}>
            Used to calculate your personalised calorie target via the Mifflin-St Jeor equation.
          </Text>

          {/* Weight */}
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>Weight</Text>
            <View style={styles.statRowInput}>
              <TextInput
                style={styles.statInput}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="numeric"
                placeholder={weightUnit === 'lbs' ? '154' : '70'}
                placeholderTextColor={Colors.textMuted}
                editable={!isGuest}
              />
              <Text style={styles.statUnit}>{weightUnit}</Text>
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

          {/* Height */}
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>Height</Text>
            {heightUnit === 'ft' ? (
              <View style={styles.statRowInput}>
                <TextInput
                  style={[styles.statInput, { width: 52 }]}
                  value={heightFt}
                  onChangeText={setHeightFt}
                  keyboardType="numeric"
                  placeholder="5"
                  placeholderTextColor={Colors.textMuted}
                  editable={!isGuest}
                />
                <Text style={styles.statUnit}>ft</Text>
                <TextInput
                  style={[styles.statInput, { width: 52, marginLeft: 6 }]}
                  value={heightIn}
                  onChangeText={setHeightIn}
                  keyboardType="numeric"
                  placeholder="8"
                  placeholderTextColor={Colors.textMuted}
                  editable={!isGuest}
                />
                <Text style={styles.statUnit}>in</Text>
              </View>
            ) : (
              <View style={styles.statRowInput}>
                <TextInput
                  style={styles.statInput}
                  value={heightCm}
                  onChangeText={setHeightCm}
                  keyboardType="numeric"
                  placeholder="172"
                  placeholderTextColor={Colors.textMuted}
                  editable={!isGuest}
                />
                <Text style={styles.statUnit}>cm</Text>
              </View>
            )}
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

          {/* Age */}
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>Age</Text>
            <View style={styles.statRowInput}>
              <TextInput
                style={styles.statInput}
                value={ageInput}
                onChangeText={setAgeInput}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor={Colors.textMuted}
                editable={!isGuest}
              />
              <Text style={styles.statUnit}>yrs</Text>
            </View>
          </View>

          {/* Live TDEE result */}
          {recommendedCalories && (
            <View style={styles.tdeeBox}>
              <View style={styles.tdeeRow}>
                <View>
                  <Text style={styles.tdeeLabel}>Recommended daily target</Text>
                  <Text style={styles.tdeeCalories}>{recommendedCalories} cal / day</Text>
                  <Text style={styles.tdeeGoal}>
                    {GOALS.find((g) => g.value === selectedGoal)?.emoji}{' '}
                    {GOALS.find((g) => g.value === selectedGoal)?.label}
                  </Text>
                </View>
                <TouchableOpacity style={styles.applyBtn} onPress={handleApplyRecommended}>
                  <Text style={styles.applyBtnText}>Apply ↓</Text>
                </TouchableOpacity>
              </View>
              {selectedGoal === 'lose_weight' && (
                <Text style={styles.tdeeDeficitNote}>
                  Includes a {WEIGHT_LOSS_DEFICITS[weightLossRate]} cal/day deficit targeting ~{weightLossRate} lb/week of fat loss.
                </Text>
              )}
              <Text style={styles.tdeeDisclaimer}>
                Calculated using the Mifflin-St Jeor equation. This is an estimate — individual metabolism varies.
              </Text>
            </View>
          )}

          {!isGuest && (
            <Button
              title="💾 Save Profile"
              gradient
              loading={profileSaving}
              onPress={handleSaveProfile}
              style={styles.saveBtn}
            />
          )}
        </Animated.View>

        {/* ── Goal context card ───────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.goalContextCard}>
          <Text style={styles.goalContextTitle}>
            {GOALS.find((g) => g.value === selectedGoal)?.emoji} What this goal means for you
          </Text>
          <View style={styles.goalHeadlinePill}>
            <Text style={styles.goalHeadlineText}>{goalCtx.headline}</Text>
          </View>
          <Text style={styles.goalDetail}>{goalCtx.detail}</Text>
          <Text style={styles.goalTipsTitle}>Action steps:</Text>
          {goalCtx.tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
          <Text style={styles.goalContextDisclaimer}>
            These guidelines are for general informational purposes only and are not medical advice. Consult a registered dietitian or physician before making significant changes to your diet or exercise routine.
          </Text>
        </Animated.View>

        {/* ── Daily targets (calories + macros) ──────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.card}>
          <Text style={styles.sectionTitle}>🎯 Daily Targets</Text>

          <Input
            label="Daily Calorie Goal"
            value={calorieGoal}
            onChangeText={setCalorieGoal}
            keyboardType="numeric"
            leftIcon="flame-outline"
          />

          {/* Macro grams preview */}
          <View style={styles.macroPreviewRow}>
            {[
              { label: 'Protein', grams: proteinGrams, color: Colors.protein },
              { label: 'Carbs', grams: carbsGrams, color: Colors.carbs },
              { label: 'Fat', grams: fatGrams, color: Colors.fat },
            ].map(({ label, grams, color }) => (
              <View key={label} style={[styles.macroPreviewItem, { borderColor: color + '55' }]}>
                <Text style={[styles.macroPreviewGrams, { color }]}>{grams}g</Text>
                <Text style={styles.macroPreviewLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.macroLabel}>
            Macro Split{' '}
            <Text style={[styles.macroTotal, !macroValid && styles.macroError]}>
              ({macroTotal}% — must equal 100%)
            </Text>
          </Text>

          <MacroSlider label="Protein 💪" value={proteinPct} color={Colors.protein} onChange={setProteinPct} />
          <MacroSlider label="Carbs 🌾" value={carbsPct} color={Colors.carbs} onChange={setCarbsPct} />
          <MacroSlider label="Fat 🥑" value={fatPct} color={Colors.fat} onChange={setFatPct} />

          <View style={styles.macroDisclaimerBox}>
            <Text style={styles.macroDisclaimerText}>
              ℹ️ Suggested starting point: 30% Protein · 40% Carbs · 30% Fat. Adjust based on your preferences, performance, and how you feel. These targets are estimates — a registered dietitian can provide personalised macro guidance.
            </Text>
          </View>

          {!isGuest && (
            <Button
              title="💾 Save Targets"
              gradient
              loading={saving}
              onPress={handleSaveTargets}
              disabled={!macroValid}
              style={styles.saveBtn}
            />
          )}
        </Animated.View>

        {/* ── TDEE / formula disclaimer ───────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>⚕️ How Calorie Targets are Calculated</Text>
          <Text style={styles.disclaimerBody}>
            CaloriePal uses the <Text style={styles.disclaimerBold}>Mifflin-St Jeor equation</Text> to estimate your Basal Metabolic Rate (BMR) — the calories your body needs at rest. This is then multiplied by your activity level to get your Total Daily Energy Expenditure (TDEE), and adjusted for your goal (−500 cal for weight loss, +300 cal for muscle gain).
          </Text>
          <Text style={styles.disclaimerBody}>
            These are <Text style={styles.disclaimerBold}>population-average estimates</Text>. Your actual needs may differ based on genetics, hormones, medications, and other individual factors. All health and nutrition information in this app is for general informational purposes only and is <Text style={styles.disclaimerBold}>not a substitute for professional medical advice</Text>.
          </Text>
          <Text style={styles.disclaimerSourcesTitle}>Authoritative sources:</Text>
          {[
            { label: 'NIH — Healthy Weight', url: 'https://www.nhlbi.nih.gov/health/educational/lose_wt/calories.htm' },
            { label: 'USDA Dietary Guidelines', url: 'https://www.dietaryguidelines.gov' },
            { label: 'Academy of Nutrition and Dietetics', url: 'https://www.eatright.org' },
            { label: 'Mifflin et al. (1990) — Am J Clin Nutr', url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/' },
          ].map(({ label, url }) => (
            <TouchableOpacity key={url} onPress={() => Linking.openURL(url)} style={styles.sourceRow}>
              <Text style={styles.sourceLink}>↗ {label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* ── Notifications ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.card}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifLabel}>Daily Reminder</Text>
              <Text style={styles.notifSub}>Get reminded to log your meals</Text>
            </View>
            <Switch
              value={notificationsOn}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.textWhite}
            />
          </View>
          {notificationsOn && (
            <View style={styles.timePicker}>
              <Text style={styles.timePickerLabel}>Reminder Time</Text>

              {/* Format toggle */}
              <View style={styles.timeFormatRow}>
                {(['12h', '24h'] as const).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.timeFormatBtn, timeFormat === f && styles.timeFormatBtnActive]}
                    onPress={() => handleSetTimeFormat(f)}
                  >
                    <Text style={[styles.timeFormatBtnText, timeFormat === f && styles.timeFormatBtnTextActive]}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Hour : Minute stepper */}
              <View style={styles.timeStepperRow}>
                {/* Hour */}
                <View style={styles.timeUnit}>
                  <TouchableOpacity style={styles.timeStepBtn} onPress={() => setNotifHour((h) => adjustHour(h, 1))}>
                    <Ionicons name="chevron-up" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.timeValue}>{String(displayHour).padStart(2, '0')}</Text>
                  <TouchableOpacity style={styles.timeStepBtn} onPress={() => setNotifHour((h) => adjustHour(h, -1))}>
                    <Ionicons name="chevron-down" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.timeSeparator}>:</Text>

                {/* Minute */}
                <View style={styles.timeUnit}>
                  <TouchableOpacity style={styles.timeStepBtn} onPress={() => setNotifMinute((m) => adjustMinute(m, 5))}>
                    <Ionicons name="chevron-up" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.timeValue}>{displayMinute}</Text>
                  <TouchableOpacity style={styles.timeStepBtn} onPress={() => setNotifMinute((m) => adjustMinute(m, -5))}>
                    <Ionicons name="chevron-down" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* AM / PM (12h only) */}
                {timeFormat === '12h' && (
                  <TouchableOpacity style={styles.amPmBtn} onPress={() => setNotifHour((h) => toggleAmPm(h))}>
                    <Text style={[styles.amPmText, !isAm && styles.amPmTextActive]}>AM</Text>
                    <View style={[styles.amPmDivider]} />
                    <Text style={[styles.amPmText, isAm && styles.amPmTextActive]}>PM</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </Animated.View>

        {/* ── Data & account ──────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.card}>
          <Text style={styles.sectionTitle}>Data & Account</Text>

          {/* Data collection notice */}
          <View style={styles.dataNoticeBox}>
            <Text style={styles.dataNoticeTitle}>📋 Data We Collect</Text>
            <Text style={styles.dataNoticeText}>
              CaloriePal collects meal photos, food logs, exercise logs, and personal health metrics (weight, height, age, goals) to provide personalised tracking. Meal photos are analysed by OpenAI's GPT-4o and nutrition suggestions are generated by Anthropic's Claude AI. Your data is stored securely via Supabase.
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://jazzy-flat-9c9.notion.site/CaloriePal-Privacy-Policy-34bd422b0970803aac19e110683e3eae')} style={styles.privacyLink}>
              <Text style={styles.privacyLinkText}>↗ View Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://jazzy-flat-9c9.notion.site/CaloriePal-Support-34ad422b097080a5aca0f453ce7ffe13')} style={styles.privacyLink}>
              <Text style={styles.privacyLinkText}>↗ Contact Support</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={handleExportCSV}>
            <Ionicons name="download-outline" size={20} color={Colors.secondary} />
            <Text style={styles.menuText}>📤 Export Data as CSV</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          {!isGuest && (
            <TouchableOpacity style={styles.menuItem} onPress={handleChangePassword}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textLight} />
              <Text style={styles.menuText}>🔒 Change Password</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}

          {isGuest ? (
            <Button
              title="Create Free Account"
              gradient
              onPress={() => router.push('/(auth)/create-account')}
              style={{ marginTop: 12 }}
            />
          ) : (
            <>
              <TouchableOpacity style={[styles.menuItem, styles.signOutItem]} onPress={handleSignOut}>
                <Ionicons name="log-out-outline" size={20} color={Colors.error} />
                <Text style={[styles.menuText, styles.signOutText]}>Sign Out</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteRow} onPress={handleDeleteAccount}>
                <Text style={styles.deleteText}>Delete Account</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        <Text style={styles.version}>CaloriePal v1.0.0 · Made with ❤️</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, paddingBottom: 100 },
  title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 24, color: Colors.text, marginBottom: 16 },

  // Profile header card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarCameraIcon: { fontSize: 11 },
  avatarHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  avatarText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 22, color: Colors.textWhite },
  profileName: { fontFamily: 'Nunito_800ExtraBold', fontSize: 20, color: Colors.textWhite },
  profileEmail: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  // Generic card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontFamily: 'Nunito_700Bold', fontSize: 17, color: Colors.text, marginBottom: 14 },
  saveBtn: { marginTop: 8 },

  // Goal selector
  goalGrid: { flexDirection: 'row', gap: 8 },
  goalBtn: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  goalBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  goalEmoji: { fontSize: 22, marginBottom: 4 },
  goalLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: Colors.text, textAlign: 'center' },
  goalLabelActive: { color: Colors.primary },
  goalDesc: { fontFamily: 'Nunito_400Regular', fontSize: 10, color: Colors.textLight, textAlign: 'center', marginTop: 2 },

  // Weight loss rate selector
  lossRateSection: { marginTop: 16, marginBottom: 4 },
  lossRateTitle: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: Colors.text, marginBottom: 6 },
  lossRateSubtitle: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textLight, lineHeight: 17, marginBottom: 12 },
  lossRateGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  lossRateBtn: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 6,
  },
  lossRateBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  lossRateTag: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lossRateTagText: { fontFamily: 'Nunito_700Bold', fontSize: 10 },
  lossRateLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: Colors.text, textAlign: 'center' },
  lossRateLabelActive: { color: Colors.primary },
  lossRateDeficit: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: Colors.textLight, textAlign: 'center' },
  lossRateWarning: {
    backgroundColor: Colors.warning + '22',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  lossRateWarningText: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: Colors.text, lineHeight: 16 },
  tdeeDeficitNote: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: Colors.primary, marginBottom: 4 },

  // Activity selector
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activityBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    minWidth: '47%',
    flex: 1,
  },
  activityBtnActive: { borderColor: Colors.secondary, backgroundColor: Colors.secondary + '15' },
  activityLabel: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.text },
  activityLabelActive: { color: Colors.secondary },
  activityDesc: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: Colors.textLight, marginTop: 2 },

  // Gender selector
  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  genderBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  genderBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  genderBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.textLight },
  genderBtnTextActive: { color: Colors.primary },
  // Physical stats inputs
  statsHint: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textLight, marginBottom: 14, lineHeight: 18 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  statRowLabel: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: Colors.text, width: 52 },
  statRowInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statInput: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 80,
    textAlign: 'center',
  },
  statUnit: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: Colors.textLight },
  unitToggle: { flexDirection: 'row', borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden' },
  unitBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Colors.surface },
  unitBtnActive: { backgroundColor: Colors.primary },
  unitBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: Colors.textLight },
  unitBtnTextActive: { color: Colors.textWhite },

  // TDEE result box
  tdeeBox: {
    backgroundColor: '#EAF6FF',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
  },
  tdeeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tdeeLabel: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textLight, marginBottom: 2 },
  tdeeCalories: { fontFamily: 'Nunito_800ExtraBold', fontSize: 22, color: Colors.text },
  tdeeGoal: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textLight, marginTop: 2 },
  applyBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  applyBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: Colors.textWhite },
  tdeeDisclaimer: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: Colors.textLight, fontStyle: 'italic' },

  // Goal context card
  goalContextCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  goalContextTitle: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: Colors.text, marginBottom: 12 },
  goalHeadlinePill: {
    backgroundColor: Colors.primary + '18',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  goalHeadlineText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: Colors.primary },
  goalDetail: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: Colors.text, lineHeight: 20, marginBottom: 14 },
  goalTipsTitle: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.text, marginBottom: 8 },
  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  tipBullet: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: Colors.primary, lineHeight: 20 },
  tipText: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: Colors.text, lineHeight: 20, flex: 1 },
  goalContextDisclaimer: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },

  // Macro preview
  macroPreviewRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  macroPreviewItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: Colors.background,
  },
  macroPreviewGrams: { fontFamily: 'Nunito_800ExtraBold', fontSize: 18 },
  macroPreviewLabel: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: Colors.textLight, marginTop: 2 },

  // Macro controls
  macroLabel: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: Colors.text, marginBottom: 12 },
  macroTotal: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: Colors.textLight },
  macroError: { color: Colors.error },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sliderDot: { width: 12, height: 12, borderRadius: 6 },
  sliderLabel: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: Colors.text, flex: 1 },
  sliderControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderValue: { fontFamily: 'Nunito_700Bold', fontSize: 15, width: 40, textAlign: 'center' },
  macroDisclaimerBox: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  macroDisclaimerText: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textLight, lineHeight: 18 },

  // TDEE disclaimer card
  disclaimerCard: {
    backgroundColor: '#EAF6FF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
  },
  disclaimerTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: Colors.text, marginBottom: 12 },
  disclaimerBody: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: Colors.text, lineHeight: 20, marginBottom: 10 },
  disclaimerBold: { fontFamily: 'Nunito_700Bold' },
  disclaimerSourcesTitle: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.text, marginTop: 4, marginBottom: 6 },
  sourceRow: { paddingVertical: 4 },
  sourceLink: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.secondary, textDecorationLine: 'underline' },

  // Notifications
  notifRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  notifLabel: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: Colors.text },
  notifSub: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textLight },

  // Time picker
  timePicker: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 12,
  },
  timePickerLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.text,
  },
  timeFormatRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeFormatBtn: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  timeFormatBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  timeFormatBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.textLight,
  },
  timeFormatBtnTextActive: {
    color: Colors.textWhite,
  },
  timeStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeUnit: {
    alignItems: 'center',
    gap: 6,
  },
  timeStepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeValue: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 32,
    color: Colors.primary,
    minWidth: 56,
    textAlign: 'center',
  },
  timeSeparator: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 32,
    color: Colors.textLight,
    marginTop: -4,
  },
  amPmBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    overflow: 'hidden',
    marginLeft: 4,
  },
  amPmText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.textLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  amPmTextActive: {
    color: Colors.textWhite,
    backgroundColor: Colors.primary,
  },
  amPmDivider: {
    height: 1,
    backgroundColor: Colors.primary,
  },

  // Menu items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuText: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: Colors.text, flex: 1 },
  signOutItem: { borderBottomWidth: 0, marginTop: 4 },
  signOutText: { color: Colors.error, fontFamily: 'Nunito_700Bold' },
  deleteRow: { alignItems: 'center', marginTop: 8 },
  deleteText: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline' },
  version: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 16 },
  dataNoticeBox: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dataNoticeTitle: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.text, marginBottom: 6 },
  dataNoticeText: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: Colors.textLight, lineHeight: 18, marginBottom: 10 },
  privacyLink: { paddingVertical: 3 },
  privacyLinkText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: Colors.secondary, textDecorationLine: 'underline' },
});
