import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ExerciseLog } from '../types';
import { Colors } from '../constants/Colors';

interface ExerciseLogCardProps {
  log: ExerciseLog;
  index?: number;
  onDelete: (id: string) => void;
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

export function ExerciseLogCard({ log, index = 0, onDelete }: ExerciseLogCardProps) {
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

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Text style={styles.emoji}>{log.exercise_emoji}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.exerciseName} numberOfLines={1}>
              {log.exercise_name}
            </Text>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
            </TouchableOpacity>
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
          </View>

          {log.notes ? (
            <Text style={styles.notes} numberOfLines={1}>
              {log.notes}
            </Text>
          ) : null}
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
  notes: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 6,
    fontStyle: 'italic',
  },
});
