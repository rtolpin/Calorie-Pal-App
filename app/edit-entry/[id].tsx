import React, { useEffect, useState } from 'react';

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
  const [m, d, y] = dateStr.split('/').map(Number);
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return new Date().toISOString();
  let h = parseInt(match[1]);
  const min = parseInt(match[2]);
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  const result = new Date(y, m - 1, d, h, min);
  return isNaN(result.getTime()) ? new Date().toISOString() : result.toISOString();
}
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
import { useFoodLogStore } from '../../store/foodLogStore';
import { Button } from '../../components/ui/Button';
import { Colors } from '../../constants/Colors';

const FIELDS: { key: string; label: string; unit: string; emoji: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'cal', emoji: '🔥' },
  { key: 'protein_g', label: 'Protein', unit: 'g', emoji: '💪' },
  { key: 'carbs_g', label: 'Carbohydrates', unit: 'g', emoji: '🌾' },
  { key: 'fat_g', label: 'Fat', unit: 'g', emoji: '🥑' },
  { key: 'fiber_g', label: 'Fiber', unit: 'g', emoji: '🥦' },
  { key: 'sugar_g', label: 'Sugar', unit: 'g', emoji: '🍬' },
  { key: 'sodium_mg', label: 'Sodium', unit: 'mg', emoji: '🧂' },
  { key: 'cholesterol_mg', label: 'Cholesterol', unit: 'mg', emoji: '🫀' },
  { key: 'saturated_fat_g', label: 'Saturated Fat', unit: 'g', emoji: '🧈' },
];

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isGuest } = useAuthStore();
  const { logs, updateLog } = useFoodLogStore();

  const log = logs.find((l) => l.id === id);

  const [mealName, setMealName] = useState(log?.meal_name || '');
  const [notes, setNotes] = useState(log?.notes || '');
  const [photoUri, setPhotoUri] = useState(log?.photo_url || '');
  const initialDate = log ? new Date(log.logged_at) : new Date();
  const [dateInput, setDateInput] = useState(formatDateInput(initialDate));
  const [timeInput, setTimeInput] = useState(formatTimeInput(initialDate));
  const [values, setValues] = useState<Record<string, string>>({
    calories: String(log?.calories || 0),
    protein_g: String(log?.protein_g || 0),
    carbs_g: String(log?.carbs_g || 0),
    fat_g: String(log?.fat_g || 0),
    fiber_g: String(log?.fiber_g || 0),
    sugar_g: String(log?.sugar_g || 0),
    sodium_mg: String(log?.sodium_mg || 0),
    cholesterol_mg: String(log?.cholesterol_mg || 0),
    saturated_fat_g: String(log?.saturated_fat_g || 0),
  });
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!log) {
      Alert.alert('Not Found', 'This meal entry could not be found.');
      router.back();
    }
  }, [log]);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleReplacePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setHasChanges(true);
    }
  };

  const handleSave = async () => {
    if (!mealName.trim()) {
      Alert.alert('Missing Info', 'Please enter a meal name.');
      return;
    }

    setSaving(true);
    try {
      await updateLog(
        id,
        {
          meal_name: mealName.trim(),
          calories: parseFloat(values.calories) || 0,
          protein_g: parseFloat(values.protein_g) || 0,
          carbs_g: parseFloat(values.carbs_g) || 0,
          fat_g: parseFloat(values.fat_g) || 0,
          fiber_g: parseFloat(values.fiber_g) || 0,
          sugar_g: parseFloat(values.sugar_g) || 0,
          sodium_mg: parseFloat(values.sodium_mg) || 0,
          cholesterol_mg: parseFloat(values.cholesterol_mg) || 0,
          saturated_fat_g: parseFloat(values.saturated_fat_g) || 0,
          notes: notes.trim() || undefined,
          logged_at: parseToISO(dateInput, timeInput),
          photo_url: photoUri || undefined,
        },
        session?.user.id,
        isGuest
      );
      Alert.alert('Saved! ✅', 'Your changes have been saved.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
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
            <TouchableOpacity onPress={handleCancel} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.screenTitle}>✏️ Edit Entry</Text>
            <View style={{ width: 40 }} />
          </View>

          {photoUri ? (
            <Animated.View entering={FadeInDown.springify()}>
              <TouchableOpacity onPress={handleReplacePhoto}>
                <Image source={{ uri: photoUri }} style={styles.photo} />
                <View style={styles.photoOverlay}>
                  <Ionicons name="camera" size={20} color={Colors.textWhite} />
                  <Text style={styles.photoOverlayText}>Replace Photo</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity style={styles.addPhoto} onPress={handleReplacePhoto}>
              <Ionicons name="camera-outline" size={28} color={Colors.textLight} />
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>
          )}

          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.card}>
            <Text style={styles.fieldLabel}>Meal Name</Text>
            <TextInput
              style={styles.textInput}
              value={mealName}
              onChangeText={(v) => { setMealName(v); setHasChanges(true); }}
              placeholder="Meal name"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.fieldLabel}>Date & Time</Text>
            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeField}>
                <Ionicons name="calendar-outline" size={15} color={Colors.textLight} style={styles.dateTimeIcon} />
                <TextInput
                  style={styles.dateTimeInput}
                  value={dateInput}
                  onChangeText={(v) => { setDateInput(v); setHasChanges(true); }}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.dateTimeField}>
                <Ionicons name="time-outline" size={15} color={Colors.textLight} style={styles.dateTimeIcon} />
                <TextInput
                  style={styles.dateTimeInput}
                  value={timeInput}
                  onChangeText={(v) => { setTimeInput(v); setHasChanges(true); }}
                  placeholder="12:00 PM"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.card}>
            <Text style={styles.cardTitle}>Nutrition</Text>
            {FIELDS.map((field) => (
              <View key={field.key} style={styles.fieldRow}>
                <Text style={styles.fieldEmoji}>{field.emoji}</Text>
                <Text style={styles.fieldName}>{field.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={values[field.key]}
                  onChangeText={(v) => handleChange(field.key, v)}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={styles.fieldUnit}>{field.unit}</Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.card}>
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={(v) => { setNotes(v); setHasChanges(true); }}
              placeholder="Optional notes about this meal..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.buttons}>
            <Button
              title="💾 Save Changes"
              gradient
              size="lg"
              loading={saving}
              onPress={handleSave}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={handleCancel}
            />
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
  cardTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: Colors.text,
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.text,
    marginBottom: 6,
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
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  fieldEmoji: { fontSize: 16, width: 22 },
  fieldName: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  fieldInput: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 70,
    textAlign: 'center',
  },
  fieldUnit: {
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
  buttons: { gap: 10, marginTop: 8 },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
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
});
