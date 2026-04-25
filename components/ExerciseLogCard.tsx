import React, { useState } from 'react';
import { Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useExerciseLogStore } from '../store/exerciseLogStore';
import { ExerciseLog, ExerciseFelt } from '../types';
import { Colors } from '../constants/Colors';

const FELT_META: Record<ExerciseFelt, { emoji: string; label: string; color: string }> = {
  easy:       { emoji: '😌', label: 'Easy',       color: '#4CAF50' },
  good:       { emoji: '💪', label: 'Good',       color: '#2196F3' },
  hard:       { emoji: '😤', label: 'Hard',       color: '#FF9800' },
  exhausting: { emoji: '😵', label: 'Exhausting', color: '#F44336' },
};

interface ExerciseLogCardProps {
  log: ExerciseLog;
  index?: number;
  onDelete: (id: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return (
    date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' — ' +
    date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

export function ExerciseLogCard({ log, index = 0, onDelete, isFavorite, onToggleFavorite }: ExerciseLogCardProps) {
  const { session, isGuest } = useAuthStore();
  const { updateExerciseLog } = useExerciseLogStore();
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [replacing, setReplacing] = useState(false);

  const goToEdit = () =>
    router.push({ pathname: '/edit-exercise/[id]', params: { id: log.id } });

  const handleDelete = () => {
    Alert.alert(
      'Delete Exercise',
      `Are you sure you want to delete "${log.exercise_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(log.id) },
      ]
    );
  };

  const handlePhotoPress = () => {
    if (!log.photo_url) {
      goToEdit();
      return;
    }
    Alert.alert(
      log.exercise_name,
      undefined,
      [
        { text: 'View Full Screen', onPress: () => setShowPhotoModal(true) },
        { text: 'Replace Photo', onPress: handleReplacePhoto },
        { text: 'Edit Entry', onPress: goToEdit },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleReplacePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    setReplacing(true);
    try {
      const { base64, uri } = result.assets[0];
      let newUrl = uri;
      if (!isGuest && session) {
        const fileName = `exercise-photos/${session.user.id}/${log.id}_${Date.now()}.jpg`;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const { error } = await supabase.storage
          .from('meal-photos')
          .upload(fileName, bytes.buffer, { contentType: 'image/jpeg', upsert: true });
        if (!error) {
          const { data } = supabase.storage.from('meal-photos').getPublicUrl(fileName);
          newUrl = data.publicUrl;
        }
      }
      await updateExerciseLog(log.id, { photo_url: newUrl }, session?.user.id, isGuest);
    } catch {
      Alert.alert('Error', 'Failed to replace photo. Please try again.');
    } finally {
      setReplacing(false);
    }
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      {log.photo_url && (
        <Modal
          visible={showPhotoModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPhotoModal(false)}
          statusBarTranslucent
        >
          <View style={styles.photoModalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setShowPhotoModal(false)}
              activeOpacity={1}
            />
            <Image
              source={{ uri: log.photo_url }}
              style={styles.fullScreenPhoto}
              resizeMode="contain"
            />
            <TouchableOpacity style={styles.closePhotoBtn} onPress={() => setShowPhotoModal(false)}>
              <View style={styles.closePhotoBtnInner}>
                <Text style={styles.closePhotoBtnText}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      <View style={styles.card}>
        {/* ── horizontal body: photo/icon + content ── */}
        <View style={styles.cardBody}>
          {/* Left column — photo if available, otherwise emoji tile (same 80×80 footprint) */}
          {log.photo_url ? (
            <TouchableOpacity
              onPress={handlePhotoPress}
              style={styles.photoContainer}
              testID="photo-container"
              disabled={replacing}
              accessibilityLabel={`Photo of ${log.exercise_name} — tap for options`}
            >
              <Image
                source={{ uri: log.photo_url }}
                style={styles.photo}
                accessibilityLabel={`Photo of ${log.exercise_name}`}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={goToEdit}
              style={styles.iconContainer}
              testID="icon-container"
              accessibilityRole="button"
              accessibilityLabel={`${log.exercise_name} icon — tap to edit`}
            >
              <Text style={styles.emoji}>{log.exercise_emoji}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.content}>
            {/* Tappable "View or Edit" strip — mirrors food card pattern */}
            <TouchableOpacity
              onPress={goToEdit}
              style={styles.entryHeader}
              testID="edit-header-btn"
              accessibilityRole="button"
              accessibilityLabel="View or edit this entry"
            >
              <Ionicons name="pencil-outline" size={12} color={Colors.secondary} />
              <Text style={styles.entryHeaderText}>View or Edit this Entry</Text>
              <Ionicons name="chevron-forward-outline" size={12} color={Colors.secondary} />
            </TouchableOpacity>

            <Text style={styles.exerciseName} numberOfLines={1}>
              {log.exercise_name}
            </Text>

            <Text style={styles.dateTime}>{formatDateTime(log.logged_at)}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statBadge}>
                <Text style={styles.statEmoji}>⏱️</Text>
                <Text style={styles.statValue}>{log.duration_minutes} min</Text>
              </View>
              <View style={[styles.statBadge, styles.calorieBadge]}>
                <Text style={styles.statEmoji}>🔥</Text>
                <Text style={[styles.statValue, styles.calorieValue]}>
                  −{Math.round(log.calories_burned)} cal
                </Text>
              </View>
              {log.felt && (
                <View style={[styles.statBadge, { backgroundColor: FELT_META[log.felt].color + '18' }]}>
                  <Text style={styles.statEmoji}>{FELT_META[log.felt].emoji}</Text>
                  <Text style={[styles.statValue, { color: FELT_META[log.felt].color }]}>
                    {FELT_META[log.felt].label}
                  </Text>
                </View>
              )}
            </View>

            {log.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>📝 Notes</Text>
                <Text style={styles.notesText}>{log.notes}</Text>
              </View>
            ) : null}

            <Text style={styles.disclaimer}>
              * Calorie burn is estimated — actual results vary by weight, intensity, and fitness level.
            </Text>
          </View>
        </View>

        {/* ── action bar ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={goToEdit}
            style={styles.actionBtn}
            testID="edit-btn"
            accessibilityRole="button"
            accessibilityLabel="Edit this exercise"
          >
            <Ionicons name="pencil-outline" size={18} color={Colors.secondary} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>

          {onToggleFavorite && (
            <>
              <View style={styles.actionDivider} />
              <TouchableOpacity
                onPress={onToggleFavorite}
                style={styles.actionBtn}
                testID="favorite-btn"
                accessibilityRole="button"
                accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={18}
                  color={isFavorite ? '#E91E63' : Colors.textMuted}
                />
                <Text style={[styles.actionBtnText, isFavorite && styles.actionFaveActive]}>
                  {isFavorite ? 'Saved' : 'Favorite'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.actionDivider} />

          <TouchableOpacity
            onPress={handleDelete}
            style={styles.actionBtn}
            testID="delete-btn"
            accessibilityRole="button"
            accessibilityLabel="Delete this exercise"
          >
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
            <Text style={[styles.actionBtnText, styles.actionDeleteText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.secondary + '15',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.secondary + '40',
    overflow: 'hidden',
  },
  cardBody: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },

  // ── left column ──────────────────────────────────────────────────────────────
  photoContainer: { alignSelf: 'flex-start' },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: Colors.secondary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  emoji: { fontSize: 34 },

  // ── right content ─────────────────────────────────────────────────────────────
  content: { flex: 1 },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.secondary + '30',
  },
  entryHeaderText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.secondary,
    flex: 1,
  },
  exerciseName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: Colors.text,
    marginBottom: 2,
  },
  dateTime: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: Colors.textLight,
    marginBottom: 8,
  },
  statsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  calorieBadge: { backgroundColor: Colors.success + '20' },
  statEmoji: { fontSize: 13 },
  statValue: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: Colors.text },
  calorieValue: { color: Colors.success },
  notesBox: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.secondary,
  },
  notesLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: Colors.textLight,
    marginBottom: 2,
  },
  notesText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  disclaimer: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 14,
  },

  // ── action bar ──────────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.secondary + '30',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    minHeight: 48,
  },
  actionBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.secondary,
  },
  actionFaveActive: { color: '#E91E63' },
  actionDeleteText: { color: Colors.error },
  actionDivider: {
    width: 1,
    backgroundColor: Colors.secondary + '30',
    marginVertical: 8,
  },

  // ── full-screen photo modal ──────────────────────────────────────────────────
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenPhoto: { width: '100%', height: '80%' },
  closePhotoBtn: { position: 'absolute', top: 52, right: 20 },
  closePhotoBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  closePhotoBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Nunito_700Bold' },
});
