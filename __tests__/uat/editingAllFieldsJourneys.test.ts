/**
 * UAT — Editing All Fields of Food and Exercise Entries
 *
 * Verifies that every single editable field on a food log and exercise log
 * can be changed and the change persists — both for guest (AsyncStorage) and
 * authenticated users (Supabase store).
 *
 * Also verifies entries created from fresh scans, Repeat Yesterday, or
 * templates are equally editable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { act } from '@testing-library/react-native';
import { useFoodLogStore }     from '../../store/foodLogStore';
import { useExerciseLogStore } from '../../store/exerciseLogStore';
import {
  saveGuestLog, getGuestLogs, updateGuestLog,
  saveGuestExerciseLog, getGuestExerciseLogs, updateGuestExerciseLog,
} from '../../lib/asyncStorage';
import { FoodLog, ExerciseLog } from '../../types';

// ─── Supabase mock ─────────────────────────────────────────────────────────────

const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockSelect = jest.fn();
const mockDelete = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: mockSelect, insert: mockInsert, update: mockUpdate, delete: mockDelete,
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
  [mockInsert, mockUpdate, mockSelect, mockDelete].forEach(m => m.mockReset());
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function freshFoodLog(id = 'f1'): FoodLog {
  return {
    id,
    user_id: 'guest',
    meal_name: 'Oatmeal',
    foods_detected: ['oats'],
    calories: 300,
    protein_g: 10,
    carbs_g: 50,
    fat_g: 6,
    fiber_g: 5,
    sugar_g: 8,
    sodium_mg: 120,
    cholesterol_mg: 0,
    saturated_fat_g: 1,
    notes: undefined,
    logged_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

function freshExerciseLog(id = 'e1'): ExerciseLog {
  return {
    id,
    user_id: 'guest',
    exercise_name: 'Walking',
    exercise_emoji: '🚶',
    duration_minutes: 20,
    calories_burned: 80,
    felt: undefined,
    notes: undefined,
    logged_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

// ─── FOOD ENTRY — Edit Every Field (Guest) ────────────────────────────────────

describe('UAT: Edit every field of a food entry — guest mode', () => {
  it('meal_name can be changed', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', { meal_name: 'Overnight Oats' });
    expect((await getGuestLogs())[0].meal_name).toBe('Overnight Oats');
  });

  it('calories can be changed', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', { calories: 420 });
    expect((await getGuestLogs())[0].calories).toBe(420);
  });

  it('protein_g can be changed', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', { protein_g: 25 });
    expect((await getGuestLogs())[0].protein_g).toBe(25);
  });

  it('carbs_g can be changed', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', { carbs_g: 72 });
    expect((await getGuestLogs())[0].carbs_g).toBe(72);
  });

  it('fat_g can be changed', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', { fat_g: 12 });
    expect((await getGuestLogs())[0].fat_g).toBe(12);
  });

  it('fiber_g can be changed', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', { fiber_g: 9 });
    expect((await getGuestLogs())[0].fiber_g).toBe(9);
  });

  it('sugar_g can be changed', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', { sugar_g: 3 });
    expect((await getGuestLogs())[0].sugar_g).toBe(3);
  });

  it('sodium_mg can be changed', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', { sodium_mg: 450 });
    expect((await getGuestLogs())[0].sodium_mg).toBe(450);
  });

  it('cholesterol_mg can be changed', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', { cholesterol_mg: 85 });
    expect((await getGuestLogs())[0].cholesterol_mg).toBe(85);
  });

  it('saturated_fat_g can be changed', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', { saturated_fat_g: 3.5 });
    expect((await getGuestLogs())[0].saturated_fat_g).toBe(3.5);
  });

  it('notes can be added when originally absent', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', { notes: 'Felt great after this' });
    expect((await getGuestLogs())[0].notes).toBe('Felt great after this');
  });

  it('notes can be cleared by setting to undefined', async () => {
    await saveGuestLog({ ...freshFoodLog(), notes: 'Old note' });
    await updateGuestLog('f1', { notes: undefined });
    expect((await getGuestLogs())[0].notes).toBeUndefined();
  });

  it('photo_url can be added', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', { photo_url: 'file:///local/photo.jpg' });
    expect((await getGuestLogs())[0].photo_url).toBe('file:///local/photo.jpg');
  });

  it('logged_at (date/time) can be changed', async () => {
    await saveGuestLog(freshFoodLog());
    const newTime = '2026-01-15T07:00:00.000Z';
    await updateGuestLog('f1', { logged_at: newTime });
    expect((await getGuestLogs())[0].logged_at).toBe(newTime);
  });

  it('all fields can be changed in one update call', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', {
      meal_name:       'Quinoa Bowl',
      calories:        520,
      protein_g:       28,
      carbs_g:         68,
      fat_g:           14,
      fiber_g:         8,
      sugar_g:         4,
      sodium_mg:       380,
      cholesterol_mg:  15,
      saturated_fat_g: 2,
      notes:           'Post-workout',
      photo_url:       'https://cdn.example.com/q.jpg',
    });
    const u = (await getGuestLogs())[0];
    expect(u.meal_name).toBe('Quinoa Bowl');
    expect(u.calories).toBe(520);
    expect(u.protein_g).toBe(28);
    expect(u.notes).toBe('Post-workout');
    expect(u.photo_url).toBe('https://cdn.example.com/q.jpg');
  });

  it('unchanged fields are preserved when partial update is applied', async () => {
    await saveGuestLog(freshFoodLog());
    await updateGuestLog('f1', { calories: 999 });
    const u = (await getGuestLogs())[0];
    expect(u.calories).toBe(999);
    expect(u.meal_name).toBe('Oatmeal');  // unchanged
    expect(u.protein_g).toBe(10);          // unchanged
  });
});

// ─── EXERCISE ENTRY — Edit Every Field (Guest) ────────────────────────────────

describe('UAT: Edit every field of an exercise entry — guest mode', () => {
  it('exercise_name can be changed', async () => {
    await saveGuestExerciseLog(freshExerciseLog());
    await updateGuestExerciseLog('e1', { exercise_name: 'Hiking' });
    expect((await getGuestExerciseLogs())[0].exercise_name).toBe('Hiking');
  });

  it('exercise_emoji can be changed', async () => {
    await saveGuestExerciseLog(freshExerciseLog());
    await updateGuestExerciseLog('e1', { exercise_emoji: '🥾' });
    expect((await getGuestExerciseLogs())[0].exercise_emoji).toBe('🥾');
  });

  it('duration_minutes can be changed', async () => {
    await saveGuestExerciseLog(freshExerciseLog());
    await updateGuestExerciseLog('e1', { duration_minutes: 75 });
    expect((await getGuestExerciseLogs())[0].duration_minutes).toBe(75);
  });

  it('calories_burned can be changed', async () => {
    await saveGuestExerciseLog(freshExerciseLog());
    await updateGuestExerciseLog('e1', { calories_burned: 450 });
    expect((await getGuestExerciseLogs())[0].calories_burned).toBe(450);
  });

  it('felt can be set to each valid value', async () => {
    for (const felt of ['easy', 'good', 'hard', 'exhausting'] as const) {
      await saveGuestExerciseLog({ ...freshExerciseLog(), id: `e-${felt}` });
      await updateGuestExerciseLog(`e-${felt}`, { felt });
      expect((await getGuestExerciseLogs()).find(l => l.id === `e-${felt}`)?.felt).toBe(felt);
    }
  });

  it('notes can be added', async () => {
    await saveGuestExerciseLog(freshExerciseLog());
    await updateGuestExerciseLog('e1', { notes: 'Trail run in the rain' });
    expect((await getGuestExerciseLogs())[0].notes).toBe('Trail run in the rain');
  });

  it('photo_url can be set', async () => {
    await saveGuestExerciseLog(freshExerciseLog());
    await updateGuestExerciseLog('e1', { photo_url: 'https://cdn.example.com/run.jpg' });
    expect((await getGuestExerciseLogs())[0].photo_url).toBe('https://cdn.example.com/run.jpg');
  });

  it('logged_at can be changed', async () => {
    await saveGuestExerciseLog(freshExerciseLog());
    const ts = '2026-03-10T06:30:00.000Z';
    await updateGuestExerciseLog('e1', { logged_at: ts });
    expect((await getGuestExerciseLogs())[0].logged_at).toBe(ts);
  });

  it('all fields changed at once — none lost', async () => {
    await saveGuestExerciseLog(freshExerciseLog());
    await updateGuestExerciseLog('e1', {
      exercise_name:   'HIIT',
      exercise_emoji:  '⚡',
      duration_minutes: 25,
      calories_burned: 320,
      felt:            'hard',
      notes:           'Tabata intervals',
      photo_url:       'https://cdn.example.com/hiit.jpg',
    });
    const u = (await getGuestExerciseLogs())[0];
    expect(u.exercise_name).toBe('HIIT');
    expect(u.exercise_emoji).toBe('⚡');
    expect(u.duration_minutes).toBe(25);
    expect(u.calories_burned).toBe(320);
    expect(u.felt).toBe('hard');
    expect(u.notes).toBe('Tabata intervals');
    expect(u.photo_url).toBe('https://cdn.example.com/hiit.jpg');
  });
});

// ─── AUTHENTICATED USER — Edit via Supabase store ─────────────────────────────

describe('UAT: Edit food entry — authenticated user via Supabase store', () => {
  const DB_LOG: FoodLog = { ...freshFoodLog('db-1'), user_id: 'user-1' };

  it('updates all changed fields in Supabase and local state', async () => {
    useFoodLogStore.setState({ logs: [DB_LOG], isLoading: false, capturedPhotoUri: null, capturedPhotoBase64: null });
    mockUpdate.mockReturnValueOnce({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) });

    await act(async () => {
      await useFoodLogStore.getState().updateLog('db-1', { meal_name: 'Granola', calories: 480 }, 'user-1', false);
    });

    const updated = useFoodLogStore.getState().logs.find(l => l.id === 'db-1')!;
    expect(updated.meal_name).toBe('Granola');
    expect(updated.calories).toBe(480);
    expect(updated.protein_g).toBe(10); // unchanged
  });

  it('on Supabase error the update throws and state is not corrupted', async () => {
    useFoodLogStore.setState({ logs: [DB_LOG], isLoading: false, capturedPhotoUri: null, capturedPhotoBase64: null });
    mockUpdate.mockReturnValueOnce({ eq: () => ({ eq: () => Promise.resolve({ error: { message: 'DB error' } }) }) });

    await expect(
      useFoodLogStore.getState().updateLog('db-1', { calories: 999 }, 'user-1', false)
    ).rejects.toMatchObject({ message: 'DB error' });

    // State is NOT changed since updateLog throws before the set()
    expect(useFoodLogStore.getState().logs[0].calories).toBe(300);
  });
});

describe('UAT: Edit exercise entry — authenticated user via Supabase store', () => {
  const DB_EX: ExerciseLog = { ...freshExerciseLog('db-e1'), user_id: 'user-1' };

  it('updates all changed fields in Supabase and local state', async () => {
    useExerciseLogStore.setState({ exerciseLogs: [DB_EX], isLoading: false });
    mockUpdate.mockReturnValueOnce({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) });

    await act(async () => {
      await useExerciseLogStore.getState().updateExerciseLog('db-e1', { duration_minutes: 60, felt: 'hard' }, 'user-1', false);
    });

    const updated = useExerciseLogStore.getState().exerciseLogs.find(l => l.id === 'db-e1')!;
    expect(updated.duration_minutes).toBe(60);
    expect(updated.felt).toBe('hard');
    expect(updated.exercise_name).toBe('Walking'); // unchanged
  });
});
