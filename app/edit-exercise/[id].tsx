import React, { useEffect, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { useExerciseLogStore } from '../../store/exerciseLogStore';
import { supabase } from '../../lib/supabase';
import { ExerciseFelt } from '../../types';
import { Button } from '../../components/ui/Button';
import { Colors } from '../../constants/Colors';

function formatDateInput(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}/${d}/${date.getFullYear()}`;
}

function formatTimeInput(date: Date): string {
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function parseToISO(dateStr: string, timeStr: string): string {
  const [mo, d, y] = dateStr.split('/').map(Number);
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return new Date().toISOString();
  let h = parseInt(match[1]);
  const min = parseInt(match[2]);
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  const result = new Date(y, mo - 1, d, h, min);
  return isNaN(result.getTime()) ? new Date().toISOString() : result.toISOString();
}

const FELT_OPTIONS: { value: ExerciseFelt; emoji: string; label: string }[] = [
  { value: 'easy',       emoji: '😌', label: 'Easy' },
  { value: 'good',       emoji: '💪', label: 'Good' },
  { value: 'hard',       emoji: '😤', label: 'Hard' },
  { value: 'exhausting', emoji: '😵', label: 'Exhausting' },
];

export default function EditExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isGuest } = useAuthStore();
  const { exerciseLogs, updateExerciseLog } = useExerciseLogStore();

  const log = exerciseLogs.find((l) => l.id === id);

  const initialDate = log ? new Date(log.logged_at) : new Date();
  const [exerciseName, setExerciseName]   = useState(() => log?.exercise_name ?? '');
  const [exerciseEmoji, setExerciseEmoji] = useState(() => log?.exercise_emoji ?? '🏃');
  const [duration, setDuration]           = useState(() => String(log?.duration_minutes ?? 30));
  const [calories, setCalories]           = useState(() => String(log?.calories_burned ?? 0));
  const [felt, setFelt]                   = useState<ExerciseFelt | null>(() => log?.felt ?? null);
  const [notes, setNotes]                 = useState(() => log?.notes ?? '');
  const [photoUri, setPhotoUri]           = useState(() => log?.photo_url ?? '');
  const [dateInput, setDateInput]         = useState(() => formatDateInput(initialDate));
  const [timeInput, setTimeInput]         = useState(() => formatTimeInput(initialDate));
  const [saving, setSaving]               = useState(false);
  const [hasChanges, setHasChanges]       = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!log) {
      Alert.alert('Not Found', 'This exercise entry could not be found.');
      router.back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markChanged = () => setHasChanges(true);

  const adjustDuration = (delta: number) => {
    const next = Math.max(1, (parseInt(duration) || 0) + delta);
    setDuration(String(next));
    markChanged();
  };

  const handleReplacePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const { uri, base64 } = result.assets[0];

    if (!base64 || isGuest || !session) {
      setPhotoUri(uri);
      markChanged();
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileName = `exercise-photos/${session.user.id}/${id}_${Date.now()}.jpg`;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { error } = await supabase.storage
        .from('meal-photos')
        .upload(fileName, bytes.buffer, { contentType: 'image/jpeg', upsert: true });
      if (!error) {
        const { data } = supabase.storage.from('meal-photos').getPublicUrl(fileName);
        setPhotoUri(data.publicUrl);
      } else {
        setPhotoUri(uri);
      }
    } catch {
      setPhotoUri(uri);
    } finally {
      setUploadingPhoto(false);
      markChanged();
    }
  };

  const handleSave = async () => {
    if (!exerciseName.trim()) {
      Alert.alert('Missing Info', 'Please enter an exercise name.');
      return;
    }
    const cal = parseFloat(calories);
    if (!cal || cal <= 0) {
      Alert.alert('Missing Info', 'Please enter calories burned.');
      return;
    }

    setSaving(true);
    try {
      await updateExerciseLog(
        id,
        {
          exercise_name:    exerciseName.trim(),
          exercise_emoji:   exerciseEmoji,
          duration_minutes: parseInt(duration) || 0,
          calories_burned:  cal,
          felt:             felt ?? undefined,
          notes:            notes.trim() || undefined,
          photo_url:        photoUri || undefined,
          logged_at:        parseToISO(dateInput, timeInput),
        },
        session?.user.id,
        isGuest,
      );
      Alert.alert('Saved! ✅', 'Your changes have been saved.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert('Discard Changes?', 'You have unsaved changes. Are you sure you want to go back?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.backBtn}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.screenTitle}>✏️ Edit Exercise</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Photo */}
          {photoUri ? (
            <Animated.View entering={FadeInDown.springify()}>
              <TouchableOpacity
                onPress={handleReplacePhoto}
                disabled={uploadingPhoto}
                accessibilityLabel="Exercise photo — tap to replace"
              >
                <Image source={{ uri: photoUri }} style={styles.photo} accessibilityLabel="Exercise photo" />
                <View style={styles.photoOverlay}>
                  <Ionicons name="camera" size={20} color={Colors.textWhite} />
                  <Text style={styles.photoOverlayText}>
                    {uploadingPhoto ? 'Uploading…' : 'Replace Photo'}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity style={styles.addPhoto} onPress={handleReplacePhoto}>
              <Ionicons name="camera-outline" size={28} color={Colors.textLight} />
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>
          )}

          {/* Name + Emoji */}
          <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.card}>
            <Text style={styles.fieldLabel}>Exercise</Text>
            <View style={styles.nameRow}>
              <TextInput
                style={styles.emojiInput}
                value={exerciseEmoji}
                onChangeText={(v) => { setExerciseEmoji(v); markChanged(); }}
                maxLength={2}
                accessibilityLabel="Exercise emoji"
              />
              <TextInput
                style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                value={exerciseName}
                onChangeText={(v) => { setExerciseName(v); markChanged(); }}
                placeholder="Exercise name"
                placeholderTextColor={Colors.textMuted}
                accessibilityLabel="Exercise name"
              />
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Date &amp; Time</Text>
            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeField}>
                <Ionicons name="calendar-outline" size={15} color={Colors.textLight} style={styles.dateTimeIcon} />
                <TextInput
                  style={styles.dateTimeInput}
                  value={dateInput}
                  onChangeText={(v) => { setDateInput(v); markChanged(); }}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel="Log date"
                />
              </View>
              <View style={styles.dateTimeField}>
                <Ionicons name="time-outline" size={15} color={Colors.textLight} style={styles.dateTimeIcon} />
                <TextInput
                  style={styles.dateTimeInput}
                  value={timeInput}
                  onChangeText={(v) => { setTimeInput(v); markChanged(); }}
                  placeholder="12:00 PM"
                  placeholderTextColor={Colors.textMuted}
                  accessibilityLabel="Log time"
                />
              </View>
            </View>
          </Animated.View>

          {/* Duration */}
          <Animated.View entering={FadeInDown.delay(130).springify()} style={styles.card}>
            <Text style={styles.fieldLabel}>Duration (minutes)</Text>
            <View style={styles.durationRow}>
              <View style={styles.durationBtnGroup}>
                {([-10, -5, -1] as const).map((d) => (
                  <TouchableOpacity key={d} style={styles.durationBtn} onPress={() => adjustDuration(d)}>
                    <Text style={styles.durationBtnText}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.durationInput}
                value={duration}
                onChangeText={(v) => { setDuration(v); markChanged(); }}
                keyboardType="numeric"
                textAlign="center"
                accessibilityLabel="Duration in minutes"
              />
              <View style={styles.durationBtnGroup}>
                {([1, 5, 10] as const).map((d) => (
                  <TouchableOpacity key={d} style={[styles.durationBtn, styles.durationBtnAdd]} onPress={() => adjustDuration(d)}>
                    <Text style={[styles.durationBtnText, styles.durationBtnTextAdd]}>+{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* Calories */}
          <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.card}>
            <Text style={styles.fieldLabel}>Calories Burned 🔥</Text>
            <View style={styles.calorieRow}>
              <TextInput
                style={styles.calorieInput}
                value={calories}
                onChangeText={(v) => { setCalories(v); markChanged(); }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                accessibilityLabel="Calories burned"
              />
              <Text style={styles.calorieUnit}>cal</Text>
            </View>
            <Text style={styles.calorieHint}>
              * Estimated burn — actual results vary by weight, intensity, and fitness level.
            </Text>
          </Animated.View>

          {/* How did it feel */}
          <Animated.View entering={FadeInDown.delay(190).springify()} style={styles.card}>
            <Text style={styles.fieldLabel}>How did it feel? (optional)</Text>
            <View style={styles.feltGrid}>
              {FELT_OPTIONS.map(({ value, emoji, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.feltBtn, felt === value && styles.feltBtnActive]}
                  onPress={() => { setFelt(felt === value ? null : value); markChanged(); }}
                  testID={`felt-btn-${value}`}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <Text style={styles.feltEmoji}>{emoji}</Text>
                  <Text style={[styles.feltLabel, felt === value && styles.feltLabelActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Notes */}
          <Animated.View entering={FadeInDown.delay(220).springify()} style={styles.card}>
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={(v) => { setNotes(v); markChanged(); }}
              placeholder="Optional notes about this workout…"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              accessibilityLabel="Notes"
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.buttons}>
            <Button title="💾 Save Changes" gradient size="lg" loading={saving} onPress={handleSave} />
            <Button title="Cancel" variant="ghost" onPress={handleCancel} />
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
    marginBottom: 16,
  },
  backBtn: { padding: 4 },
  screenTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    color: Colors.text,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: Colors.border,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 24,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  photoOverlayText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.textWhite,
  },
  addPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 100,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addPhotoText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.textLight,
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
  fieldLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.text,
    marginBottom: 8,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  textInput: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  dateTimeRow: { flexDirection: 'row', gap: 10 },
  dateTimeField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dateTimeIcon: { marginRight: 6 },
  dateTimeInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.text,
  },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  durationBtnGroup: { flexDirection: 'row', gap: 4 },
  durationBtn: {
    width: 36,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBtnAdd: {
    backgroundColor: Colors.secondary + '12',
    borderColor: Colors.secondary + '88',
  },
  durationBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: Colors.text,
  },
  durationBtnTextAdd: { color: Colors.secondary },
  durationInput: {
    flex: 1,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 32,
    color: Colors.secondary,
    borderWidth: 1.5,
    borderColor: Colors.secondary + '55',
    borderRadius: 12,
    paddingVertical: 6,
  },
  calorieRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  calorieInput: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 32,
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
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    fontStyle: 'italic',
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
  feltLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: Colors.textLight,
    textAlign: 'center',
  },
  feltLabelActive: { fontFamily: 'Nunito_700Bold', color: Colors.secondary },
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
  buttons: { gap: 10, marginTop: 8 },
});
