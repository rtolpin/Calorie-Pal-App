import { act } from '@testing-library/react-native';
import { useExerciseLogStore } from '../../store/exerciseLogStore';
import { ExerciseLog } from '../../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
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

const MOCK_LOG: Omit<ExerciseLog, 'id' | 'created_at'> = {
  user_id: 'user-1',
  exercise_name: 'Running',
  exercise_emoji: '🏃',
  duration_minutes: 30,
  calories_burned: 300,
  logged_at: new Date().toISOString(),
};

const DB_LOG: ExerciseLog = {
  ...MOCK_LOG,
  id: 'db-ex-1',
  created_at: new Date().toISOString(),
};

function resetStore() {
  useExerciseLogStore.setState({ exerciseLogs: [], isLoading: false });
}

beforeEach(() => {
  resetStore();
  mockSelect.mockReset();
  mockInsert.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();
});

describe('fetchExerciseLogs', () => {
  describe('guest user', () => {
    it('loads exercise logs from AsyncStorage', async () => {
      await act(async () => {
        await useExerciseLogStore.getState().addExerciseLog(MOCK_LOG, undefined, true);
      });
      resetStore();

      await act(async () => {
        await useExerciseLogStore.getState().fetchExerciseLogs(undefined, true);
      });

      expect(useExerciseLogStore.getState().exerciseLogs.length).toBeGreaterThan(0);
    });

    it('sets isLoading to false after fetching', async () => {
      await act(async () => {
        await useExerciseLogStore.getState().fetchExerciseLogs(undefined, true);
      });
      expect(useExerciseLogStore.getState().isLoading).toBe(false);
    });
  });

  describe('authenticated user', () => {
    it('sets isLoading to false when no userId provided', async () => {
      await act(async () => {
        await useExerciseLogStore.getState().fetchExerciseLogs(undefined, false);
      });
      expect(useExerciseLogStore.getState().isLoading).toBe(false);
    });

    it('loads logs from Supabase on success', async () => {
      mockSelect.mockReturnValueOnce({
        eq: () => ({ order: () => Promise.resolve({ data: [DB_LOG], error: null }) }),
      });

      await act(async () => {
        await useExerciseLogStore.getState().fetchExerciseLogs('user-1', false);
      });

      expect(useExerciseLogStore.getState().exerciseLogs).toEqual([DB_LOG]);
      expect(useExerciseLogStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading to false on Supabase error', async () => {
      mockSelect.mockReturnValueOnce({
        eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'DB error' } }) }),
      });

      await act(async () => {
        await useExerciseLogStore.getState().fetchExerciseLogs('user-1', false);
      });

      expect(useExerciseLogStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading to false when an unexpected error is thrown', async () => {
      mockSelect.mockReturnValueOnce({
        eq: () => ({ order: () => Promise.reject(new Error('Network error')) }),
      });

      await act(async () => {
        await useExerciseLogStore.getState().fetchExerciseLogs('user-1', false);
      });

      expect(useExerciseLogStore.getState().isLoading).toBe(false);
    });
  });
});

describe('addExerciseLog', () => {
  describe('guest user', () => {
    it('adds log to state immediately', async () => {
      await act(async () => {
        await useExerciseLogStore.getState().addExerciseLog(MOCK_LOG, undefined, true);
      });
      expect(useExerciseLogStore.getState().exerciseLogs).toHaveLength(1);
      expect(useExerciseLogStore.getState().exerciseLogs[0].exercise_name).toBe('Running');
    });

    it('prepends new logs (most recent first)', async () => {
      const log2 = { ...MOCK_LOG, exercise_name: 'Cycling' };
      await act(async () => {
        await useExerciseLogStore.getState().addExerciseLog(MOCK_LOG, undefined, true);
        await useExerciseLogStore.getState().addExerciseLog(log2, undefined, true);
      });
      expect(useExerciseLogStore.getState().exerciseLogs[0].exercise_name).toBe('Cycling');
    });

    it('assigns a generated id starting with "guest_"', async () => {
      await act(async () => {
        await useExerciseLogStore.getState().addExerciseLog(MOCK_LOG, undefined, true);
      });
      expect(useExerciseLogStore.getState().exerciseLogs[0].id).toMatch(/^guest_/);
    });
  });

  describe('authenticated user', () => {
    it('does nothing when userId is undefined', async () => {
      await act(async () => {
        await useExerciseLogStore.getState().addExerciseLog(MOCK_LOG, undefined, false);
      });
      expect(useExerciseLogStore.getState().exerciseLogs).toHaveLength(0);
    });

    it('optimistically adds log before Supabase responds', async () => {
      let resolveInsert!: (val: any) => void;
      const insertPromise = new Promise((res) => { resolveInsert = res; });
      mockInsert.mockReturnValueOnce({ select: () => ({ single: () => insertPromise }) });

      const addPromise = useExerciseLogStore.getState().addExerciseLog(MOCK_LOG, 'user-1', false);
      expect(useExerciseLogStore.getState().exerciseLogs).toHaveLength(1);

      resolveInsert({ data: DB_LOG, error: null });
      await act(async () => { await addPromise; });
    });

    it('replaces optimistic log with DB record on success', async () => {
      mockInsert.mockReturnValueOnce({
        select: () => ({ single: () => Promise.resolve({ data: DB_LOG, error: null }) }),
      });

      await act(async () => {
        await useExerciseLogStore.getState().addExerciseLog(MOCK_LOG, 'user-1', false);
      });

      expect(useExerciseLogStore.getState().exerciseLogs[0].id).toBe('db-ex-1');
    });

    it('rolls back optimistic log on Supabase error', async () => {
      mockInsert.mockReturnValueOnce({
        select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Insert failed' } }) }),
      });

      await act(async () => {
        try {
          await useExerciseLogStore.getState().addExerciseLog(MOCK_LOG, 'user-1', false);
        } catch {}
      });

      expect(useExerciseLogStore.getState().exerciseLogs).toHaveLength(0);
    });
  });
});

describe('updateExerciseLog', () => {
  describe('guest user', () => {
    it('updates the log in state', async () => {
      await act(async () => {
        await useExerciseLogStore.getState().addExerciseLog(MOCK_LOG, undefined, true);
      });
      const id = useExerciseLogStore.getState().exerciseLogs[0].id;

      await act(async () => {
        await useExerciseLogStore.getState().updateExerciseLog(id, { calories_burned: 500 }, undefined, true);
      });

      expect(useExerciseLogStore.getState().exerciseLogs[0].calories_burned).toBe(500);
    });
  });

  describe('authenticated user', () => {
    it('does nothing when userId is undefined', async () => {
      useExerciseLogStore.setState({ exerciseLogs: [DB_LOG] });

      await act(async () => {
        await useExerciseLogStore.getState().updateExerciseLog('db-ex-1', { calories_burned: 999 }, undefined, false);
      });

      expect(useExerciseLogStore.getState().exerciseLogs[0].calories_burned).toBe(300);
    });

    it('updates the log in state on Supabase success', async () => {
      useExerciseLogStore.setState({ exerciseLogs: [DB_LOG] });
      mockUpdate.mockReturnValueOnce({
        eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
      });

      await act(async () => {
        await useExerciseLogStore.getState().updateExerciseLog('db-ex-1', { calories_burned: 500 }, 'user-1', false);
      });

      expect(useExerciseLogStore.getState().exerciseLogs[0].calories_burned).toBe(500);
    });

    it('does NOT include updated_at in the Supabase update payload', async () => {
      useExerciseLogStore.setState({ exerciseLogs: [DB_LOG] });
      let capturedPayload: any;
      mockUpdate.mockImplementationOnce((payload: any) => {
        capturedPayload = payload;
        return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      });

      await act(async () => {
        await useExerciseLogStore.getState().updateExerciseLog('db-ex-1', { calories_burned: 500 }, 'user-1', false);
      });

      expect(capturedPayload).not.toHaveProperty('updated_at');
    });

    it('throws on Supabase error', async () => {
      useExerciseLogStore.setState({ exerciseLogs: [DB_LOG] });
      mockUpdate.mockReturnValueOnce({
        eq: () => ({ eq: () => Promise.resolve({ error: { message: 'Update failed' } }) }),
      });

      await expect(
        useExerciseLogStore.getState().updateExerciseLog('db-ex-1', { calories_burned: 999 }, 'user-1', false)
      ).rejects.toEqual({ message: 'Update failed' });
    });
  });
});

describe('deleteExerciseLog', () => {
  describe('guest user', () => {
    it('removes the log from state', async () => {
      await act(async () => {
        await useExerciseLogStore.getState().addExerciseLog(MOCK_LOG, undefined, true);
      });
      const id = useExerciseLogStore.getState().exerciseLogs[0].id;

      await act(async () => {
        await useExerciseLogStore.getState().deleteExerciseLog(id, undefined, true);
      });

      expect(useExerciseLogStore.getState().exerciseLogs).toHaveLength(0);
    });
  });

  describe('authenticated user', () => {
    it('removes the log from state on success', async () => {
      useExerciseLogStore.setState({ exerciseLogs: [DB_LOG] });
      mockDelete.mockReturnValueOnce({
        eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
      });

      await act(async () => {
        await useExerciseLogStore.getState().deleteExerciseLog('db-ex-1', 'user-1', false);
      });

      expect(useExerciseLogStore.getState().exerciseLogs).toHaveLength(0);
    });

    it('throws on Supabase error', async () => {
      useExerciseLogStore.setState({ exerciseLogs: [DB_LOG] });
      mockDelete.mockReturnValueOnce({
        eq: () => ({ eq: () => Promise.resolve({ error: { message: 'Delete failed' } }) }),
      });

      await expect(
        useExerciseLogStore.getState().deleteExerciseLog('db-ex-1', 'user-1', false)
      ).rejects.toEqual({ message: 'Delete failed' });
    });
  });
});

describe('clearExerciseLogs', () => {
  it('empties the exerciseLogs array', async () => {
    await act(async () => {
      await useExerciseLogStore.getState().addExerciseLog(MOCK_LOG, undefined, true);
    });
    useExerciseLogStore.getState().clearExerciseLogs();
    expect(useExerciseLogStore.getState().exerciseLogs).toHaveLength(0);
  });
});
