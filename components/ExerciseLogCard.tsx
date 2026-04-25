import React, { useState } from 'react';
import { Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    if (!log.photo_url) return;
    Alert.alert(
      log.exercise_name,
      undefined,
      [
        { text: 'View Full Screen', onPress: () => setShowPhotoModal(true) },
        { text: 'Replace Photo', onPress: handleReplacePhoto },
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
        {log.photo_url ? (
          <TouchableOpacity
            onPress={handlePhotoPress}
            style={styles.photoContainer}
            testID="photo-container"
            disabled={replacing}
          >
            <Image source={{ uri: log.photo_url }} style={styles.photo} accessibilityLabel={`Photo of ${log.exercise_name}`} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconContainer}>
            <Text style={styles.emoji}>{log.exercise_emoji}</Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.exerciseName} numberOfLines={1}>
              {log.photo_url ? `${log.exercise_emoji} ` : ''}{log.exercise_name}
            </Text>
            <View style={styles.headerActions}>
              {onToggleFavorite && (
                <TouchableOpacity
                  onPress={onToggleFavorite}
                  style={styles.favoriteBtn}
                  testID="favorite-btn"
                >
                  <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={18}
                    color={isFavorite ? '#E91E63' : Colors.textMuted}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} testID="delete-btn">
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.dateTime}>{formatDateTime(log.logged_at)}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBadge}>
              <Text style={styles.statEmoji}>⏱️</Text>
              <Text style={styles.statValue}>{log.duration_minutes} min</Text>
            </View>
            <View style={[styles.statBadge, styles.calorieBadge]}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={[styles.statValue, styles.calorieValue]}>
                −{Math.round(log.calories_burned)} cal burned
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
            * Calorie burn is estimated based on average metabolic rates for this activity type and duration. Actual calories burned vary by individual body weight, fitness level, and intensity.
          </Text>

          <View style={styles.detailFooter}>
            <Ionicons name="checkmark-circle-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.detailFooterText}>All details shown above</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.secondary + '15',
    borderRadius: 16,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.secondary + '40',
    gap: 12,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.secondary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  emoji: { fontSize: 26 },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  exerciseName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  favoriteBtn: { padding: 4 },
  deleteBtn: { padding: 4 },
  dateTime: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: Colors.textLight,
    marginBottom: 8,
  },
  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  calorieBadge: {
    backgroundColor: Colors.success + '20',
  },
  statEmoji: { fontSize: 13 },
  statValue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: Colors.text,
  },
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
  photoContainer: { alignSelf: 'flex-start' },
  photo: { width: 72, height: 72, borderRadius: 12 },
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
  detailFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.secondary + '30',
    justifyContent: 'flex-end',
  },
  detailFooterText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
});
