import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExerciseLog, FoodLog, UserProfile } from '../types';

const KEYS = {
  GUEST_LOGS: 'guest_food_logs',
  GUEST_EXERCISE_LOGS: 'guest_exercise_logs',
  GUEST_SCAN_COUNT: 'guest_scan_count',
  GUEST_PROFILE: 'guest_profile',
};

export async function getGuestLogs(): Promise<FoodLog[]> {
  const raw = await AsyncStorage.getItem(KEYS.GUEST_LOGS);
  if (!raw) return [];
  return JSON.parse(raw) as FoodLog[];
}

export async function saveGuestLog(log: FoodLog): Promise<void> {
  const existing = await getGuestLogs();
  const updated = [log, ...existing];
  await AsyncStorage.setItem(KEYS.GUEST_LOGS, JSON.stringify(updated));
}

export async function updateGuestLog(id: string, updates: Partial<FoodLog>): Promise<void> {
  const existing = await getGuestLogs();
  const updated = existing.map((log) => (log.id === id ? { ...log, ...updates } : log));
  await AsyncStorage.setItem(KEYS.GUEST_LOGS, JSON.stringify(updated));
}

export async function deleteGuestLog(id: string): Promise<void> {
  const existing = await getGuestLogs();
  const updated = existing.filter((log) => log.id !== id);
  await AsyncStorage.setItem(KEYS.GUEST_LOGS, JSON.stringify(updated));
}

export async function getGuestScanCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEYS.GUEST_SCAN_COUNT);
  return raw ? parseInt(raw, 10) : 0;
}

export async function incrementGuestScanCount(): Promise<number> {
  const current = await getGuestScanCount();
  const next = current + 1;
  await AsyncStorage.setItem(KEYS.GUEST_SCAN_COUNT, String(next));
  return next;
}

export async function getGuestProfile(): Promise<Partial<UserProfile> | null> {
  const raw = await AsyncStorage.getItem(KEYS.GUEST_PROFILE);
  if (!raw) return null;
  return JSON.parse(raw) as Partial<UserProfile>;
}

export async function saveGuestProfile(profile: Partial<UserProfile>): Promise<void> {
  await AsyncStorage.setItem(KEYS.GUEST_PROFILE, JSON.stringify(profile));
}

export async function getGuestExerciseLogs(): Promise<ExerciseLog[]> {
  const raw = await AsyncStorage.getItem(KEYS.GUEST_EXERCISE_LOGS);
  if (!raw) return [];
  return JSON.parse(raw) as ExerciseLog[];
}

export async function saveGuestExerciseLog(log: ExerciseLog): Promise<void> {
  const existing = await getGuestExerciseLogs();
  await AsyncStorage.setItem(KEYS.GUEST_EXERCISE_LOGS, JSON.stringify([log, ...existing]));
}

export async function updateGuestExerciseLog(id: string, updates: Partial<ExerciseLog>): Promise<void> {
  const existing = await getGuestExerciseLogs();
  const updated = existing.map((log) => (log.id === id ? { ...log, ...updates } : log));
  await AsyncStorage.setItem(KEYS.GUEST_EXERCISE_LOGS, JSON.stringify(updated));
}

export async function deleteGuestExerciseLog(id: string): Promise<void> {
  const existing = await getGuestExerciseLogs();
  await AsyncStorage.setItem(
    KEYS.GUEST_EXERCISE_LOGS,
    JSON.stringify(existing.filter((log) => log.id !== id))
  );
}

export async function clearGuestData(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEYS.GUEST_LOGS,
    KEYS.GUEST_EXERCISE_LOGS,
    KEYS.GUEST_SCAN_COUNT,
    KEYS.GUEST_PROFILE,
  ]);
}

export function generateId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Water intake (cups per day, keyed by date)
export async function getWaterCups(date: string): Promise<number> {
  const raw = await AsyncStorage.getItem(`water_cups_${date}`);
  return raw ? parseInt(raw, 10) : 0;
}

export async function setWaterCups(date: string, cups: number): Promise<void> {
  await AsyncStorage.setItem(`water_cups_${date}`, String(Math.max(0, cups)));
}

// Water goal (global, not per-date — user sets once)
const WATER_GOAL_KEY = 'water_goal_cups';
const DEFAULT_WATER_GOAL = 8;

export async function getWaterGoal(): Promise<number> {
  const raw = await AsyncStorage.getItem(WATER_GOAL_KEY);
  return raw ? parseInt(raw, 10) : DEFAULT_WATER_GOAL;
}

export async function saveWaterGoal(cups: number): Promise<void> {
  const clamped = Math.min(20, Math.max(1, cups));
  await AsyncStorage.setItem(WATER_GOAL_KEY, String(clamped));
}

// Mood logging (keyed by date)
export type Mood = 'great' | 'good' | 'okay' | 'low' | 'stressed' | 'tired';

export async function getMood(date: string): Promise<Mood | null> {
  const raw = await AsyncStorage.getItem(`mood_${date}`);
  return (raw as Mood) || null;
}

export async function setMood(date: string, mood: Mood): Promise<void> {
  await AsyncStorage.setItem(`mood_${date}`, mood);
}
