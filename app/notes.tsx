import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { useFocusEffect } from 'expo-router';
import {
  getMood, setMood, getDailyNote, setDailyNote,
  getWaterCups, getWaterGoal, getAllWellnessDates, Mood,
} from '../lib/asyncStorage';
import { getMoodColor, getMoodQuote } from '../lib/journalUtils';
import { toLocalDateStr } from '../lib/dateUtils';
import { Colors } from '../constants/Colors';

const MOOD_META: Record<Mood, { emoji: string; label: string }> = {
  great:   { emoji: '😄', label: 'Great' },
  good:    { emoji: '😊', label: 'Good' },
  okay:    { emoji: '😐', label: 'Okay' },
  low:     { emoji: '😞', label: 'Low' },
  stressed:{ emoji: '😤', label: 'Stressed' },
  tired:   { emoji: '😴', label: 'Tired' },
};

const MOODS: { mood: Mood; emoji: string; label: string }[] = [
  { mood: 'great',    emoji: '😄', label: 'Great' },
  { mood: 'good',     emoji: '😊', label: 'Good' },
  { mood: 'okay',     emoji: '😐', label: 'Okay' },
  { mood: 'low',      emoji: '😞', label: 'Low' },
  { mood: 'stressed', emoji: '😤', label: 'Stressed' },
  { mood: 'tired',    emoji: '😴', label: 'Tired' },
];

interface NoteEntry {
  date: string;
  note: string | null;
  mood: Mood | null;
  waterCups: number;
  waterGoal: number;
}

function formatNoteDate(dateStr: string): string {
  const today = toLocalDateStr(new Date());
  const yesterday = toLocalDateStr(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function NotesScreen() {
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [waterGoalVal, setWaterGoalVal] = useState(8);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [modalNote, setModalNote] = useState('');
  const [modalMood, setModalMood] = useState<Mood | null>(null);
  const [saving, setSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    const goal = await getWaterGoal();
    setWaterGoalVal(goal);

    const todayStr = toLocalDateStr(new Date());
    const dates = await getAllWellnessDates();

    // Always include today so the user can add a note even if none exists yet
    const allDates = dates.includes(todayStr) ? dates : [todayStr, ...dates];

    const loaded: NoteEntry[] = await Promise.all(
      allDates.map(async (date) => {
        const [note, mood, cups] = await Promise.all([
          getDailyNote(date),
          getMood(date),
          getWaterCups(date),
        ]);
        return { date, note, mood, waterCups: cups, waterGoal: goal };
      })
    );
    setEntries(loaded);
  }, []);

  useFocusEffect(useCallback(() => { loadEntries(); }, [loadEntries]));

  const openModal = (entry: NoteEntry) => {
    setModalDate(entry.date);
    setModalNote(entry.note ?? '');
    setModalMood(entry.mood);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDailyNote(modalDate, modalNote);
      if (modalMood) await setMood(modalDate, modalMood);

      // Update the entry directly in state — faster and more reliable than a full reload
      const savedNote = modalNote.trim() || null;
      const savedMood = modalMood;
      setEntries((prev) => {
        const exists = prev.some((e) => e.date === modalDate);
        if (exists) {
          return prev.map((e) =>
            e.date === modalDate ? { ...e, note: savedNote, mood: savedMood } : e
          );
        }
        // Brand-new date — insert sorted newest-first
        const fresh: NoteEntry = {
          date: modalDate,
          note: savedNote,
          mood: savedMood,
          waterCups: 0,
          waterGoal: waterGoalVal,
        };
        return [fresh, ...prev].sort((a, b) => b.date.localeCompare(a.date));
      });

      // Clear form and close
      setModalNote('');
      setModalMood(null);
      setShowModal(false);
    } catch {
      Alert.alert('Error', 'Could not save your note. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>📓 Journal Notes</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            const today = toLocalDateStr(new Date());
            const todayEntry = entries.find((e) => e.date === today);
            openModal(todayEntry ?? { date: today, note: null, mood: null, waterCups: 0, waterGoal: waterGoalVal });
          }}
          accessibilityLabel="Add today's note"
        >
          <Ionicons name="add" size={22} color={Colors.textWhite} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {entries.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button to write your first journal entry!
            </Text>
          </View>
        )}

        {entries.map((entry, i) => {
          const mc = entry.mood ? getMoodColor(entry.mood) : null;
          const meta = entry.mood ? MOOD_META[entry.mood] : null;
          const hasContent = entry.note || entry.mood;

          return (
            <Animated.View
              key={entry.date}
              entering={FadeInDown.delay(i * 50).springify()}
              style={[styles.entryCard, mc && { backgroundColor: mc.bg, borderColor: mc.border }]}
            >
              {/* Date header */}
              <View style={styles.entryDateRow}>
                <Text style={[styles.entryDate, mc && { color: mc.text }]}>
                  {formatNoteDate(entry.date)}
                </Text>
                <TouchableOpacity
                  onPress={() => openModal(entry)}
                  style={styles.editBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`${hasContent ? 'Edit' : 'Add'} note for ${formatNoteDate(entry.date)}`}
                >
                  <Ionicons name="pencil-outline" size={14} color={mc?.text ?? Colors.primary} />
                  <Text style={[styles.editBtnText, mc && { color: mc.text }]}>
                    {hasContent ? 'Edit' : 'Add Note'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Mood + water row */}
              {(meta || entry.waterCups > 0) && (
                <View style={styles.wellnessRow}>
                  {meta && (
                    <View style={styles.wellnessPill}>
                      <Text style={styles.pillEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.pillText, mc && { color: mc.text }]}>
                        {meta.label}
                      </Text>
                    </View>
                  )}
                  {entry.waterCups > 0 && (
                    <View style={styles.wellnessPill}>
                      <Text style={styles.pillEmoji}>💧</Text>
                      <Text style={[styles.pillText, mc && { color: mc.text }]}>
                        {entry.waterCups}/{entry.waterGoal} cups
                        {entry.waterCups >= entry.waterGoal ? ' ✅' : ''}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Motivational quote */}
              {entry.mood && (
                <Text style={[styles.quote, mc && { color: mc.text + 'BB' }]}>
                  "{getMoodQuote(entry.mood)}"
                </Text>
              )}

              {/* Note text */}
              {entry.note ? (
                <Text style={[styles.noteText, mc && { color: mc.text }]}>{entry.note}</Text>
              ) : (
                <TouchableOpacity onPress={() => openModal(entry)}>
                  <Text style={styles.noNoteHint}>
                    Tap "Add Note" to write about your day…
                  </Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Edit / Add Note modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: Colors.background }}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => { setModalNote(''); setModalMood(null); setShowModal(false); }}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {formatNoteDate(modalDate)}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.modalSaveBtn}>
              <Text style={[styles.modalSaveText, saving && { opacity: 0.4 }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalSectionLabel}>How are you feeling?</Text>
            <View style={styles.moodGrid}>
              {MOODS.map(({ mood, emoji, label }) => {
                const mc = getMoodColor(mood);
                const active = modalMood === mood;
                return (
                  <TouchableOpacity
                    key={mood}
                    style={[styles.moodBtn, active && { backgroundColor: mc.bg, borderColor: mc.border }]}
                    onPress={() => setModalMood(active ? null : mood)}
                  >
                    <Text style={styles.moodEmoji}>{emoji}</Text>
                    <Text style={[styles.moodLabel, active && { color: mc.text, fontFamily: 'Nunito_700Bold' }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {modalMood && (
              <View style={[styles.quoteBox, { backgroundColor: getMoodColor(modalMood).bg, borderColor: getMoodColor(modalMood).border }]}>
                <Text style={[styles.quoteBoxText, { color: getMoodColor(modalMood).text }]}>
                  "{getMoodQuote(modalMood)}"
                </Text>
              </View>
            )}

            <Text style={[styles.modalSectionLabel, { marginTop: 20 }]}>Your note for this day</Text>
            <Text style={styles.noteHint}>
              How was your day? What did you eat? How did you feel after your workout?
            </Text>
            <TextInput
              style={styles.noteInput}
              value={modalNote}
              onChangeText={setModalNote}
              placeholder="Write anything — meals, energy levels, goals, wins…"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={7}
              textAlignVertical="top"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: Colors.text },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 16, paddingBottom: 40, gap: 12 },

  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: Colors.text, marginBottom: 8 },
  emptySubtitle: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: Colors.textLight, textAlign: 'center' },

  entryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 8,
  },
  entryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryDate: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
    color: Colors.text,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  editBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.primary,
  },
  wellnessRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  wellnessPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pillEmoji: { fontSize: 13 },
  pillText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: Colors.text },
  quote: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textLight,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  noteText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  noNoteHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },

  // Modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalCancelBtn: { minWidth: 60 },
  modalCancelText: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: Colors.textLight },
  modalTitle: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: Colors.text },
  modalSaveBtn: { minWidth: 60, alignItems: 'flex-end' },
  modalSaveText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: Colors.primary },
  modalContent: { padding: 16, paddingBottom: 40 },
  modalSectionLabel: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: Colors.text, marginBottom: 10 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  moodBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    minWidth: '30%',
    flex: 1,
  },
  moodEmoji: { fontSize: 22, marginBottom: 4 },
  moodLabel: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: Colors.textLight, textAlign: 'center' },
  quoteBox: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    marginTop: 8,
  },
  quoteBoxText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  noteHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  noteInput: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    minHeight: 180,
    backgroundColor: Colors.surface,
    lineHeight: 22,
  },
});
