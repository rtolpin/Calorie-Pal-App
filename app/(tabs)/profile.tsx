import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { GuestBanner } from '../../components/GuestBanner';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import {
  requestNotificationPermissions,
  scheduleDailyReminder,
  cancelDailyReminder,
} from '../../lib/notifications';
import { Colors } from '../../constants/Colors';
import { Goal, ActivityLevel } from '../../types';

const GOAL_LABELS: Record<Goal, string> = {
  lose_weight: '🔥 Lose Weight',
  maintain: '⚖️ Maintain',
  gain_muscle: '💪 Gain Muscle',
};

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly Active',
  active: 'Active',
  very_active: 'Very Active',
};

function MacroSlider({ label, value, color, onChange }: {
  label: string; value: number; color: string; onChange: (v: number) => void;
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

  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('lbs');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('ft');
  const [calorieGoal, setCalorieGoal] = useState(String(profile?.daily_calorie_target || 2000));
  const [proteinPct, setProteinPct] = useState(profile?.protein_target_pct || 30);
  const [carbsPct, setCarbsPct] = useState(profile?.carbs_target_pct || 40);
  const [fatPct, setFatPct] = useState(profile?.fat_target_pct || 30);
  const [notificationsOn, setNotificationsOn] = useState(profile?.notification_enabled || false);
  const [notifTime, setNotifTime] = useState(profile?.notification_time || '19:00');
  const [saving, setSaving] = useState(false);

  const macroTotal = proteinPct + carbsPct + fatPct;
  const macroValid = macroTotal === 100;

  useEffect(() => {
    if (profile) {
      setCalorieGoal(String(profile.daily_calorie_target));
      setProteinPct(profile.protein_target_pct);
      setCarbsPct(profile.carbs_target_pct);
      setFatPct(profile.fat_target_pct);
      setNotificationsOn(profile.notification_enabled);
      setNotifTime(profile.notification_time);
    }
  }, [profile]);

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
      Alert.alert('Saved! ✅', 'Your settings have been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
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

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ Delete Account',
      'This will permanently delete your account and all your meal data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => Alert.alert('Contact Support', 'Please email support@caloriepal.app to delete your account.'),
        },
      ]
    );
  };

  const initials = profile?.name
    ? profile.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : isGuest ? 'G' : '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {isGuest && <GuestBanner />}
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>👤 Profile</Text>

        <Animated.View entering={FadeInDown.springify()} style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>
              {isGuest ? 'Guest User' : (profile?.name || 'User')}
            </Text>
            <Text style={styles.profileEmail}>
              {isGuest ? 'Not signed in' : (session?.user.email || '')}
            </Text>
          </View>
        </Animated.View>

        {!isGuest && profile && (
          <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.statsCard}>
            <Text style={styles.sectionTitle}>My Stats</Text>
            <View style={styles.statsGrid}>
              {[
                { label: 'Goal', value: GOAL_LABELS[profile.goal || 'maintain'] },
                { label: 'Activity', value: ACTIVITY_LABELS[profile.activity_level || 'lightly_active'] },
                {
                  label: 'Weight',
                  value: profile.weight_kg
                    ? weightUnit === 'lbs'
                      ? `${Math.round(profile.weight_kg * 2.20462)} lbs`
                      : `${profile.weight_kg} kg`
                    : '—',
                },
                {
                  label: 'Height',
                  value: profile.height_cm
                    ? heightUnit === 'ft'
                      ? (() => {
                          const totalIn = profile.height_cm / 2.54;
                          const ft = Math.floor(totalIn / 12);
                          const inches = Math.round(totalIn % 12);
                          return `${ft} ft ${inches} in`;
                        })()
                      : `${profile.height_cm} cm`
                    : '—',
                },
                { label: 'Age', value: profile.age ? `${profile.age} yrs` : '—' },
              ].map((stat) => (
                <View key={stat.label} style={styles.statItem}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Text style={styles.statValue}>{stat.value}</Text>
                </View>
              ))}
            </View>
            {(profile.weight_kg || profile.height_cm) ? (
              <View style={styles.unitTogglesRow}>
                {profile.weight_kg ? (
                  <View style={styles.weightUnitRow}>
                    <Text style={styles.weightUnitLabel}>Weight:</Text>
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
                ) : null}
                {profile.height_cm ? (
                  <View style={styles.weightUnitRow}>
                    <Text style={styles.weightUnitLabel}>Height:</Text>
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
                ) : null}
              </View>
            ) : null}
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.card}>
          <Text style={styles.sectionTitle}>Daily Targets</Text>

          <Input
            label="Daily Calorie Goal"
            value={calorieGoal}
            onChangeText={setCalorieGoal}
            keyboardType="numeric"
            leftIcon="flame-outline"
          />

          <Text style={styles.macroLabel}>
            Macro Split{' '}
            <Text style={[styles.macroTotal, !macroValid && styles.macroError]}>
              ({macroTotal}% total — must equal 100%)
            </Text>
          </Text>

          <MacroSlider label="Protein 💪" value={proteinPct} color={Colors.protein} onChange={setProteinPct} />
          <MacroSlider label="Carbs 🌾" value={carbsPct} color={Colors.carbs} onChange={setCarbsPct} />
          <MacroSlider label="Fat 🥑" value={fatPct} color={Colors.fat} onChange={setFatPct} />

          {!isGuest && (
            <Button
              title="💾 Save Changes"
              gradient
              loading={saving}
              onPress={handleSaveTargets}
              disabled={!macroValid}
              style={styles.saveBtn}
            />
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.card}>
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
            <Input
              label="Reminder Time (24h format)"
              value={notifTime}
              onChangeText={setNotifTime}
              placeholder="19:00"
              leftIcon="time-outline"
            />
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.card}>
          <Text style={styles.sectionTitle}>Data & Account</Text>

          <TouchableOpacity style={styles.menuItem} onPress={handleExportCSV}>
            <Ionicons name="download-outline" size={20} color={Colors.secondary} />
            <Text style={styles.menuText}>📤 Export Data as CSV</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          {!isGuest && (
            <TouchableOpacity style={styles.menuItem}>
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
              <TouchableOpacity
                style={[styles.menuItem, styles.signOutItem]}
                onPress={handleSignOut}
              >
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
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 24,
    color: Colors.text,
    marginBottom: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: Colors.textWhite,
  },
  profileName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: Colors.textWhite,
  },
  profileEmail: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statsCard: {
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    minWidth: '45%',
    flex: 1,
  },
  statLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: Colors.textLight,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.text,
  },
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
  sectionTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 17,
    color: Colors.text,
    marginBottom: 16,
  },
  macroLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 12,
  },
  macroTotal: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: Colors.textLight,
  },
  macroError: { color: Colors.error },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sliderDot: { width: 12, height: 12, borderRadius: 6 },
  sliderLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  sliderControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderValue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    width: 40,
    textAlign: 'center',
  },
  saveBtn: { marginTop: 4 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  notifLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: Colors.text,
  },
  notifSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textLight,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  signOutItem: { borderBottomWidth: 0, marginTop: 4 },
  signOutText: { color: Colors.error, fontFamily: 'Nunito_700Bold' },
  deleteRow: { alignItems: 'center', marginTop: 8 },
  deleteText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
  version: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  unitTogglesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  weightUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weightUnitLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: Colors.textLight,
  },
  unitToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  unitBtn: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
  },
  unitBtnActive: { backgroundColor: Colors.primary },
  unitBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.textLight },
  unitBtnTextActive: { color: Colors.textWhite },
});
