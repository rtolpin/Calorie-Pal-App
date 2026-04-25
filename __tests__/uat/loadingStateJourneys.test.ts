/**
 * UAT — Loading States Never Hang (No Infinite Spinner)
 *
 * Verifies that isLoading returns to false on EVERY code path:
 *   • Supabase success
 *   • Supabase error (network, column missing, auth)
 *   • Early return (no userId)
 *   • Optimistic rollback after insert failure
 *
 * These tests prevent the infinite-spinner regression caused by
 * `updated_at` sending to a table that lacks the column.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { act } from '@testing-library/react-native';
import { useFoodLogStore }     from '../../store/foodLogStore';
import { useExerciseLogStore } from '../../store/exerciseLogStore';
import { FoodLog, ExerciseLog } from '../../types';

// ─── mocks ────────────────────────────────────────────────────────────────────

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

const DB_FOOD: FoodLog = {
  id: 'f1', user_id: 'u1', meal_name: 'Salad', foods_detected: ['lettuce'],
  calories: 200, protein_g: 5, carbs_g: 20, fat_g: 8, fiber_g: 3, sugar_g: 2,
  sodium_mg: 150, cholesterol_mg: 0, saturated_fat_g: 1,
  logged_at: new Date().toISOString(), created_at: new Date().toISOString(),
};

const DB_EX: ExerciseLog = {
  id: 'e1', user_id: 'u1', exercise_name: 'Yoga', exercise_emoji: '🧘',
  duration_minutes: 30, calories_burned: 120,
  logged_at: new Date().toISOString(), created_at: new Date().toISOString(),
};

const MOCK_LOG_INPUT: Omit<FoodLog, 'id' | 'created_at'> = {
  user_id: 'u1', meal_name: 'Test', foods_detected: [],
  calories: 100, protein_g: 5, carbs_g: 20, fat_g: 3, fiber_g: 1, sugar_g: 2,
  sodium_mg: 50, cholesterol_mg: 0, saturated_fat_g: 0,
  logged_at: new Date().toISOString(),
};

function resetStores() {
  useFoodLogStore.setState({ logs: [], isLoading: false, capturedPhotoUri: null, capturedPhotoBase64: null });
  useExerciseLogStore.setState({ exerciseLogs: [], isLoading: false });
}

beforeEach(() => {
  resetStores();
  [mockInsert, mockUpdate, mockSelect, mockDelete].forEach(m => m.mockReset());
});

// ─── FOOD STORE — fetchLogs ────────────────────────────────────────────────────

describe('UAT: Food store — isLoading always resets', () => {
  it('resets after successful fetch', async () => {
    mockSelect.mockReturnValueOnce({ eq: () => ({ order: () => Promise.resolve({ data: [DB_FOOD], error: null }) }) });
    await act(async () => { await useFoodLogStore.getState().fetchLogs('u1', false); });
    expect(useFoodLogStore.getState().isLoading).toBe(false);
  });

  it('resets after Supabase error response', async () => {
    mockSelect.mockReturnValueOnce({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'Connection refused' } }) }) });
    await act(async () => { await useFoodLogStore.getState().fetchLogs('u1', false); });
    expect(useFoodLogStore.getState().isLoading).toBe(false);
  });

  it('resets after network throw', async () => {
    mockSelect.mockReturnValueOnce({ eq: () => ({ order: () => Promise.reject(new Error('Network error')) }) });
    await act(async () => { await useFoodLogStore.getState().fetchLogs('u1', false); });
    expect(useFoodLogStore.getState().isLoading).toBe(false);
  });

  it('resets immediately when no userId provided', async () => {
    await act(async () => { await useFoodLogStore.getState().fetchLogs(undefined, false); });
    expect(useFoodLogStore.getState().isLoading).toBe(false);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('logs array is unchanged when fetch errors', async () => {
    useFoodLogStore.setState({ logs: [DB_FOOD], isLoading: false, capturedPhotoUri: null, capturedPhotoBase64: null });
    mockSelect.mockReturnValueOnce({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'err' } }) }) });
    await act(async () => { await useFoodLogStore.getState().fetchLogs('u1', false); });
    expect(useFoodLogStore.getState().logs).toEqual([DB_FOOD]); // kept existing
  });
});

// ─── FOOD STORE — addLog ──────────────────────────────────────────────────────

describe('UAT: Food store — addLog optimistic rollback on error', () => {
  it('rolls back optimistic entry when Supabase insert fails', async () => {
    mockInsert.mockReturnValueOnce({
      select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Insert failed' } }) }),
    });
    await act(async () => {
      try { await useFoodLogStore.getState().addLog(MOCK_LOG_INPUT, 'u1', false); } catch {}
    });
    expect(useFoodLogStore.getState().logs).toHaveLength(0);
  });

  it('keeps the real Supabase ID after successful insert', async () => {
    const dbLog: FoodLog = { ...MOCK_LOG_INPUT, id: 'supabase-uuid', created_at: new Date().toISOString() };
    mockInsert.mockReturnValueOnce({
      select: () => ({ single: () => Promise.resolve({ data: dbLog, error: null }) }),
    });
    await act(async () => { await useFoodLogStore.getState().addLog(MOCK_LOG_INPUT, 'u1', false); });
    expect(useFoodLogStore.getState().logs[0].id).toBe('supabase-uuid');
  });
});

// ─── FOOD STORE — updateLog ───────────────────────────────────────────────────

describe('UAT: Food store — updateLog never hangs', () => {
  it('succeeds and updates state', async () => {
    useFoodLogStore.setState({ logs: [DB_FOOD], isLoading: false, capturedPhotoUri: null, capturedPhotoBase64: null });
    mockUpdate.mockReturnValueOnce({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) });
    await act(async () => { await useFoodLogStore.getState().updateLog('f1', { calories: 300 }, 'u1', false); });
    expect(useFoodLogStore.getState().logs[0].calories).toBe(300);
  });

  it('throws and does NOT mutate state on Supabase error (simulates missing updated_at column)', async () => {
    useFoodLogStore.setState({ logs: [DB_FOOD], isLoading: false, capturedPhotoUri: null, capturedPhotoBase64: null });
    mockUpdate.mockReturnValueOnce({
      eq: () => ({ eq: () => Promise.resolve({ error: { message: 'column "updated_at" of relation "food_logs" does not exist' } }) }),
    });
    await expect(
      useFoodLogStore.getState().updateLog('f1', { calories: 999 }, 'u1', false)
    ).rejects.toMatchObject({ message: expect.stringContaining('updated_at') });
    expect(useFoodLogStore.getState().logs[0].calories).toBe(200); // unchanged
  });

  it('update payload does not include updated_at (root cause of infinite spinner fix)', async () => {
    useFoodLogStore.setState({ logs: [DB_FOOD], isLoading: false, capturedPhotoUri: null, capturedPhotoBase64: null });
    let capturedPayload: any;
    mockUpdate.mockImplementationOnce((p: any) => {
      capturedPayload = p;
      return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
    });
    await act(async () => {
      await useFoodLogStore.getState().updateLog('f1', { calories: 300 }, 'u1', false);
    });
    expect(capturedPayload).not.toHaveProperty('updated_at');
  });
});

// ─── EXERCISE STORE — loading state ──────────────────────────────────────────

describe('UAT: Exercise store — isLoading always resets', () => {
  it('resets after successful fetch', async () => {
    mockSelect.mockReturnValueOnce({ eq: () => ({ order: () => Promise.resolve({ data: [DB_EX], error: null }) }) });
    await act(async () => { await useExerciseLogStore.getState().fetchExerciseLogs('u1', false); });
    expect(useExerciseLogStore.getState().isLoading).toBe(false);
  });

  it('resets after Supabase fetch error', async () => {
    mockSelect.mockReturnValueOnce({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'err' } }) }) });
    await act(async () => { await useExerciseLogStore.getState().fetchExerciseLogs('u1', false); });
    expect(useExerciseLogStore.getState().isLoading).toBe(false);
  });

  it('resets after network throw', async () => {
    mockSelect.mockReturnValueOnce({ eq: () => ({ order: () => Promise.reject(new Error('timeout')) }) });
    await act(async () => { await useExerciseLogStore.getState().fetchExerciseLogs('u1', false); });
    expect(useExerciseLogStore.getState().isLoading).toBe(false);
  });
});

describe('UAT: Exercise store — updateExerciseLog never hangs', () => {
  it('payload does not include updated_at', async () => {
    useExerciseLogStore.setState({ exerciseLogs: [DB_EX], isLoading: false });
    let capturedPayload: any;
    mockUpdate.mockImplementationOnce((p: any) => {
      capturedPayload = p;
      return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
    });
    await act(async () => {
      await useExerciseLogStore.getState().updateExerciseLog('e1', { calories_burned: 200 }, 'u1', false);
    });
    expect(capturedPayload).not.toHaveProperty('updated_at');
  });

  it('throws on Supabase column error without hanging', async () => {
    useExerciseLogStore.setState({ exerciseLogs: [DB_EX], isLoading: false });
    mockUpdate.mockReturnValueOnce({
      eq: () => ({ eq: () => Promise.resolve({ error: { message: 'column "updated_at" does not exist' } }) }),
    });
    await expect(
      useExerciseLogStore.getState().updateExerciseLog('e1', { calories_burned: 999 }, 'u1', false)
    ).rejects.toBeTruthy();
    expect(useExerciseLogStore.getState().exerciseLogs[0].calories_burned).toBe(120); // unchanged
  });
});

// ─── EDGE CASES that previously caused hangs ─────────────────────────────────

describe('UAT: Edge cases that previously caused indefinite loading', () => {
  it('addLog with guest mode never touches Supabase (no network dependency)', async () => {
    await act(async () => {
      await useFoodLogStore.getState().addLog(MOCK_LOG_INPUT, undefined, true);
    });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(useFoodLogStore.getState().logs).toHaveLength(1);
  });

  it('addExerciseLog with guest mode never touches Supabase', async () => {
    const exInput: Omit<ExerciseLog, 'id' | 'created_at'> = {
      user_id: undefined, exercise_name: 'Yoga', exercise_emoji: '🧘',
      duration_minutes: 20, calories_burned: 60, logged_at: new Date().toISOString(),
    };
    await act(async () => {
      await useExerciseLogStore.getState().addExerciseLog(exInput, undefined, true);
    });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(useExerciseLogStore.getState().exerciseLogs).toHaveLength(1);
  });

  it('insert with undefined photo_url does not send the field (prevents unknown column error)', async () => {
    let capturedPayload: any;
    mockInsert.mockImplementationOnce((p: any) => {
      capturedPayload = p;
      return { select: () => ({ single: () => Promise.resolve({ data: { ...p, id: 'new-id', created_at: new Date().toISOString() }, error: null }) }) };
    });
    await act(async () => {
      await useFoodLogStore.getState().addLog({ ...MOCK_LOG_INPUT, photo_url: undefined }, 'u1', false);
    });
    expect(capturedPayload).not.toHaveProperty('photo_url');
  });
});
