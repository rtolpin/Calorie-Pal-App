import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { FoodLog } from '../types';
import { MacroRow } from './ui/MacroBadge';
import { Colors } from '../constants/Colors';

interface FoodLogCardProps {
  log: FoodLog;
  index?: number;
  onDelete: (id: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }) + ' — ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function FoodLogCard({ log, index = 0, onDelete, isFavorite, onToggleFavorite }: FoodLogCardProps) {
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const handleDelete = () => {
    Alert.alert(
      'Delete Entry',
      `Are you sure you want to delete "${log.meal_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(log.id) },
      ]
    );
  };

  const goToEdit = () => router.push({ pathname: '/edit-entry/[id]', params: { id: log.id } });

  const handlePhotoPress = () => {
    if (!log.photo_url) {
      goToEdit();
      return;
    }
    Alert.alert(
      log.meal_name,
      undefined,
      [
        { text: 'View Full Screen', onPress: () => setShowPhotoModal(true) },
        { text: 'Replace Photo', onPress: goToEdit },
        { text: 'View Details', onPress: goToEdit },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
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
            <TouchableOpacity
              style={styles.closePhotoBtn}
              onPress={() => setShowPhotoModal(false)}
            >
              <View style={styles.closePhotoBtnInner}>
                <Text style={styles.closePhotoBtnText}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      <View style={styles.card}>
        {/* ── horizontal body: photo + content ── */}
        <View style={styles.cardBody}>
          <TouchableOpacity onPress={handlePhotoPress} style={styles.photoContainer} testID="photo-container">
            {log.photo_url ? (
              <Image
                source={{ uri: log.photo_url }}
                style={styles.photo}
                accessibilityLabel={`Photo of ${log.meal_name}`}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoEmoji}>🍽️</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.content}>
            <TouchableOpacity
              onPress={goToEdit}
              style={styles.editEntryHeader}
              testID="edit-header-btn"
              accessibilityLabel="View or edit this entry"
            >
              <Ionicons name="pencil-outline" size={12} color={Colors.secondary} />
              <Text style={styles.editEntryHeaderText}>View or Edit this Entry</Text>
              <Ionicons name="chevron-forward-outline" size={12} color={Colors.secondary} />
            </TouchableOpacity>

            <Text style={styles.mealName} numberOfLines={1}>
              {log.meal_name}
            </Text>

            <Text style={styles.dateTime}>{formatDateTime(log.logged_at)}</Text>

            <Text style={styles.calories}>
              {Math.round(log.calories)}{' '}
              <Text style={styles.calLabel}>cal</Text>
            </Text>

            <MacroRow
              protein={log.protein_g}
              carbs={log.carbs_g}
              fat={log.fat_g}
              fiber={log.fiber_g}
              size="sm"
            />

            {log.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>📝 Notes</Text>
                <Text style={styles.notesText}>{log.notes}</Text>
              </View>
            ) : null}

            <Text style={styles.aiDisclaimer}>
              * Calorie estimate generated by AI — values are approximate.
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
            accessibilityLabel="Edit this entry"
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
            accessibilityLabel="Delete this entry"
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
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  cardBody: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  photoContainer: {
    alignSelf: 'flex-start',
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmoji: { fontSize: 30 },
  content: { flex: 1 },
  editEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  editEntryHeaderText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: Colors.secondary,
    flex: 1,
  },
  mealName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: Colors.text,
    marginBottom: 2,
  },
  dateTime: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: Colors.textLight,
    marginBottom: 4,
  },
  calories: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: Colors.primary,
    marginBottom: 6,
  },
  calLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: Colors.textLight,
  },
  notesBox: {
    marginTop: 8,
    backgroundColor: Colors.background,
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
  aiDisclaimer: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 6,
    fontStyle: 'italic',
  },

  // ── action bar ──────────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
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
  actionFaveActive: {
    color: '#E91E63',
  },
  actionDeleteText: {
    color: Colors.error,
  },
  actionDivider: {
    width: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 8,
  },

  // ── full-screen photo modal ──────────────────────────────────────────────────
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenPhoto: {
    width: '100%',
    height: '80%',
  },
  closePhotoBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
  },
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
  closePhotoBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
  },
});
