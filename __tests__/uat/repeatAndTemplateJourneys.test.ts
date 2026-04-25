/**
 * UAT — Repeat Yesterday, Save Template, Apply Template
 *
 * Covers the complete lifecycle of copying a day's entries:
 *   • Repeat Yesterday creates new entries for today with today's timestamp
 *   • All macro and exercise data is preserved verbatim
 *   • Entries created this way can subsequently be edited and saved normally
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { act } from '@testing-library/react-native';
import { useFoodLogStore }     from '../../store/foodLogStore';
import { useExerciseLogStore } from '../../store/exerciseLogStore';
import {
  saveDayTemplate, getDayTemplate, clearDayTemplate,
  saveGuestLog, getGuestLogs, updateGuestLog,
  saveGuestExerciseLog, getGuestExerciseLogs, updateGuestExerciseLog,
} from '../../lib/asyncStorage';
import { toLocalDateStr } from '../../lib/dateUtils';
import { FoodLog, ExerciseLog, DayTemplate } from '../../types';

// ─── shared mock infrastructure ───────────────────────────────────────────────

const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockSelect = jest.fn();
const mockDelete = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
  },
}));

function resetStores() {
  useFoodLogStore.setState({ logs: [], isLoading: false, capturedPhotoUri: null, capturedPhotoBase64: null });
  useExerciseLogStore.setState({ exerciseLogs: [], isLoading: false });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetStores();
  mockInsert.mockReset();
  mockUpdate.mockReset();
  mockSelect.mockReset();
  mockDelete.mockReset();
});

// ─── helpers ──────────────────────────────────────────────────────────────────

const TODAY     = toLocalDateStr(new Date());
const YESTERDAY = toLocalDateStr(new Date(Date.now() - 86400000));

function makeFood(overrides: Partial<FoodLog> = {}): FoodLog {
  return {
    id: 'f1',
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
    logged_at: `${YESTERDAY}T08:00:00.000Z`,
    created_at: `${YESTERDAY}T08:00:00.000Z`,
    ...overrides,
  };
}

function makeExercise(overrides: Partial<ExerciseLog> = {}): ExerciseLog {
  return {
    id: 'e1',
    user_id: 'guest',
    exercise_name: 'Running',
    exercise_emoji: '🏃',
    duration_minutes: 30,
    calories_burned: 300,
    felt: 'good',
    notes: 'Morning jog',
    logged_at: `${YESTERDAY}T09:00:00.000Z`,
    created_at: `${YESTERDAY}T09:00:00.000Z`,
    ...overrides,
  };
}

// ─── REPEAT YESTERDAY — Guest Mode ────────────────────────────────────────────

describe('UAT: Repeat Yesterday — guest mode', () => {
  it('copies all yesterday food entries to today with today\'s timestamp', async () => {
    const food1 = makeFood({ id: 'f1', meal_name: 'Oatmeal' });
    const food2 = makeFood({ id: 'f2', meal_name: 'Banana Smoothie', calories: 280 });
    await saveGuestLog(food1);
    await saveGuestLog(food2);

    // Simulate what journal.tsx handleRepeatYesterday does
    const now = new Date().toISOString();
    await saveGuestLog({ ...food1, id: 'f1-copy', logged_at: now, created_at: now });
    await saveGuestLog({ ...food2, id: 'f2-copy', logged_at: now, created_at: now });

    const all = await getGuestLogs();
    const todayLogs = all.filter(l => toLocalDateStr(new Date(l.logged_at)) === TODAY);
    expect(todayLogs).toHaveLength(2);
    expect(todayLogs.map(l => l.meal_name).sort()).toEqual(['Banana Smoothie', 'Oatmeal']);
  });

  it('preserves every macro field exactly when copying from yesterday', async () => {
    const original = makeFood({ id: 'orig', calories: 420, protein_g: 35, carbs_g: 52, fat_g: 8,
      fiber_g: 4, sugar_g: 6, sodium_mg: 550, cholesterol_mg: 70, saturated_fat_g: 2 });
    await saveGuestLog(original);

    const now = new Date().toISOString();
    await saveGuestLog({ ...original, id: 'copy', logged_at: now, created_at: now });

    const copy = (await getGuestLogs()).find(l => l.id === 'copy')!;
    expect(copy.calories).toBe(420);
    expect(copy.protein_g).toBe(35);
    expect(copy.carbs_g).toBe(52);
    expect(copy.fat_g).toBe(8);
    expect(copy.fiber_g).toBe(4);
    expect(copy.sugar_g).toBe(6);
    expect(copy.sodium_mg).toBe(550);
    expect(copy.cholesterol_mg).toBe(70);
    expect(copy.saturated_fat_g).toBe(2);
  });

  it('preserves exercise fields including felt rating when copying', async () => {
    const ex = makeExercise({ felt: 'hard', notes: 'Really tough hill sprints' });
    await saveGuestExerciseLog(ex);

    const now = new Date().toISOString();
    await saveGuestExerciseLog({ ...ex, id: 'e-copy', logged_at: now, created_at: now });

    const copy = (await getGuestExerciseLogs()).find(l => l.id === 'e-copy')!;
    expect(copy.exercise_name).toBe('Running');
    expect(copy.duration_minutes).toBe(30);
    expect(copy.calories_burned).toBe(300);
    expect(copy.felt).toBe('hard');
    expect(copy.notes).toBe('Really tough hill sprints');
  });

  it('does not modify the original yesterday entries', async () => {
    const original = makeFood({ id: 'orig' });
    await saveGuestLog(original);

    const now = new Date().toISOString();
    await saveGuestLog({ ...original, id: 'copy', logged_at: now, created_at: now });

    const orig = (await getGuestLogs()).find(l => l.id === 'orig')!;
    expect(orig.logged_at).toBe(`${YESTERDAY}T08:00:00.000Z`); // unchanged
  });

  it('copied entries can be edited and saved normally', async () => {
    const now = new Date().toISOString();
    const copy = makeFood({ id: 'copy', logged_at: now, created_at: now });
    await saveGuestLog(copy);

    await updateGuestLog('copy', {
      meal_name: 'Updated Oatmeal',
      calories: 400,
      notes: 'Added honey',
    });

    const updated = (await getGuestLogs()).find(l => l.id === 'copy')!;
    expect(updated.meal_name).toBe('Updated Oatmeal');
    expect(updated.calories).toBe(400);
    expect(updated.notes).toBe('Added honey');
    expect(updated.protein_g).toBe(10); // other fields unchanged
  });

  it('exercises from Repeat Yesterday can be edited', async () => {
    const now = new Date().toISOString();
    const copy = makeExercise({ id: 'e-copy', logged_at: now, created_at: now });
    await saveGuestExerciseLog(copy);

    await updateGuestExerciseLog('e-copy', { duration_minutes: 45, calories_burned: 420, felt: 'exhausting' });

    const updated = (await getGuestExerciseLogs()).find(l => l.id === 'e-copy')!;
    expect(updated.duration_minutes).toBe(45);
    expect(updated.calories_burned).toBe(420);
    expect(updated.felt).toBe('exhausting');
  });
});

// ─── SAVE TEMPLATE journey ─────────────────────────────────────────────────────

describe('UAT: Save Template', () => {
  const TEMPLATE: DayTemplate = {
    savedAt: new Date().toISOString(),
    sourceDate: TODAY,
    foods: [
      { meal_name: 'Oatmeal', foods_detected: ['oats'], calories: 350, protein_g: 10,
        carbs_g: 60, fat_g: 5, fiber_g: 6, sugar_g: 12, sodium_mg: 80, cholesterol_mg: 0, saturated_fat_g: 1 },
      { meal_name: 'Grilled Chicken', foods_detected: ['chicken'], calories: 450, protein_g: 40,
        carbs_g: 0, fat_g: 15, fiber_g: 0, sugar_g: 0, sodium_mg: 500, cholesterol_mg: 90, saturated_fat_g: 3 },
    ],
    exercises: [
      { exercise_name: 'Running', exercise_emoji: '🏃', duration_minutes: 30, calories_burned: 300, felt: 'good' },
    ],
  };

  it('saves template with correct entry counts', async () => {
    await saveDayTemplate(TEMPLATE);
    const t = await getDayTemplate();
    expect(t?.foods).toHaveLength(2);
    expect(t?.exercises).toHaveLength(1);
  });

  it('all food macro fields are persisted in template', async () => {
    await saveDayTemplate(TEMPLATE);
    const food = (await getDayTemplate())!.foods[0];
    expect(food.meal_name).toBe('Oatmeal');
    expect(food.calories).toBe(350);
    expect(food.protein_g).toBe(10);
    expect(food.carbs_g).toBe(60);
    expect(food.fat_g).toBe(5);
    expect(food.fiber_g).toBe(6);
    expect(food.sugar_g).toBe(12);
    expect(food.sodium_mg).toBe(80);
    expect(food.cholesterol_mg).toBe(0);
    expect(food.saturated_fat_g).toBe(1);
  });

  it('exercise felt rating and notes are persisted', async () => {
    const t: DayTemplate = {
      ...TEMPLATE,
      exercises: [{ exercise_name: 'Yoga', exercise_emoji: '🧘', duration_minutes: 60,
        calories_burned: 180, felt: 'easy', notes: 'Morning flow' }],
    };
    await saveDayTemplate(t);
    const ex = (await getDayTemplate())!.exercises[0];
    expect(ex.felt).toBe('easy');
    expect(ex.notes).toBe('Morning flow');
  });

  it('overwrites existing template when saved again', async () => {
    await saveDayTemplate(TEMPLATE);
    const updated: DayTemplate = { ...TEMPLATE, sourceDate: YESTERDAY, foods: [], exercises: [] };
    await saveDayTemplate(updated);
    const t = await getDayTemplate();
    expect(t?.sourceDate).toBe(YESTERDAY);
    expect(t?.foods).toHaveLength(0);
  });

  it('clearDayTemplate removes the saved template completely', async () => {
    await saveDayTemplate(TEMPLATE);
    await clearDayTemplate();
    expect(await getDayTemplate()).toBeNull();
  });
});

// ─── APPLY TEMPLATE journey ────────────────────────────────────────────────────

describe('UAT: Apply Template — entries created are editable', () => {
  it('applying a template creates new guest entries with today\'s timestamp', async () => {
    const template: DayTemplate = {
      savedAt: new Date().toISOString(),
      sourceDate: YESTERDAY,
      foods: [{ meal_name: 'Pasta', foods_detected: ['pasta'], calories: 600, protein_g: 20,
        carbs_g: 90, fat_g: 10, fiber_g: 3, sugar_g: 5, sodium_mg: 700, cholesterol_mg: 0, saturated_fat_g: 2 }],
      exercises: [{ exercise_name: 'Cycling', exercise_emoji: '🚴', duration_minutes: 45,
        calories_burned: 360, felt: 'good' }],
    };

    const now = new Date().toISOString();
    // Simulate applying the template (what journal.tsx handleApplyTemplate does)
    for (const food of template.foods) {
      await saveGuestLog({
        id: `tpl-food-${food.meal_name}`,
        user_id: 'guest',
        ...food,
        logged_at: now,
        created_at: now,
      });
    }
    for (const ex of template.exercises) {
      await saveGuestExerciseLog({
        id: `tpl-ex-${ex.exercise_name}`,
        user_id: 'guest',
        ...ex,
        logged_at: now,
        created_at: now,
      });
    }

    const foods = await getGuestLogs();
    const exercises = await getGuestExerciseLogs();
    expect(toLocalDateStr(new Date(foods[0].logged_at))).toBe(TODAY);
    expect(toLocalDateStr(new Date(exercises[0].logged_at))).toBe(TODAY);
  });

  it('template-applied food entry can be edited — all fields', async () => {
    const now = new Date().toISOString();
    await saveGuestLog({
      id: 'tpl-f1',
      user_id: 'guest',
      meal_name: 'Pasta',
      foods_detected: ['pasta'],
      calories: 600,
      protein_g: 20,
      carbs_g: 90,
      fat_g: 10,
      fiber_g: 3,
      sugar_g: 5,
      sodium_mg: 700,
      cholesterol_mg: 0,
      saturated_fat_g: 2,
      logged_at: now,
      created_at: now,
    });

    await updateGuestLog('tpl-f1', {
      meal_name: 'Whole Wheat Pasta',
      calories: 550,
      protein_g: 22,
      carbs_g: 85,
      fat_g: 8,
      fiber_g: 5,
      sugar_g: 3,
      sodium_mg: 650,
      cholesterol_mg: 10,
      saturated_fat_g: 1,
      notes: 'Less salt this time',
    });

    const updated = (await getGuestLogs()).find(l => l.id === 'tpl-f1')!;
    expect(updated.meal_name).toBe('Whole Wheat Pasta');
    expect(updated.calories).toBe(550);
    expect(updated.protein_g).toBe(22);
    expect(updated.carbs_g).toBe(85);
    expect(updated.fat_g).toBe(8);
    expect(updated.fiber_g).toBe(5);
    expect(updated.sugar_g).toBe(3);
    expect(updated.sodium_mg).toBe(650);
    expect(updated.cholesterol_mg).toBe(10);
    expect(updated.saturated_fat_g).toBe(1);
    expect(updated.notes).toBe('Less salt this time');
  });

  it('template-applied exercise entry can be edited — all fields', async () => {
    const now = new Date().toISOString();
    await saveGuestExerciseLog({
      id: 'tpl-e1',
      user_id: 'guest',
      exercise_name: 'Cycling',
      exercise_emoji: '🚴',
      duration_minutes: 45,
      calories_burned: 360,
      felt: 'good',
      logged_at: now,
      created_at: now,
    });

    await updateGuestExerciseLog('tpl-e1', {
      exercise_name: 'Mountain Biking',
      exercise_emoji: '🏔️',
      duration_minutes: 60,
      calories_burned: 500,
      felt: 'hard',
      notes: 'Trail ride, steep climbs',
    });

    const updated = (await getGuestExerciseLogs()).find(l => l.id === 'tpl-e1')!;
    expect(updated.exercise_name).toBe('Mountain Biking');
    expect(updated.exercise_emoji).toBe('🏔️');
    expect(updated.duration_minutes).toBe(60);
    expect(updated.calories_burned).toBe(500);
    expect(updated.felt).toBe('hard');
    expect(updated.notes).toBe('Trail ride, steep climbs');
  });
});

// ─── AUTH USER — updateLog does NOT send updated_at ───────────────────────────

describe('UAT: Authenticated user — edit never causes infinite spinner', () => {
  const DB_FOOD: FoodLog = {
    id: 'db-f1', user_id: 'user-1', meal_name: 'Salad', foods_detected: ['lettuce'],
    calories: 200, protein_g: 5, carbs_g: 20, fat_g: 8, fiber_g: 3, sugar_g: 2,
    sodium_mg: 150, cholesterol_mg: 0, saturated_fat_g: 1,
    logged_at: new Date().toISOString(), created_at: new Date().toISOString(),
  };
  const DB_EX: ExerciseLog = {
    id: 'db-e1', user_id: 'user-1', exercise_name: 'Yoga', exercise_emoji: '🧘',
    duration_minutes: 30, calories_burned: 120, felt: 'easy',
    logged_at: new Date().toISOString(), created_at: new Date().toISOString(),
  };

  it('food updateLog payload never includes updated_at — prevents column-missing crash', async () => {
    useFoodLogStore.setState({ logs: [DB_FOOD], isLoading: false, capturedPhotoUri: null, capturedPhotoBase64: null });
    let payload: any;
    mockUpdate.mockImplementationOnce((p: any) => { payload = p; return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }; });

    await act(async () => {
      await useFoodLogStore.getState().updateLog('db-f1', { calories: 250 }, 'user-1', false);
    });
    expect(payload).not.toHaveProperty('updated_at');
  });

  it('exercise updateLog payload never includes updated_at', async () => {
    useExerciseLogStore.setState({ exerciseLogs: [DB_EX], isLoading: false });
    let payload: any;
    mockUpdate.mockImplementationOnce((p: any) => { payload = p; return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }; });

    await act(async () => {
      await useExerciseLogStore.getState().updateExerciseLog('db-e1', { calories_burned: 200 }, 'user-1', false);
    });
    expect(payload).not.toHaveProperty('updated_at');
  });
});
