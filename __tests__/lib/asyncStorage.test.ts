import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getGuestLogs,
  saveGuestLog,
  updateGuestLog,
  deleteGuestLog,
  getGuestExerciseLogs,
  saveGuestExerciseLog,
  updateGuestExerciseLog,
  deleteGuestExerciseLog,
  getGuestScanCount,
  incrementGuestScanCount,
  getGuestProfile,
  saveGuestProfile,
  clearGuestData,
  generateId,
  getWaterCups,
  setWaterCups,
  getWaterGoal,
  saveWaterGoal,
  getMood,
  setMood,
  getDailyNote,
  setDailyNote,
  getFavoriteMealNames,
  toggleFavoriteMeal,
  getFavoriteExerciseNames,
  toggleFavoriteExercise,
  saveDayTemplate,
  getDayTemplate,
  clearDayTemplate,
  Mood,
} from '../../lib/asyncStorage';
import { DayTemplate } from '../../types';
import { FoodLog, ExerciseLog } from '../../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const MOCK_LOG: FoodLog = {
  id: 'log-1',
  user_id: 'guest',
  meal_name: 'Oatmeal',
  foods_detected: ['oats', 'banana'],
  calories: 350,
  protein_g: 10,
  carbs_g: 60,
  fat_g: 5,
  fiber_g: 6,
  sugar_g: 12,
  sodium_mg: 80,
  cholesterol_mg: 0,
  saturated_fat_g: 1,
  logged_at: '2026-04-25T08:00:00.000Z',
  created_at: '2026-04-25T08:00:00.000Z',
};

const MOCK_EXERCISE: ExerciseLog = {
  id: 'ex-1',
  user_id: 'guest',
  exercise_name: 'Running',
  exercise_emoji: '🏃',
  duration_minutes: 30,
  calories_burned: 300,
  logged_at: '2026-04-25T09:00:00.000Z',
  created_at: '2026-04-25T09:00:00.000Z',
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('Guest food logs', () => {
  it('returns empty array when no logs exist', async () => {
    expect(await getGuestLogs()).toEqual([]);
  });

  it('saves and retrieves a food log', async () => {
    await saveGuestLog(MOCK_LOG);
    const logs = await getGuestLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('log-1');
    expect(logs[0].meal_name).toBe('Oatmeal');
  });

  it('prepends new logs to the front', async () => {
    const log2 = { ...MOCK_LOG, id: 'log-2', meal_name: 'Lunch' };
    await saveGuestLog(MOCK_LOG);
    await saveGuestLog(log2);
    const logs = await getGuestLogs();
    expect(logs[0].id).toBe('log-2');
    expect(logs[1].id).toBe('log-1');
  });

  it('updates an existing log', async () => {
    await saveGuestLog(MOCK_LOG);
    await updateGuestLog('log-1', { calories: 500, meal_name: 'Big Oatmeal' });
    const logs = await getGuestLogs();
    expect(logs[0].calories).toBe(500);
    expect(logs[0].meal_name).toBe('Big Oatmeal');
    expect(logs[0].protein_g).toBe(10); // unchanged
  });

  it('update does not affect other logs', async () => {
    const log2 = { ...MOCK_LOG, id: 'log-2', meal_name: 'Lunch' };
    await saveGuestLog(MOCK_LOG);
    await saveGuestLog(log2);
    await updateGuestLog('log-1', { calories: 999 });
    const logs = await getGuestLogs();
    const unchanged = logs.find((l) => l.id === 'log-2');
    expect(unchanged?.calories).toBe(350);
  });

  it('deletes a log by id', async () => {
    await saveGuestLog(MOCK_LOG);
    await deleteGuestLog('log-1');
    const logs = await getGuestLogs();
    expect(logs).toHaveLength(0);
  });

  it('delete does not affect other logs', async () => {
    const log2 = { ...MOCK_LOG, id: 'log-2' };
    await saveGuestLog(MOCK_LOG);
    await saveGuestLog(log2);
    await deleteGuestLog('log-1');
    const logs = await getGuestLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('log-2');
  });
});

describe('Guest exercise logs', () => {
  it('returns empty array when no exercise logs exist', async () => {
    expect(await getGuestExerciseLogs()).toEqual([]);
  });

  it('saves and retrieves an exercise log', async () => {
    await saveGuestExerciseLog(MOCK_EXERCISE);
    const logs = await getGuestExerciseLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].exercise_name).toBe('Running');
    expect(logs[0].calories_burned).toBe(300);
  });

  it('prepends new exercise logs to the front', async () => {
    const ex2 = { ...MOCK_EXERCISE, id: 'ex-2', exercise_name: 'Cycling' };
    await saveGuestExerciseLog(MOCK_EXERCISE);
    await saveGuestExerciseLog(ex2);
    const logs = await getGuestExerciseLogs();
    expect(logs[0].id).toBe('ex-2');
  });

  it('updates an existing exercise log', async () => {
    await saveGuestExerciseLog(MOCK_EXERCISE);
    await updateGuestExerciseLog('ex-1', { calories_burned: 400 });
    const logs = await getGuestExerciseLogs();
    expect(logs[0].calories_burned).toBe(400);
    expect(logs[0].duration_minutes).toBe(30); // unchanged
  });

  it('deletes an exercise log by id', async () => {
    await saveGuestExerciseLog(MOCK_EXERCISE);
    await deleteGuestExerciseLog('ex-1');
    const logs = await getGuestExerciseLogs();
    expect(logs).toHaveLength(0);
  });
});

describe('Guest scan count', () => {
  it('returns 0 when no scans have been done', async () => {
    expect(await getGuestScanCount()).toBe(0);
  });

  it('increments the scan count', async () => {
    const count = await incrementGuestScanCount();
    expect(count).toBe(1);
  });

  it('increments multiple times correctly', async () => {
    await incrementGuestScanCount();
    await incrementGuestScanCount();
    const count = await incrementGuestScanCount();
    expect(count).toBe(3);
    expect(await getGuestScanCount()).toBe(3);
  });
});

describe('Guest profile', () => {
  it('returns null when no profile exists', async () => {
    expect(await getGuestProfile()).toBeNull();
  });

  it('saves and retrieves a guest profile', async () => {
    await saveGuestProfile({ name: 'Alice', daily_calorie_target: 1600 });
    const profile = await getGuestProfile();
    expect(profile?.name).toBe('Alice');
    expect(profile?.daily_calorie_target).toBe(1600);
  });

  it('overwrites an existing guest profile', async () => {
    await saveGuestProfile({ name: 'Alice' });
    await saveGuestProfile({ name: 'Bob', daily_calorie_target: 2000 });
    const profile = await getGuestProfile();
    expect(profile?.name).toBe('Bob');
  });
});

describe('clearGuestData', () => {
  it('clears all guest data', async () => {
    await saveGuestLog(MOCK_LOG);
    await saveGuestExerciseLog(MOCK_EXERCISE);
    await incrementGuestScanCount();
    await saveGuestProfile({ name: 'Alice' });

    await clearGuestData();

    expect(await getGuestLogs()).toEqual([]);
    expect(await getGuestExerciseLogs()).toEqual([]);
    expect(await getGuestScanCount()).toBe(0);
    expect(await getGuestProfile()).toBeNull();
  });
});

describe('Water intake tracking', () => {
  const TODAY = '2026-04-25';
  const YESTERDAY = '2026-04-24';

  it('returns 0 when no water has been logged for a date', async () => {
    expect(await getWaterCups(TODAY)).toBe(0);
  });

  it('stores and retrieves water cups for a date', async () => {
    await setWaterCups(TODAY, 5);
    expect(await getWaterCups(TODAY)).toBe(5);
  });

  it('overwrites previous value for the same date', async () => {
    await setWaterCups(TODAY, 3);
    await setWaterCups(TODAY, 7);
    expect(await getWaterCups(TODAY)).toBe(7);
  });

  it('clamps negative values to 0', async () => {
    await setWaterCups(TODAY, -3);
    expect(await getWaterCups(TODAY)).toBe(0);
  });

  it('allows setting cups to 0', async () => {
    await setWaterCups(TODAY, 5);
    await setWaterCups(TODAY, 0);
    expect(await getWaterCups(TODAY)).toBe(0);
  });

  it('different dates are stored independently', async () => {
    await setWaterCups(TODAY, 8);
    await setWaterCups(YESTERDAY, 3);
    expect(await getWaterCups(TODAY)).toBe(8);
    expect(await getWaterCups(YESTERDAY)).toBe(3);
  });

  it('setting cups for one date does not affect another', async () => {
    await setWaterCups(TODAY, 6);
    expect(await getWaterCups(YESTERDAY)).toBe(0);
  });

  it('stores the exact integer value provided', async () => {
    await setWaterCups(TODAY, 12);
    expect(await getWaterCups(TODAY)).toBe(12);
  });
});

describe('Water goal (global setting)', () => {
  it('returns 8 as the default water goal when not set', async () => {
    expect(await getWaterGoal()).toBe(8);
  });

  it('saves and retrieves a custom water goal', async () => {
    await saveWaterGoal(10);
    expect(await getWaterGoal()).toBe(10);
  });

  it('overwrites a previously saved goal', async () => {
    await saveWaterGoal(6);
    await saveWaterGoal(12);
    expect(await getWaterGoal()).toBe(12);
  });

  it('clamps values below 1 up to 1', async () => {
    await saveWaterGoal(0);
    expect(await getWaterGoal()).toBe(1);
  });

  it('clamps values above 20 down to 20', async () => {
    await saveWaterGoal(25);
    expect(await getWaterGoal()).toBe(20);
  });

  it('accepts the boundary values 1 and 20', async () => {
    await saveWaterGoal(1);
    expect(await getWaterGoal()).toBe(1);
    await saveWaterGoal(20);
    expect(await getWaterGoal()).toBe(20);
  });

  it('is independent of the daily cup count', async () => {
    await saveWaterGoal(10);
    await setWaterCups('2026-04-25', 5);
    expect(await getWaterGoal()).toBe(10);
    expect(await getWaterCups('2026-04-25')).toBe(5);
  });
});

describe('Mood tracking', () => {
  const TODAY = '2026-04-25';
  const YESTERDAY = '2026-04-24';

  it('returns null when no mood has been logged for a date', async () => {
    expect(await getMood(TODAY)).toBeNull();
  });

  it('stores and retrieves a mood for a date', async () => {
    await setMood(TODAY, 'great');
    expect(await getMood(TODAY)).toBe('great');
  });

  it('overwrites previous mood for the same date', async () => {
    await setMood(TODAY, 'great');
    await setMood(TODAY, 'tired');
    expect(await getMood(TODAY)).toBe('tired');
  });

  it('stores each valid mood value correctly', async () => {
    const moods: Mood[] = ['great', 'good', 'okay', 'low', 'stressed', 'tired'];
    for (const mood of moods) {
      await setMood(TODAY, mood);
      expect(await getMood(TODAY)).toBe(mood);
    }
  });

  it('different dates are stored independently', async () => {
    await setMood(TODAY, 'great');
    await setMood(YESTERDAY, 'tired');
    expect(await getMood(TODAY)).toBe('great');
    expect(await getMood(YESTERDAY)).toBe('tired');
  });

  it('setting mood for one date does not affect another', async () => {
    await setMood(TODAY, 'good');
    expect(await getMood(YESTERDAY)).toBeNull();
  });
});

describe('Daily journal notes', () => {
  const TODAY = '2026-04-25';

  it('returns null when no note has been written for a date', async () => {
    expect(await getDailyNote(TODAY)).toBeNull();
  });

  it('saves and retrieves a note for a date', async () => {
    await setDailyNote(TODAY, 'Had a great salad for lunch!');
    expect(await getDailyNote(TODAY)).toBe('Had a great salad for lunch!');
  });

  it('overwrites a previous note for the same date', async () => {
    await setDailyNote(TODAY, 'First note');
    await setDailyNote(TODAY, 'Updated note');
    expect(await getDailyNote(TODAY)).toBe('Updated note');
  });

  it('saving a blank note removes it (returns null)', async () => {
    await setDailyNote(TODAY, 'Some content');
    await setDailyNote(TODAY, '');
    expect(await getDailyNote(TODAY)).toBeNull();
  });

  it('saving a whitespace-only note removes it', async () => {
    await setDailyNote(TODAY, 'Some content');
    await setDailyNote(TODAY, '   ');
    expect(await getDailyNote(TODAY)).toBeNull();
  });

  it('different dates store notes independently', async () => {
    await setDailyNote('2026-04-25', 'Note A');
    await setDailyNote('2026-04-24', 'Note B');
    expect(await getDailyNote('2026-04-25')).toBe('Note A');
    expect(await getDailyNote('2026-04-24')).toBe('Note B');
  });

  it('setting a note for one date does not affect another date', async () => {
    await setDailyNote('2026-04-25', 'Note A');
    expect(await getDailyNote('2026-04-24')).toBeNull();
  });
});

describe('Favorites — meals', () => {
  it('returns empty array when no meals are favourited', async () => {
    expect(await getFavoriteMealNames()).toEqual([]);
  });

  it('adds a meal name when toggled on', async () => {
    const isNow = await toggleFavoriteMeal('Grilled Chicken Salad');
    expect(isNow).toBe(true);
    expect(await getFavoriteMealNames()).toContain('Grilled Chicken Salad');
  });

  it('removes a meal name when toggled off', async () => {
    await toggleFavoriteMeal('Oatmeal');
    const isNow = await toggleFavoriteMeal('Oatmeal');
    expect(isNow).toBe(false);
    expect(await getFavoriteMealNames()).not.toContain('Oatmeal');
  });

  it('multiple meals can be favourited independently', async () => {
    await toggleFavoriteMeal('Salad');
    await toggleFavoriteMeal('Pasta');
    const names = await getFavoriteMealNames();
    expect(names).toContain('Salad');
    expect(names).toContain('Pasta');
  });

  it('toggling one meal does not affect another', async () => {
    await toggleFavoriteMeal('Salad');
    await toggleFavoriteMeal('Pasta');
    await toggleFavoriteMeal('Salad'); // unfavorite
    expect(await getFavoriteMealNames()).toContain('Pasta');
    expect(await getFavoriteMealNames()).not.toContain('Salad');
  });
});

describe('Favorites — exercises', () => {
  it('returns empty array when no exercises are favourited', async () => {
    expect(await getFavoriteExerciseNames()).toEqual([]);
  });

  it('adds an exercise name when toggled on', async () => {
    const isNow = await toggleFavoriteExercise('Running');
    expect(isNow).toBe(true);
    expect(await getFavoriteExerciseNames()).toContain('Running');
  });

  it('removes an exercise name when toggled off', async () => {
    await toggleFavoriteExercise('Yoga');
    const isNow = await toggleFavoriteExercise('Yoga');
    expect(isNow).toBe(false);
    expect(await getFavoriteExerciseNames()).not.toContain('Yoga');
  });

  it('meal and exercise favorites are stored independently', async () => {
    await toggleFavoriteMeal('Salad');
    await toggleFavoriteExercise('Running');
    expect(await getFavoriteMealNames()).toEqual(['Salad']);
    expect(await getFavoriteExerciseNames()).toEqual(['Running']);
  });
});

describe('Day template', () => {
  const TEMPLATE: DayTemplate = {
    savedAt: '2026-04-25T10:00:00.000Z',
    sourceDate: '2026-04-25',
    foods: [
      {
        meal_name: 'Oatmeal',
        foods_detected: ['oats'],
        calories: 350,
        protein_g: 10,
        carbs_g: 60,
        fat_g: 5,
        fiber_g: 6,
        sugar_g: 12,
        sodium_mg: 80,
        cholesterol_mg: 0,
        saturated_fat_g: 1,
      },
    ],
    exercises: [
      {
        exercise_name: 'Running',
        exercise_emoji: '🏃',
        duration_minutes: 30,
        calories_burned: 300,
        felt: 'good',
      },
    ],
  };

  it('returns null when no template has been saved', async () => {
    expect(await getDayTemplate()).toBeNull();
  });

  it('saves and retrieves a template', async () => {
    await saveDayTemplate(TEMPLATE);
    const result = await getDayTemplate();
    expect(result?.sourceDate).toBe('2026-04-25');
    expect(result?.foods).toHaveLength(1);
    expect(result?.exercises).toHaveLength(1);
  });

  it('overwrites a previous template', async () => {
    await saveDayTemplate(TEMPLATE);
    const updated: DayTemplate = { ...TEMPLATE, sourceDate: '2026-04-26', foods: [], exercises: [] };
    await saveDayTemplate(updated);
    expect((await getDayTemplate())?.sourceDate).toBe('2026-04-26');
  });

  it('persists food macro data correctly', async () => {
    await saveDayTemplate(TEMPLATE);
    const food = (await getDayTemplate())?.foods[0];
    expect(food?.meal_name).toBe('Oatmeal');
    expect(food?.calories).toBe(350);
    expect(food?.protein_g).toBe(10);
  });

  it('persists exercise felt rating', async () => {
    await saveDayTemplate(TEMPLATE);
    expect((await getDayTemplate())?.exercises[0].felt).toBe('good');
  });

  it('clearDayTemplate removes the saved template', async () => {
    await saveDayTemplate(TEMPLATE);
    await clearDayTemplate();
    expect(await getDayTemplate()).toBeNull();
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('starts with "guest_"', () => {
    expect(generateId()).toMatch(/^guest_/);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
