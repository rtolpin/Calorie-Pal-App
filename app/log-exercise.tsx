import React, { useState } from 'react';
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from '../lib/haptics';
import { useAuthStore } from '../store/authStore';
import { useExerciseLogStore } from '../store/exerciseLogStore';
import { supabase } from '../lib/supabase';
import { EXERCISE_PRESETS, ExerciseFelt } from '../types';
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
  const [felt, setFelt] = useState<ExerciseFelt | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
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

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64);
    }
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

    // Photo upload is best-effort — failure must not block the exercise save
    let photoUrl: string | undefined;
    if (photoUri && !isGuest && session && photoBase64) {
      try {
        const logId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const fileName = `exercise-photos/${session.user.id}/${logId}.jpg`;
        const binary = atob(photoBase64);
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
        // Exercise saves without photo if upload fails
      }
    } else if (photoUri && isGuest) {
      photoUrl = photoUri;
    }

    try {
      await addExerciseLog(
        {
          user_id: session?.user.id,
          exercise_name: exerciseName.trim(),
          exercise_emoji: exerciseEmoji,
          duration_minutes: parseInt(duration) || 0,
          calories_burned: cal,
          felt: felt ?? undefined,
          photo_url: photoUrl,
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

            {/* Quick preset buttons */}
            <Text style={styles.durationSubLabel}>Quick select</Text>
            <View style={styles.presetDurationGrid}>
              {[15, 30, 45, 60, 75, 90, 120].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[
                    styles.durationPresetBtn,
                    parseInt(duration) === mins && styles.durationPresetBtnActive,
                  ]}
                  onPress={() => {
                    setDuration(String(mins));
                    if (selectedPreset !== null) {
                      setCalories(String(Math.round(EXERCISE_PRESETS[selectedPreset].cal_per_min * mins)));
                    }
                  }}
                >
                  <Text style={[
                    styles.durationPresetText,
                    parseInt(duration) === mins && styles.durationPresetTextActive,
                  ]}>
                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Fine-tune row */}
            <Text style={styles.durationSubLabel}>Fine-tune</Text>
            <View style={styles.durationRow}>
              <TouchableOpacity style={styles.durationBtn} onPress={() => adjustDuration(-10)}>
                <Text style={styles.durationBtnText}>−10</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.durationBtn} onPress={() => adjustDuration(-5)}>
                <Text style={styles.durationBtnText}>−5</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.durationBtn} onPress={() => adjustDuration(-1)}>
                <Text style={styles.durationBtnText}>−1</Text>
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
                <Text style={styles.durationBtnText}>+1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.durationBtn} onPress={() => adjustDuration(5)}>
                <Text style={styles.durationBtnText}>+5</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.durationBtn} onPress={() => adjustDuration(10)}>
                <Text style={styles.durationBtnText}>+10</Text>
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
            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerTitle}>⚠️ Calorie Estimate &amp; Safety Disclaimer</Text>
              <Text style={styles.disclaimerText}>
                Calories burned are estimated using average MET (Metabolic Equivalent of Task) values and may differ significantly from your actual burn based on body weight, age, fitness level, and intensity. For precise tracking, use a heart rate monitor or fitness tracker.
              </Text>
              <Text style={[styles.disclaimerText, { marginTop: 6, fontStyle: 'italic' }]}>
                Consult your physician or a qualified healthcare provider before beginning or significantly changing an exercise program, especially if you have a heart condition, joint problems, or any medical condition.
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(225).springify()} style={styles.card}>
            <Text style={styles.sectionLabel}>How did it feel? (optional)</Text>
            <View style={styles.feltGrid}>
              {([
                { value: 'easy',       emoji: '😌', label: 'Easy' },
                { value: 'good',       emoji: '💪', label: 'Good' },
                { value: 'hard',       emoji: '😤', label: 'Hard' },
                { value: 'exhausting', emoji: '😵', label: 'Exhausting' },
              ] as { value: ExerciseFelt; emoji: string; label: string }[]).map(({ value, emoji, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.feltBtn, felt === value && styles.feltBtnActive]}
                  onPress={() => setFelt(felt === value ? null : value)}
                  testID={`felt-btn-${value}`}
                >
                  <Text style={styles.feltEmoji}>{emoji}</Text>
                  <Text style={[styles.feltLabel, felt === value && styles.feltLabelActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
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

          <Animated.View entering={FadeInDown.delay(275).springify()} style={styles.card}>
            <Text style={styles.sectionLabel}>Photo (optional)</Text>
            {photoUri ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} accessibilityLabel="Exercise photo preview" />
                <View style={styles.photoPreviewActions}>
                  <TouchableOpacity style={styles.photoActionBtn} onPress={handlePickPhoto}>
                    <Ionicons name="swap-horizontal-outline" size={16} color={Colors.secondary} />
                    <Text style={styles.photoActionText}>Replace</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.photoActionBtn, styles.photoRemoveBtn]}
                    onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                    <Text style={[styles.photoActionText, { color: Colors.error }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.photoPickerBtn} onPress={handlePickPhoto}>
                <Ionicons name="image-outline" size={24} color={Colors.secondary} />
                <Text style={styles.photoPickerText}>Add a photo of your workout</Text>
              </TouchableOpacity>
            )}
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
  durationSubLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 8,
    marginTop: 4,
  },
  presetDurationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  durationPresetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minWidth: 52,
    alignItems: 'center',
  },
  durationPresetBtnActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  durationPresetText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.text,
  },
  durationPresetTextActive: {
    color: Colors.textWhite,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  durationBtn: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  durationBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.text,
  },
  durationDisplay: { alignItems: 'center', minWidth: 80 },
  durationInput: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 36,
    color: Colors.secondary,
    width: 80,
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
  disclaimerBox: {
    marginTop: 14,
    backgroundColor: '#FFF8E7',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  disclaimerTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.text,
    marginBottom: 4,
  },
  disclaimerText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: Colors.text,
    lineHeight: 17,
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
  feltGrid: { flexDirection: 'row', gap: 8 },
  feltBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  feltBtnActive: { borderColor: Colors.secondary, backgroundColor: Colors.secondary + '18' },
  feltEmoji: { fontSize: 22, marginBottom: 4 },
  feltLabel: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: Colors.textLight, textAlign: 'center' },
  feltLabelActive: { fontFamily: 'Nunito_700Bold', color: Colors.secondary },
  buttons: { gap: 10, marginTop: 8 },
  photoPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.secondary + '66',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    backgroundColor: Colors.secondary + '08',
  },
  photoPickerText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.secondary,
  },
  photoPreviewContainer: { gap: 10 },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: Colors.border,
  },
  photoPreviewActions: { flexDirection: 'row', gap: 10 },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.secondary + '55',
    backgroundColor: Colors.secondary + '10',
  },
  photoRemoveBtn: {
    borderColor: Colors.error + '55',
    backgroundColor: Colors.error + '08',
  },
  photoActionText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.secondary,
  },
});
