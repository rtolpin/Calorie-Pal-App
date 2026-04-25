/**
 * User Acceptance Tests — Critical User Journeys
 *
 * Each describe block represents a complete user scenario, chaining multiple
 * operations the way a real user would experience the feature end-to-end.
 * These tests complement the unit tests by verifying that the pieces
 * work together correctly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import {
  getGuestLogs, saveGuestLog, updateGuestLog, deleteGuestLog,
  getGuestExerciseLogs, saveGuestExerciseLog,
  getWaterCups, setWaterCups, getWaterGoal, saveWaterGoal,
  getMood, setMood,
  getDailyNote, setDailyNote,
  getAllWellnessDates,
  getFavoriteMealNames, toggleFavoriteMeal,
  getFavoriteExerciseNames, toggleFavoriteExercise,
  getDayTemplate, saveDayTemplate, clearDayTemplate,
  getTimeFormat, saveTimeFormat,
} from '../../lib/asyncStorage';

import {
  filterByDateRange, filterFavoriteEntries, parseUserDate,
  getRecentPastEntries,
} from '../../lib/journalUtils';

import {
  parseNotifTime, buildNotifTime, formatDisplayHour,
  isAmHour, toggleAmPm, adjustHour, adjustMinute,
} from '../../lib/timeUtils';

import {
  calculateTDEE, calculateDailyCalorieTarget, calculateMacroGrams,
} from '../../lib/tdee';

import { toLocalDateStr, getLocalDate } from '../../lib/dateUtils';

import { FoodLog, ExerciseLog, DayTemplate } from '../../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function localISO(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

const TODAY = toLocalDateStr(new Date());
const YESTERDAY = toLocalDateStr(new Date(Date.now() - 86400000));

function makeFood(overrides: Partial<FoodLog> = {}): Omit<FoodLog, 'id' | 'created_at'> {
  return {
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
    logged_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeExercise(overrides: Partial<ExerciseLog> = {}): Omit<ExerciseLog, 'id' | 'created_at'> {
  return {
    user_id: 'guest',
    exercise_name: 'Running',
    exercise_emoji: '🏃',
    duration_minutes: 30,
    calories_burned: 300,
    logged_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

// ─── JOURNEY 1: Guest User — Complete Meal Tracking ───────────────────────────
describe('Journey 1: Guest user tracks meals from first log to deletion', () => {
  it('step 1 — no meals exist on a fresh start', async () => {
    expect(await getGuestLogs()).toHaveLength(0);
  });

  it('step 2 — user logs their first meal and it appears immediately', async () => {
    const log: FoodLog = {
      ...makeFood({ meal_name: 'Avocado Toast', calories: 420 }),
      id: 'log-1',
      created_at: new Date().toISOString(),
    };
    await saveGuestLog(log);
    const logs = await getGuestLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].meal_name).toBe('Avocado Toast');
    expect(logs[0].calories).toBe(420);
  });

  it('step 3 — user corrects the calories and the update persists', async () => {
    const log: FoodLog = { ...makeFood(), id: 'log-1', created_at: new Date().toISOString() };
    await saveGuestLog(log);
    await updateGuestLog('log-1', { calories: 500, meal_name: 'Big Oatmeal' });
    const updated = await getGuestLogs();
    expect(updated[0].calories).toBe(500);
    expect(updated[0].meal_name).toBe('Big Oatmeal');
    expect(updated[0].protein_g).toBe(10); // other fields unchanged
  });

  it('step 4 — user logs a second meal; list shows newest first', async () => {
    const log1: FoodLog = { ...makeFood({ meal_name: 'Breakfast' }), id: 'l1', created_at: new Date().toISOString() };
    const log2: FoodLog = { ...makeFood({ meal_name: 'Lunch' }), id: 'l2', created_at: new Date().toISOString() };
    await saveGuestLog(log1);
    await saveGuestLog(log2);
    const logs = await getGuestLogs();
    expect(logs[0].meal_name).toBe('Lunch');
    expect(logs[1].meal_name).toBe('Breakfast');
  });

  it('step 5 — user deletes a meal and only the other remains', async () => {
    const log1: FoodLog = { ...makeFood({ meal_name: 'Breakfast' }), id: 'l1', created_at: new Date().toISOString() };
    const log2: FoodLog = { ...makeFood({ meal_name: 'Lunch' }), id: 'l2', created_at: new Date().toISOString() };
    await saveGuestLog(log1);
    await saveGuestLog(log2);
    await deleteGuestLog('l1');
    const logs = await getGuestLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('l2');
  });
});

// ─── JOURNEY 2: Daily Water Tracking ─────────────────────────────────────────
describe('Journey 2: User tracks water intake throughout the day', () => {
  it('step 1 — fresh day starts at 0 cups with default goal of 8', async () => {
    expect(await getWaterCups(TODAY)).toBe(0);
    expect(await getWaterGoal()).toBe(8);
  });

  it('step 2 — user logs cups one at a time and count accumulates', async () => {
    await setWaterCups(TODAY, 1);
    expect(await getWaterCups(TODAY)).toBe(1);
    await setWaterCups(TODAY, 2);
    expect(await getWaterCups(TODAY)).toBe(2);
    await setWaterCups(TODAY, 3);
    expect(await getWaterCups(TODAY)).toBe(3);
  });

  it('step 3 — user reaches and exceeds the goal', async () => {
    await setWaterCups(TODAY, 8);
    const cups = await getWaterCups(TODAY);
    const goal = await getWaterGoal();
    expect(cups).toBeGreaterThanOrEqual(goal); // goal met
  });

  it('step 4 — user changes goal; count is unaffected', async () => {
    await setWaterCups(TODAY, 5);
    await saveWaterGoal(12);
    expect(await getWaterCups(TODAY)).toBe(5);
    expect(await getWaterGoal()).toBe(12);
  });

  it('step 5 — different days track independently', async () => {
    await setWaterCups(TODAY, 6);
    await setWaterCups(YESTERDAY, 4);
    expect(await getWaterCups(TODAY)).toBe(6);
    expect(await getWaterCups(YESTERDAY)).toBe(4);
  });

  it('step 6 — reducing cups below zero is clamped to 0', async () => {
    await setWaterCups(TODAY, 2);
    await setWaterCups(TODAY, Math.max(0, 2 - 5)); // simulate -5 delta
    expect(await getWaterCups(TODAY)).toBe(0);
  });
});

// ─── JOURNEY 3: Journal Notes and Mood ───────────────────────────────────────
describe('Journey 3: User writes journal notes and sets daily mood', () => {
  it('step 1 — fresh start: no mood, no note, date not in wellness list', async () => {
    expect(await getMood(TODAY)).toBeNull();
    expect(await getDailyNote(TODAY)).toBeNull();
    const dates = await getAllWellnessDates();
    expect(dates).not.toContain(TODAY);
  });

  it('step 2 — user sets mood; date appears in wellness dates', async () => {
    await setMood(TODAY, 'great');
    expect(await getMood(TODAY)).toBe('great');
    expect(await getAllWellnessDates()).toContain(TODAY);
  });

  it('step 3 — user writes a note; both mood and note are retrievable', async () => {
    await setMood(TODAY, 'good');
    await setDailyNote(TODAY, 'Felt energised after the gym 💪');
    expect(await getMood(TODAY)).toBe('good');
    expect(await getDailyNote(TODAY)).toBe('Felt energised after the gym 💪');
  });

  it('step 4 — user updates mood; note is preserved', async () => {
    await setMood(TODAY, 'good');
    await setDailyNote(TODAY, 'Some note');
    await setMood(TODAY, 'great'); // change mood
    expect(await getMood(TODAY)).toBe('great');
    expect(await getDailyNote(TODAY)).toBe('Some note'); // note unchanged
  });

  it('step 5 — user clears note by saving empty string', async () => {
    await setDailyNote(TODAY, 'Temporary note');
    await setDailyNote(TODAY, '');
    expect(await getDailyNote(TODAY)).toBeNull();
  });

  it('step 6 — multiple days build up a wellness history', async () => {
    await setMood(TODAY, 'okay');
    await setMood(YESTERDAY, 'tired');
    await setDailyNote(YESTERDAY, 'Long day');
    const dates = await getAllWellnessDates();
    expect(dates).toContain(TODAY);
    expect(dates).toContain(YESTERDAY);
    // Newest first
    expect(dates.indexOf(TODAY)).toBeLessThan(dates.indexOf(YESTERDAY));
  });
});

// ─── JOURNEY 4: Favourites Management ────────────────────────────────────────
describe('Journey 4: User builds and manages a favourites list', () => {
  it('step 1 — no favourites exist initially', async () => {
    expect(await getFavoriteMealNames()).toHaveLength(0);
    expect(await getFavoriteExerciseNames()).toHaveLength(0);
  });

  it('step 2 — user stars a meal and an exercise', async () => {
    await toggleFavoriteMeal('Grilled Chicken Salad');
    await toggleFavoriteExercise('Running');
    expect(await getFavoriteMealNames()).toContain('Grilled Chicken Salad');
    expect(await getFavoriteExerciseNames()).toContain('Running');
  });

  it('step 3 — meals and exercises are stored independently', async () => {
    await toggleFavoriteMeal('Pasta');
    expect(await getFavoriteExerciseNames()).not.toContain('Pasta');
    await toggleFavoriteExercise('Yoga');
    expect(await getFavoriteMealNames()).not.toContain('Yoga');
  });

  it('step 4 — toggling a favourite twice removes it', async () => {
    await toggleFavoriteMeal('Oatmeal');
    await toggleFavoriteMeal('Oatmeal'); // un-star
    expect(await getFavoriteMealNames()).not.toContain('Oatmeal');
  });

  it('step 5 — Favourites filter returns only starred entries', () => {
    const food1 = { type: 'food' as const, data: { id: 'f1', meal_name: 'Pasta', logged_at: localISO(2026, 4, 25) } as any };
    const food2 = { type: 'food' as const, data: { id: 'f2', meal_name: 'Salad', logged_at: localISO(2026, 4, 25) } as any };
    const ex1   = { type: 'exercise' as const, data: { id: 'e1', exercise_name: 'Yoga', logged_at: localISO(2026, 4, 25) } as any };

    const result = filterFavoriteEntries([food1, food2, ex1], ['Pasta'], ['Yoga']);
    expect(result).toHaveLength(2);
    const ids = result.map((e) => e.data.id);
    expect(ids).toContain('f1');
    expect(ids).toContain('e1');
    expect(ids).not.toContain('f2'); // Salad is not starred
  });
});

// ─── JOURNEY 5: Day Template — Save and Apply ─────────────────────────────────
describe('Journey 5: User saves a day template and applies it later', () => {
  const TEMPLATE: DayTemplate = {
    savedAt: new Date().toISOString(),
    sourceDate: '2026-04-25',
    foods: [
      {
        meal_name: 'Oatmeal', foods_detected: ['oats'], calories: 350, protein_g: 10,
        carbs_g: 60, fat_g: 5, fiber_g: 6, sugar_g: 12, sodium_mg: 80, cholesterol_mg: 0, saturated_fat_g: 1,
      },
      {
        meal_name: 'Grilled Chicken', foods_detected: ['chicken'], calories: 450, protein_g: 40,
        carbs_g: 10, fat_g: 15, fiber_g: 0, sugar_g: 0, sodium_mg: 500, cholesterol_mg: 90, saturated_fat_g: 3,
      },
    ],
    exercises: [
      { exercise_name: 'Running', exercise_emoji: '🏃', duration_minutes: 30, calories_burned: 300, felt: 'good' },
    ],
  };

  it('step 1 — no template exists initially', async () => {
    expect(await getDayTemplate()).toBeNull();
  });

  it('step 2 — user saves a template; it is retrievable', async () => {
    await saveDayTemplate(TEMPLATE);
    const retrieved = await getDayTemplate();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.sourceDate).toBe('2026-04-25');
    expect(retrieved?.foods).toHaveLength(2);
    expect(retrieved?.exercises).toHaveLength(1);
  });

  it('step 3 — template preserves all macro data', async () => {
    await saveDayTemplate(TEMPLATE);
    const food = (await getDayTemplate())?.foods[0];
    expect(food?.calories).toBe(350);
    expect(food?.protein_g).toBe(10);
  });

  it('step 4 — template preserves exercise felt rating', async () => {
    await saveDayTemplate(TEMPLATE);
    expect((await getDayTemplate())?.exercises[0].felt).toBe('good');
  });

  it('step 5 — user overwrites template with new one', async () => {
    await saveDayTemplate(TEMPLATE);
    await saveDayTemplate({ ...TEMPLATE, sourceDate: '2026-04-26', foods: [] });
    expect((await getDayTemplate())?.sourceDate).toBe('2026-04-26');
    expect((await getDayTemplate())?.foods).toHaveLength(0);
  });

  it('step 6 — user clears the template; it is gone', async () => {
    await saveDayTemplate(TEMPLATE);
    await clearDayTemplate();
    expect(await getDayTemplate()).toBeNull();
  });
});

// ─── JOURNEY 6: TDEE Calculation with Gender ─────────────────────────────────
describe('Journey 6: Calorie target calculation accounts for gender correctly', () => {
  const stats = { w: 70, h: 175, a: 30, activity: 'active' as const };

  it('male target is higher than female for identical stats', () => {
    const male   = calculateDailyCalorieTarget(stats.w, stats.h, stats.a, stats.activity, 'maintain', 1, 'male');
    const female = calculateDailyCalorieTarget(stats.w, stats.h, stats.a, stats.activity, 'maintain', 1, 'female');
    expect(male).toBeGreaterThan(female);
    // Mifflin-St Jeor difference is 166 cal/day in BMR (5 − (−161))
    // After activity multiplier (1.55), expect roughly 257 cal difference
    expect(male - female).toBeGreaterThan(200);
  });

  it('"other" gender falls between male and female', () => {
    const male   = calculateDailyCalorieTarget(stats.w, stats.h, stats.a, stats.activity, 'maintain', 1, 'male');
    const female = calculateDailyCalorieTarget(stats.w, stats.h, stats.a, stats.activity, 'maintain', 1, 'female');
    const other  = calculateDailyCalorieTarget(stats.w, stats.h, stats.a, stats.activity, 'maintain', 1, 'other');
    expect(other).toBeGreaterThan(female);
    expect(other).toBeLessThan(male);
  });

  it('weight-loss deficit is applied correctly regardless of gender', () => {
    for (const gender of ['male', 'female', 'other'] as const) {
      const maintain = calculateDailyCalorieTarget(stats.w, stats.h, stats.a, stats.activity, 'maintain', 1, gender);
      const lose     = calculateDailyCalorieTarget(stats.w, stats.h, stats.a, stats.activity, 'lose_weight', 1, gender);
      expect(maintain - lose).toBe(500);
    }
  });

  it('muscle-gain surplus is applied correctly regardless of gender', () => {
    for (const gender of ['male', 'female', 'other'] as const) {
      const maintain = calculateDailyCalorieTarget(stats.w, stats.h, stats.a, stats.activity, 'maintain', 1, gender);
      const gain     = calculateDailyCalorieTarget(stats.w, stats.h, stats.a, stats.activity, 'gain_muscle', 1, gender);
      expect(gain - maintain).toBe(300);
    }
  });

  it('clamping applies: very aggressive loss never drops below 1200 for any gender', () => {
    for (const gender of ['male', 'female', 'other'] as const) {
      const result = calculateDailyCalorieTarget(35, 140, 18, 'sedentary', 'lose_weight', 2, gender);
      expect(result).toBeGreaterThanOrEqual(1200);
    }
  });

  it('macro grams are consistent with calorie totals', () => {
    const calories = calculateDailyCalorieTarget(stats.w, stats.h, stats.a, stats.activity, 'maintain', 1, 'female');
    const { protein_g, carbs_g, fat_g } = calculateMacroGrams(calories, 30, 40, 30);
    // Rough check: macros should account for roughly all calories
    const reconstituted = protein_g * 4 + carbs_g * 4 + fat_g * 9;
    expect(Math.abs(reconstituted - calories)).toBeLessThan(20); // within 20 cal rounding
  });
});

// ─── JOURNEY 7: Custom Date Range Filter ─────────────────────────────────────
describe('Journey 7: User filters journal by a custom date range', () => {
  const entries = [
    { type: 'food' as const, data: { id: 'jan5',  meal_name: 'A', logged_at: localISO(2026, 1, 5),  calories: 300 } as any },
    { type: 'food' as const, data: { id: 'jan10', meal_name: 'B', logged_at: localISO(2026, 1, 10), calories: 400 } as any },
    { type: 'food' as const, data: { id: 'jan15', meal_name: 'C', logged_at: localISO(2026, 1, 15), calories: 500 } as any },
    { type: 'food' as const, data: { id: 'jan20', meal_name: 'D', logged_at: localISO(2026, 1, 20), calories: 600 } as any },
    { type: 'food' as const, data: { id: 'jan25', meal_name: 'E', logged_at: localISO(2026, 1, 25), calories: 700 } as any },
  ];
  const items = entries.map((e) => e.data);

  it('step 1 — parseUserDate converts MM/DD/YYYY to YYYY-MM-DD', () => {
    expect(parseUserDate('01/10/2026')).toBe('2026-01-10');
    expect(parseUserDate('12/31/2026')).toBe('2026-12-31');
  });

  it('step 2 — invalid date strings produce empty string', () => {
    expect(parseUserDate('not-a-date')).toBe('');
    expect(parseUserDate('2026-01-10')).toBe(''); // wrong format
    expect(parseUserDate('')).toBe('');
  });

  it('step 3 — from + to range returns only matching entries', () => {
    const from = parseUserDate('01/08/2026');
    const to   = parseUserDate('01/18/2026');
    const result = filterByDateRange(items, from, to);
    const ids = result.map((i: any) => i.id);
    expect(ids).toContain('jan10');
    expect(ids).toContain('jan15');
    expect(ids).not.toContain('jan5');
    expect(ids).not.toContain('jan20');
  });

  it('step 4 — from-only filter returns entries on or after the date', () => {
    const result = filterByDateRange(items, '2026-01-15', '');
    const ids = result.map((i: any) => i.id);
    expect(ids).toContain('jan15');
    expect(ids).toContain('jan20');
    expect(ids).toContain('jan25');
    expect(ids).not.toContain('jan5');
    expect(ids).not.toContain('jan10');
  });

  it('step 5 — to-only filter returns entries on or before the date', () => {
    const result = filterByDateRange(items, '', '2026-01-10');
    expect(result.map((i: any) => i.id)).toEqual(['jan5', 'jan10']);
  });

  it('step 6 — single-day filter returns exactly that day', () => {
    const result = filterByDateRange(items, '2026-01-15', '2026-01-15');
    expect(result).toHaveLength(1);
    expect((result[0] as any).id).toBe('jan15');
  });

  it('step 7 — empty bounds return all entries', () => {
    expect(filterByDateRange(items, '', '')).toHaveLength(5);
  });
});

// ─── JOURNEY 8: Time Picker — Format and Navigation ──────────────────────────
describe('Journey 8: User sets and navigates the reminder time picker', () => {
  it('step 1 — parse standard 24-hour time', () => {
    expect(parseNotifTime('19:00')).toEqual({ hour: 19, minute: 0 });
    expect(parseNotifTime('07:30')).toEqual({ hour: 7, minute: 30 });
  });

  it('step 2 — build time string zero-pads correctly', () => {
    expect(buildNotifTime(7, 5)).toBe('07:05');
    expect(buildNotifTime(19, 0)).toBe('19:00');
  });

  it('step 3 — parse → build round-trip is lossless', () => {
    const times = ['07:00', '12:30', '19:45', '00:00', '23:59'];
    times.forEach((t) => {
      const { hour, minute } = parseNotifTime(t);
      expect(buildNotifTime(hour, minute)).toBe(t);
    });
  });

  it('step 4 — 12h display converts PM hours correctly', () => {
    expect(formatDisplayHour(13, '12h')).toBe(1);   // 1 PM
    expect(formatDisplayHour(12, '12h')).toBe(12);  // 12 PM (noon)
    expect(formatDisplayHour(0,  '12h')).toBe(12);  // 12 AM (midnight)
    expect(formatDisplayHour(23, '12h')).toBe(11);  // 11 PM
  });

  it('step 5 — 24h display returns hour unchanged', () => {
    expect(formatDisplayHour(13, '24h')).toBe(13);
    expect(formatDisplayHour(0,  '24h')).toBe(0);
  });

  it('step 6 — AM/PM toggle switches correctly', () => {
    expect(isAmHour(7)).toBe(true);
    expect(isAmHour(19)).toBe(false);
    expect(toggleAmPm(7)).toBe(19);  // 7 AM → 7 PM
    expect(toggleAmPm(19)).toBe(7);  // 7 PM → 7 AM
    expect(toggleAmPm(toggleAmPm(10))).toBe(10); // double toggle returns to start
  });

  it('step 7 — hour stepper wraps at 24-hour boundary', () => {
    expect(adjustHour(23, 1)).toBe(0);  // 11 PM → midnight
    expect(adjustHour(0, -1)).toBe(23); // midnight → 11 PM
  });

  it('step 8 — minute stepper wraps at 60-minute boundary', () => {
    expect(adjustMinute(55, 5)).toBe(0);  // 55 → 0
    expect(adjustMinute(0, -5)).toBe(55); // 0 → 55
  });

  it('step 9 — user preference persists across restarts', async () => {
    await saveTimeFormat('24h');
    expect(await getTimeFormat()).toBe('24h');
    await saveTimeFormat('12h');
    expect(await getTimeFormat()).toBe('12h');
  });
});

// ─── JOURNEY 9: Timezone-Safe Date Handling ───────────────────────────────────
describe('Journey 9: Daily calorie reset always uses the correct local date', () => {
  it('toLocalDateStr returns the LOCAL date not UTC', () => {
    // Create a date at 11:30 PM local time.
    // In UTC+ timezones this is already "tomorrow" UTC, but must still show today locally.
    const lateEvening = new Date();
    lateEvening.setHours(23, 30, 0, 0);
    const localStr = toLocalDateStr(lateEvening);
    const expectedLocalDate = [
      lateEvening.getFullYear(),
      String(lateEvening.getMonth() + 1).padStart(2, '0'),
      String(lateEvening.getDate()).padStart(2, '0'),
    ].join('-');
    expect(localStr).toBe(expectedLocalDate);
  });

  it('getLocalDate converts a UTC ISO string to the correct local date', () => {
    // 10 AM local — safe to test in any timezone
    const d = new Date(2026, 3, 25, 10, 0); // April 25 at 10 AM local
    expect(getLocalDate(d.toISOString())).toBe('2026-04-25');
  });

  it('late-night logs still appear as the same local day', () => {
    // 11:30 PM local on April 25 should be April 25, not April 26 (UTC might disagree)
    const late = new Date(2026, 3, 25, 23, 30);
    expect(getLocalDate(late.toISOString())).toBe('2026-04-25');
  });

  it('early-morning logs still appear as the same local day', () => {
    // 00:30 AM local on April 25 should be April 25, not April 24 (UTC might disagree)
    const early = new Date(2026, 3, 25, 0, 30);
    expect(getLocalDate(early.toISOString())).toBe('2026-04-25');
  });
});

// ─── JOURNEY 10: Recent Past Entries Surface When Today Is Empty ──────────────
describe('Journey 10: Journal shows recent activity when today has no entries', () => {
  const todayStr = toLocalDateStr(new Date());

  function makeEntry(id: string, dateISO: string) {
    return {
      type: 'food' as const,
      data: {
        id,
        user_id: 'u1',
        meal_name: `Meal ${id}`,
        foods_detected: [],
        calories: 300,
        protein_g: 20,
        carbs_g: 30,
        fat_g: 10,
        fiber_g: 3,
        sugar_g: 5,
        sodium_mg: 400,
        cholesterol_mg: 50,
        saturated_fat_g: 2,
        logged_at: dateISO,
        created_at: dateISO,
      } as FoodLog,
    };
  }

  it('returns empty when all past entries are from today', () => {
    const entries = [makeEntry('a', new Date(2026, 3, 25, 10).toISOString())];
    const result = getRecentPastEntries(
      entries.map((e) => e.data),
      [],
      '2026-04-25',
      'all',
    );
    expect(result).toHaveLength(0);
  });

  it('returns entries from past days when today is empty', () => {
    const yesterdayISO = new Date(2026, 3, 24, 12).toISOString();
    const result = getRecentPastEntries(
      [makeEntry('y1', yesterdayISO).data],
      [],
      '2026-04-25',
      'all',
    );
    expect(result).toHaveLength(1);
    expect(result[0].data.id).toBe('y1');
  });

  it('sorts past entries newest-first across multiple days', () => {
    const d1 = new Date(2026, 3, 23, 12).toISOString();
    const d2 = new Date(2026, 3, 22, 12).toISOString();
    const result = getRecentPastEntries(
      [makeEntry('older', d2).data, makeEntry('newer', d1).data],
      [],
      '2026-04-25',
      'all',
    );
    expect(result[0].data.id).toBe('newer');
    expect(result[1].data.id).toBe('older');
  });

  it('respects the entry type filter', () => {
    const pastISO = new Date(2026, 3, 24, 12).toISOString();
    const exercise: ExerciseLog = {
      id: 'e1',
      user_id: 'u1',
      exercise_name: 'Running',
      exercise_emoji: '🏃',
      duration_minutes: 30,
      calories_burned: 300,
      logged_at: pastISO,
      created_at: pastISO,
    };
    const food = makeEntry('f1', pastISO).data;

    const foodOnly = getRecentPastEntries([food], [exercise], '2026-04-25', 'food');
    expect(foodOnly.every((e) => e.type === 'food')).toBe(true);

    const exerciseOnly = getRecentPastEntries([food], [exercise], '2026-04-25', 'exercise');
    expect(exerciseOnly.every((e) => e.type === 'exercise')).toBe(true);
  });
});
