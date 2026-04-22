import React, { useState } from 'react';
import {
  Alert,
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/authStore';
import { useExerciseLogStore } from '../store/exerciseLogStore';
import { EXERCISE_PRESETS } from '../types';
import { Button } from '../components/ui/Button';
import { Colors } from '../constants/Colors';

export default function LogExerciseScreen() {
  const { session, isGuest } = useAuthStore();
  const { addExerciseLog } = useExerciseLogStore();

  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseEmoji, setExerciseEmoji] = useState('🏃');
  const [duration, setDuration] = useState('30');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const adjustDuration = (delta: number) => {
    const current = parseInt(duration) || 0;
    const next = Math.max(1, current + delta);
    setDuration(String(next));
    if (selectedPreset !== null) {
      setCalories(String(Math.round(EXERCISE_PRESETS[selectedPreset].cal_per_min * next)));
    }
  };

  const handleSelectPreset = (index: number) => {
    const preset = EXERCISE_PRESETS[index];
    setSelectedPreset(index);
    setExerciseName(preset.name);
    setExerciseEmoji(preset.emoji);
    const mins = parseInt(duration) || 30;
    setCalories(String(Math.round(preset.cal_per_min * mins)));
  };

  const handleLog = async () => {
    if (!exerciseName.trim()) {
      Alert.alert('Missing Info', 'Please select or enter an exercise.');
      return;
    }
    const cal = parseInt(calories);
    if (!cal || cal <= 0) {
      Alert.alert('Missing Info', 'Please enter calories burned.');
      return;
    }

    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      await addExerciseLog(
        {
          user_id: session?.user.id,
          exercise_name: exerciseName.trim(),
          exercise_emoji: exerciseEmoji,
          duration_minutes: parseInt(duration) || 0,
          calories_burned: cal,
          notes: notes.trim() || undefined,
          logged_at: new Date().toISOString(),
        },
        session?.user.id,
        isGuest
      );

      Alert.alert('Logged! 🔥', `${exerciseName} has been added to your journal.`, [
        { text: 'Great!', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save your exercise. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Log Exercise 🏃</Text>
            <View style={{ width: 40 }} />
          </View>

          <Animated.View entering={FadeInDown.springify()}>
            <Text style={styles.sectionLabel}>Choose an Activity</Text>
            <View style={styles.presetsGrid}>
              {EXERCISE_PRESETS.map((preset, i) => (
                <TouchableOpacity
                  key={preset.name}
                  style={[styles.presetBtn, selectedPreset === i && styles.presetBtnActive]}
                  onPress={() => handleSelectPreset(i)}
                >
                  <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                  <Text style={[styles.presetName, selectedPreset === i && styles.presetNameActive]}>
                    {preset.name}
                  </Text>
                  <Text style={styles.presetRate}>{preset.cal_per_min} cal/min</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.card}>
            <Text style={styles.sectionLabel}>Or enter custom exercise</Text>
            <View style={styles.customRow}>
              <TextInput
                style={styles.emojiInput}
                value={exerciseEmoji}
                onChangeText={setExerciseEmoji}
                maxLength={2}
              />
              <TextInput
                style={[styles.nameInput, { flex: 1 }]}
                value={exerciseName}
                onChangeText={(v) => { setExerciseName(v); setSelectedPreset(null); }}
                placeholder="Exercise name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.card}>
            <Text style={styles.sectionLabel}>Duration</Text>
            <View style={styles.durationRow}>
              <TouchableOpacity style={styles.durationBtn} onPress={() => adjustDuration(-5)}>
                <Ionicons name="remove" size={20} color={Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.durationBtn} onPress={() => adjustDuration(-1)}>
                <Text style={styles.durationSmallBtn}>−1</Text>
              </TouchableOpacity>

              <View style={styles.durationDisplay}>
                <TextInput
                  style={styles.durationInput}
                  value={duration}
                  onChangeText={(v) => {
                    setDuration(v);
                    if (selectedPreset !== null) {
                      setCalories(String(Math.round(EXERCISE_PRESETS[selectedPreset].cal_per_min * (parseInt(v) || 0))));
                    }
                  }}
                  keyboardType="numeric"
                  textAlign="center"
                />
                <Text style={styles.durationUnit}>min</Text>
              </View>

              <TouchableOpacity style={styles.durationBtn} onPress={() => adjustDuration(1)}>
                <Text style={styles.durationSmallBtn}>+1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.durationBtn} onPress={() => adjustDuration(5)}>
                <Ionicons name="add" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.card}>
            <Text style={styles.sectionLabel}>Calories Burned</Text>
            <View style={styles.calorieRow}>
              <TextInput
                style={styles.calorieInput}
                value={calories}
                onChangeText={setCalories}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.calorieUnit}>cal burned 🔥</Text>
            </View>
            {selectedPreset !== null && (
              <Text style={styles.calorieHint}>
                Estimated from {EXERCISE_PRESETS[selectedPreset].cal_per_min} cal/min × {duration} min
              </Text>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.card}>
            <Text style={styles.sectionLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Morning run, felt great!"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={2}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.buttons}>
            <Button
              title="🔥 Log Exercise"
              gradient
              size="lg"
              loading={saving}
              onPress={handleLog}
            />
            <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, paddingBottom: 40 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: Colors.text,
  },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 10,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minWidth: '30%',
    flex: 1,
  },
  presetBtnActive: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondary + '18',
  },
  presetEmoji: { fontSize: 24, marginBottom: 4 },
  presetName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.text,
    textAlign: 'center',
  },
  presetNameActive: { color: Colors.secondary },
  presetRate: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
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
  customRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  emojiInput: {
    fontSize: 28,
    width: 52,
    height: 52,
    textAlign: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  nameInput: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  durationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationSmallBtn: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.text,
  },
  durationDisplay: { alignItems: 'center', minWidth: 90 },
  durationInput: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 40,
    color: Colors.secondary,
    width: 90,
  },
  durationUnit: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.textLight,
  },
  calorieRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  calorieInput: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 36,
    color: Colors.success,
    borderWidth: 1.5,
    borderColor: Colors.success + '55',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 110,
    textAlign: 'center',
  },
  calorieUnit: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  calorieHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 8,
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
    minHeight: 70,
  },
  buttons: { gap: 10, marginTop: 8 },
});
