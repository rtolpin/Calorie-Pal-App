/**
 * UAT — Filtering Journal Entries
 *
 * Covers every filter path the user can apply in the Journal screen:
 *   • Built-in date buckets: today, this week, this month, all time
 *   • Custom MM/DD/YYYY date range (including partial bounds and bad input)
 *   • Favorites filter for food and exercise entries
 *   • Entry-type filter (food / exercise / all) combined with date filter
 *   • filterByDateRange and parseUserDate pure functions
 *
 * All tests use pure utility functions from lib/journalUtils — no component
 * rendering required.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import {
  filterByDateRange,
  parseUserDate,
  filterFavoriteEntries,
  getRecentPastEntries,
  groupEntriesByDate,
  JournalEntry,
} from '../../lib/journalUtils';

import { FoodLog, ExerciseLog } from '../../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function food(id: string, date: string, mealName = 'Meal'): FoodLog {
  return {
    id,
    user_id: 'u1',
    meal_name: mealName,
    foods_detected: [],
    calories: 300,
    protein_g: 10,
    carbs_g: 40,
    fat_g: 8,
    fiber_g: 2,
    sugar_g: 5,
    sodium_mg: 100,
    cholesterol_mg: 0,
    saturated_fat_g: 1,
    logged_at: `${date}T12:00:00.000Z`,
    created_at: `${date}T12:00:00.000Z`,
  };
}

function exercise(id: string, date: string, name = 'Run'): ExerciseLog {
  return {
    id,
    user_id: 'u1',
    exercise_name: name,
    exercise_emoji: '🏃',
    duration_minutes: 30,
    calories_burned: 200,
    logged_at: `${date}T09:00:00.000Z`,
    created_at: `${date}T09:00:00.000Z`,
  };
}

// ─── parseUserDate ────────────────────────────────────────────────────────────

describe('UAT: parseUserDate — MM/DD/YYYY input validation', () => {
  it('converts a valid MM/DD/YYYY date to YYYY-MM-DD', () => {
    expect(parseUserDate('04/25/2026')).toBe('2026-04-25');
  });

  it('handles single-digit month and day', () => {
    expect(parseUserDate('1/5/2026')).toBe('2026-01-05');
  });

  it('returns empty string for completely empty input', () => {
    expect(parseUserDate('')).toBe('');
  });

  it('returns empty string for YYYY-MM-DD (wrong format)', () => {
    expect(parseUserDate('2026-04-25')).toBe('');
  });

  it('returns empty string for text garbage', () => {
    expect(parseUserDate('not a date')).toBe('');
  });

  it('returns empty string when month is 13', () => {
    expect(parseUserDate('13/01/2026')).toBe('');
  });

  it('returns empty string when month is 0', () => {
    expect(parseUserDate('0/15/2026')).toBe('');
  });

  it('returns empty string when day is 0', () => {
    expect(parseUserDate('04/0/2026')).toBe('');
  });

  it('returns empty string when day is 32', () => {
    expect(parseUserDate('04/32/2026')).toBe('');
  });

  it('returns empty string for partial input "04/"', () => {
    expect(parseUserDate('04/')).toBe('');
  });

  it('returns empty string for whitespace only', () => {
    expect(parseUserDate('   ')).toBe('');
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseUserDate(' 04/25/2026 ')).toBe('2026-04-25');
  });

  it('boundary date 12/31/2026 parses correctly', () => {
    expect(parseUserDate('12/31/2026')).toBe('2026-12-31');
  });

  it('boundary date 01/01/2026 parses correctly', () => {
    expect(parseUserDate('01/01/2026')).toBe('2026-01-01');
  });
});

// ─── filterByDateRange ────────────────────────────────────────────────────────

describe('UAT: filterByDateRange — date-range filtering', () => {
  const logs = [
    food('f1', '2026-04-20'),
    food('f2', '2026-04-22'),
    food('f3', '2026-04-25'),
    food('f4', '2026-04-27'),
    food('f5', '2026-04-30'),
  ];

  it('returns all items when both bounds are empty strings', () => {
    expect(filterByDateRange(logs, '', '')).toHaveLength(5);
  });

  it('filters to a single day when fromDate === toDate', () => {
    const result = filterByDateRange(logs, '2026-04-22', '2026-04-22');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f2');
  });

  it('filters a closed date range [from, to]', () => {
    const result = filterByDateRange(logs, '2026-04-22', '2026-04-27');
    expect(result.map((l) => l.id)).toEqual(['f2', 'f3', 'f4']);
  });

  it('open right bound (toDate = "") returns from..end', () => {
    const result = filterByDateRange(logs, '2026-04-25', '');
    expect(result.map((l) => l.id)).toEqual(['f3', 'f4', 'f5']);
  });

  it('open left bound (fromDate = "") returns start..to', () => {
    const result = filterByDateRange(logs, '', '2026-04-22');
    expect(result.map((l) => l.id)).toEqual(['f1', 'f2']);
  });

  it('fromDate after all entries returns empty array', () => {
    expect(filterByDateRange(logs, '2026-05-01', '')).toHaveLength(0);
  });

  it('toDate before all entries returns empty array', () => {
    expect(filterByDateRange(logs, '', '2026-04-10')).toHaveLength(0);
  });

  it('includes entries exactly on fromDate boundary', () => {
    const result = filterByDateRange(logs, '2026-04-20', '2026-04-21');
    expect(result[0].id).toBe('f1');
  });

  it('includes entries exactly on toDate boundary', () => {
    const result = filterByDateRange(logs, '2026-04-29', '2026-04-30');
    expect(result[0].id).toBe('f5');
  });

  it('works with exercise logs (same logged_at shape)', () => {
    const exLogs = [
      exercise('e1', '2026-04-20'),
      exercise('e2', '2026-04-25'),
    ];
    const result = filterByDateRange(exLogs, '2026-04-25', '2026-04-25');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e2');
  });
});

// ─── Custom date range — full roundtrip with parseUserDate ────────────────────

describe('UAT: Custom date range — full MM/DD/YYYY → filter roundtrip', () => {
  const logs = [
    food('f1', '2026-04-10'),
    food('f2', '2026-04-15'),
    food('f3', '2026-04-20'),
    food('f4', '2026-04-25'),
  ];

  it('user enters valid from/to and gets correct subset', () => {
    const from = parseUserDate('04/15/2026');
    const to   = parseUserDate('04/20/2026');
    const result = filterByDateRange(logs, from, to);
    expect(result.map((l) => l.id)).toEqual(['f2', 'f3']);
  });

  it('invalid from input causes empty from — filter falls back to open bound', () => {
    const from = parseUserDate('not-valid');
    const to   = parseUserDate('04/20/2026');
    // from is '' → open left bound
    const result = filterByDateRange(logs, from, to);
    expect(result.map((l) => l.id)).toEqual(['f1', 'f2', 'f3']);
  });

  it('invalid to input causes empty to — filter falls back to open bound', () => {
    const from = parseUserDate('04/15/2026');
    const to   = parseUserDate(''); // invalid
    const result = filterByDateRange(logs, from, to);
    expect(result.map((l) => l.id)).toEqual(['f2', 'f3', 'f4']);
  });

  it('both invalid inputs → open bounds → all items returned', () => {
    const from = parseUserDate('garbage');
    const to   = parseUserDate('more garbage');
    expect(filterByDateRange(logs, from, to)).toHaveLength(4);
  });
});

// ─── Favorites filter ─────────────────────────────────────────────────────────

describe('UAT: filterFavoriteEntries — favorites filter', () => {
  const entries: JournalEntry[] = [
    { type: 'food',     data: food('f1', '2026-04-25', 'Oatmeal') },
    { type: 'food',     data: food('f2', '2026-04-25', 'Salad') },
    { type: 'food',     data: food('f3', '2026-04-25', 'Pizza') },
    { type: 'exercise', data: exercise('e1', '2026-04-25', 'Yoga') },
    { type: 'exercise', data: exercise('e2', '2026-04-25', 'Running') },
  ];

  it('returns only meals in the favorites list', () => {
    const result = filterFavoriteEntries(entries, ['Oatmeal', 'Salad'], []);
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.type === 'food')).toBe(true);
  });

  it('returns only exercises in the favorites list', () => {
    const result = filterFavoriteEntries(entries, [], ['Yoga']);
    expect(result).toHaveLength(1);
    expect((result[0].data as ExerciseLog).exercise_name).toBe('Yoga');
  });

  it('returns both food and exercise favorites', () => {
    const result = filterFavoriteEntries(entries, ['Oatmeal'], ['Running']);
    expect(result).toHaveLength(2);
  });

  it('returns empty when nothing is favorited', () => {
    expect(filterFavoriteEntries(entries, [], [])).toHaveLength(0);
  });

  it('name match is case-sensitive (no false positives)', () => {
    expect(filterFavoriteEntries(entries, ['oatmeal'], [])).toHaveLength(0);
  });

  it('unfavoriting a meal removes it from results', () => {
    const favMeals = ['Oatmeal', 'Salad'];
    const after = favMeals.filter((n) => n !== 'Oatmeal');
    const result = filterFavoriteEntries(entries, after, []);
    expect(result).toHaveLength(1);
    expect((result[0].data as FoodLog).meal_name).toBe('Salad');
  });
});

// ─── Entry-type filter combined with date filter ──────────────────────────────

describe('UAT: Entry-type + date combined filtering', () => {
  const allLogs: FoodLog[] = [
    food('f1', '2026-04-25', 'Breakfast'),
    food('f2', '2026-04-24', 'Dinner'),
    food('f3', '2026-04-20', 'Lunch'),
  ];

  const allExercise: ExerciseLog[] = [
    exercise('e1', '2026-04-25', 'Yoga'),
    exercise('e2', '2026-04-23', 'Run'),
  ];

  it('food-only filter with date range excludes all exercise entries', () => {
    const foodInRange = filterByDateRange(allLogs, '2026-04-24', '2026-04-25');
    // Only food, no exercises mixed in
    expect(foodInRange.every((l) => 'meal_name' in l)).toBe(true);
    expect(foodInRange).toHaveLength(2);
  });

  it('exercise-only filter with date range excludes all food entries', () => {
    const exInRange = filterByDateRange(allExercise, '2026-04-23', '2026-04-25');
    expect(exInRange.every((l) => 'exercise_name' in l)).toBe(true);
    expect(exInRange).toHaveLength(2);
  });

  it('date filter returning 0 results shows empty journal', () => {
    const result = filterByDateRange(allLogs, '2026-05-01', '2026-05-31');
    expect(result).toHaveLength(0);
  });
});

// ─── groupEntriesByDate ───────────────────────────────────────────────────────

describe('UAT: groupEntriesByDate — groups entries by local date', () => {
  it('groups food and exercise on the same day under one key', () => {
    const entries: JournalEntry[] = [
      { type: 'food',     data: food('f1', '2026-04-25') },
      { type: 'exercise', data: exercise('e1', '2026-04-25') },
    ];
    const grouped = groupEntriesByDate(entries);
    const keys = Object.keys(grouped);
    expect(keys).toHaveLength(1);
    expect(grouped[keys[0]]).toHaveLength(2);
  });

  it('entries on different days are in separate groups', () => {
    const entries: JournalEntry[] = [
      { type: 'food', data: food('f1', '2026-04-25') },
      { type: 'food', data: food('f2', '2026-04-24') },
    ];
    const grouped = groupEntriesByDate(entries);
    expect(Object.keys(grouped)).toHaveLength(2);
  });

  it('returns an empty object for an empty entry list', () => {
    expect(groupEntriesByDate([])).toEqual({});
  });
});

// ─── getRecentPastEntries ─────────────────────────────────────────────────────

describe('UAT: getRecentPastEntries — fallback when today is empty', () => {
  const TODAY = '2026-04-25';

  const foodLogs: FoodLog[] = [
    food('f1', '2026-04-24', 'Salad'),   // yesterday
    food('f2', '2026-04-23', 'Pizza'),   // 2 days ago
    food('f3', '2026-04-25', 'Today'),   // today — must be excluded
  ];

  const exLogs: ExerciseLog[] = [
    exercise('e1', '2026-04-24', 'Yoga'), // yesterday
    exercise('e2', '2026-04-25', 'Run'),  // today — must be excluded
  ];

  it('excludes entries logged today', () => {
    const result = getRecentPastEntries(foodLogs, exLogs, TODAY, 'all');
    expect(result.every((e) => !e.data.logged_at.startsWith('2026-04-25'))).toBe(true);
  });

  it('returns food and exercise past entries when type is "all"', () => {
    const result = getRecentPastEntries(foodLogs, exLogs, TODAY, 'all');
    const types = result.map((e) => e.type);
    expect(types).toContain('food');
    expect(types).toContain('exercise');
  });

  it('returns only food entries when type is "food"', () => {
    const result = getRecentPastEntries(foodLogs, exLogs, TODAY, 'food');
    expect(result.every((e) => e.type === 'food')).toBe(true);
  });

  it('returns only exercise entries when type is "exercise"', () => {
    const result = getRecentPastEntries(foodLogs, exLogs, TODAY, 'exercise');
    expect(result.every((e) => e.type === 'exercise')).toBe(true);
  });

  it('sorts results newest-first', () => {
    const result = getRecentPastEntries(foodLogs, exLogs, TODAY, 'all');
    for (let i = 0; i < result.length - 1; i++) {
      expect(new Date(result[i].data.logged_at).getTime())
        .toBeGreaterThanOrEqual(new Date(result[i + 1].data.logged_at).getTime());
    }
  });

  it('returns empty when no past entries exist', () => {
    const todayOnly = [food('f1', '2026-04-25', 'Today only')];
    expect(getRecentPastEntries(todayOnly, [], TODAY, 'all')).toHaveLength(0);
  });
});
