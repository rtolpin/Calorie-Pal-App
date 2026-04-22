import React from 'react';
import {
  Alert,
  Image,
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

export function FoodLogCard({ log, index = 0, onDelete }: FoodLogCardProps) {
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

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <View style={styles.card}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/edit-entry/[id]', params: { id: log.id } })}
          style={styles.photoContainer}
        >
          {log.photo_url ? (
            <Image source={{ uri: log.photo_url }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoEmoji}>🍽️</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.mealName} numberOfLines={1}>
              {log.meal_name}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: '/edit-entry/[id]', params: { id: log.id } })
                }
                style={styles.actionBtn}
              >
                <Ionicons name="pencil-outline" size={18} color={Colors.secondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>

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
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  photoContainer: {
    alignSelf: 'flex-start',
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  photoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmoji: { fontSize: 28 },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  mealName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 4 },
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
});
