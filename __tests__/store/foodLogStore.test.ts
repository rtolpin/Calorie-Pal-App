import { act } from '@testing-library/react-native';
import { useFoodLogStore } from '../../store/foodLogStore';
import { FoodLog } from '../../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Supabase mock
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockSingle = jest.fn();

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

const MOCK_LOG: Omit<FoodLog, 'id' | 'created_at'> = {
  user_id: 'user-1',
  meal_name: 'Grilled Chicken',
  foods_detected: ['chicken', 'salad'],
  calories: 450,
  protein_g: 40,
  carbs_g: 15,
  fat_g: 18,
  fiber_g: 3,
  sugar_g: 2,
  sodium_mg: 600,
  cholesterol_mg: 90,
  saturated_fat_g: 4,
  logged_at: new Date().toISOString(),
};

const DB_LOG: FoodLog = {
  ...MOCK_LOG,
  id: 'db-id-1',
  user_id: 'user-1',
  created_at: new Date().toISOString(),
};

function resetStore() {
  useFoodLogStore.setState({
    logs: [],
    isLoading: false,
    capturedPhotoUri: null,
    capturedPhotoBase64: null,
  });
}

beforeEach(() => {
  resetStore();
  // mockReset clears both call records AND mockReturnValueOnce queues so
  // unused queued values from one test don't bleed into the next.
  mockSelect.mockReset();
  mockInsert.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();
});

describe('fetchLogs', () => {
  describe('guest user', () => {
    it('loads logs from AsyncStorage', async () => {
      // Pre-populate via addLog in guest mode first
      await act(async () => {
        await useFoodLogStore.getState().addLog(MOCK_LOG, undefined, true);
      });
      resetStore();

      await act(async () => {
        await useFoodLogStore.getState().fetchLogs(undefined, true);
      });

      expect(useFoodLogStore.getState().logs.length).toBeGreaterThan(0);
    });

    it('sets isLoading to false after fetching', async () => {
      await act(async () => {
        await useFoodLogStore.getState().fetchLogs(undefined, true);
      });
      expect(useFoodLogStore.getState().isLoading).toBe(false);
    });
  });

  describe('authenticated user', () => {
    it('sets isLoading to false when no userId provided', async () => {
      await act(async () => {
        await useFoodLogStore.getState().fetchLogs(undefined, false);
      });
      expect(useFoodLogStore.getState().isLoading).toBe(false);
    });

    it('loads logs from Supabase on success', async () => {
      mockSelect.mockReturnValueOnce({
        eq: () => ({ order: () => Promise.resolve({ data: [DB_LOG], error: null }) }),
      });

      await act(async () => {
        await useFoodLogStore.getState().fetchLogs('user-1', false);
      });

      expect(useFoodLogStore.getState().logs).toEqual([DB_LOG]);
      expect(useFoodLogStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading to false on Supabase error', async () => {
      mockSelect.mockReturnValueOnce({
        eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'DB error' } }) }),
      });

      await act(async () => {
        await useFoodLogStore.getState().fetchLogs('user-1', false);
      });

      expect(useFoodLogStore.getState().isLoading).toBe(false);
      expect(useFoodLogStore.getState().logs).toEqual([]);
    });

    it('sets isLoading to false when an unexpected error is thrown', async () => {
      mockSelect.mockReturnValueOnce({
        eq: () => ({ order: () => Promise.reject(new Error('Network error')) }),
      });

      await act(async () => {
        await useFoodLogStore.getState().fetchLogs('user-1', false);
      });

      expect(useFoodLogStore.getState().isLoading).toBe(false);
    });
  });
});

describe('addLog', () => {
  describe('guest user', () => {
    it('adds log to state immediately', async () => {
      await act(async () => {
        await useFoodLogStore.getState().addLog(MOCK_LOG, undefined, true);
      });
      expect(useFoodLogStore.getState().logs).toHaveLength(1);
      expect(useFoodLogStore.getState().logs[0].meal_name).toBe('Grilled Chicken');
    });

    it('prepends new logs (most recent first)', async () => {
      const log2 = { ...MOCK_LOG, meal_name: 'Salad' };
      await act(async () => {
        await useFoodLogStore.getState().addLog(MOCK_LOG, undefined, true);
        await useFoodLogStore.getState().addLog(log2, undefined, true);
      });
      expect(useFoodLogStore.getState().logs[0].meal_name).toBe('Salad');
    });

    it('assigns a generated id', async () => {
      await act(async () => {
        await useFoodLogStore.getState().addLog(MOCK_LOG, undefined, true);
      });
      const log = useFoodLogStore.getState().logs[0];
      expect(log.id).toBeDefined();
      expect(log.id.startsWith('guest_')).toBe(true);
    });
  });

  describe('authenticated user', () => {
    it('does nothing when userId is undefined', async () => {
      await act(async () => {
        await useFoodLogStore.getState().addLog(MOCK_LOG, undefined, false);
      });
      expect(useFoodLogStore.getState().logs).toHaveLength(0);
    });

    it('optimistically adds log before Supabase confirms', async () => {
      let resolveInsert!: (val: any) => void;
      const insertPromise = new Promise((res) => { resolveInsert = res; });

      mockInsert.mockReturnValueOnce({ select: () => ({ single: () => insertPromise }) });

      const addPromise = useFoodLogStore.getState().addLog(MOCK_LOG, 'user-1', false);
      // Log should appear immediately before insert resolves
      expect(useFoodLogStore.getState().logs).toHaveLength(1);

      resolveInsert({ data: DB_LOG, error: null });
      await act(async () => { await addPromise; });
    });

    it('replaces optimistic log with DB record on success', async () => {
      mockInsert.mockReturnValueOnce({
        select: () => ({ single: () => Promise.resolve({ data: DB_LOG, error: null }) }),
      });

      await act(async () => {
        await useFoodLogStore.getState().addLog(MOCK_LOG, 'user-1', false);
      });

      const log = useFoodLogStore.getState().logs[0];
      expect(log.id).toBe('db-id-1');
    });

    it('rolls back optimistic log on Supabase error', async () => {
      mockInsert.mockReturnValueOnce({
        select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Insert failed' } }) }),
      });

      await act(async () => {
        try {
          await useFoodLogStore.getState().addLog(MOCK_LOG, 'user-1', false);
        } catch {}
      });

      expect(useFoodLogStore.getState().logs).toHaveLength(0);
    });
  });
});

describe('updateLog', () => {
  describe('guest user', () => {
    it('updates a log in state', async () => {
      await act(async () => {
        await useFoodLogStore.getState().addLog(MOCK_LOG, undefined, true);
      });
      const id = useFoodLogStore.getState().logs[0].id;

      await act(async () => {
        await useFoodLogStore.getState().updateLog(id, { calories: 999 }, undefined, true);
      });

      expect(useFoodLogStore.getState().logs[0].calories).toBe(999);
    });
  });

  describe('authenticated user', () => {
    it('does nothing when userId is undefined', async () => {
      useFoodLogStore.setState({ logs: [DB_LOG] });

      await act(async () => {
        await useFoodLogStore.getState().updateLog('db-id-1', { calories: 999 }, undefined, false);
      });

      expect(useFoodLogStore.getState().logs[0].calories).toBe(450); // unchanged
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('updates the log in state on success', async () => {
      useFoodLogStore.setState({ logs: [DB_LOG] });
      mockUpdate.mockReturnValueOnce({
        eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
      });

      await act(async () => {
        await useFoodLogStore.getState().updateLog('db-id-1', { calories: 999 }, 'user-1', false);
      });

      expect(useFoodLogStore.getState().logs[0].calories).toBe(999);
    });

    it('throws on Supabase error', async () => {
      useFoodLogStore.setState({ logs: [DB_LOG] });
      mockUpdate.mockReturnValueOnce({
        eq: () => ({ eq: () => Promise.resolve({ error: { message: 'Update failed' } }) }),
      });

      await expect(
        useFoodLogStore.getState().updateLog('db-id-1', { calories: 999 }, 'user-1', false)
      ).rejects.toEqual({ message: 'Update failed' });
    });
  });
});

describe('deleteLog', () => {
  describe('guest user', () => {
    it('removes the log from state', async () => {
      await act(async () => {
        await useFoodLogStore.getState().addLog(MOCK_LOG, undefined, true);
      });
      const id = useFoodLogStore.getState().logs[0].id;

      await act(async () => {
        await useFoodLogStore.getState().deleteLog(id, undefined, true);
      });

      expect(useFoodLogStore.getState().logs).toHaveLength(0);
    });
  });

  describe('authenticated user', () => {
    it('removes the log from state on success', async () => {
      useFoodLogStore.setState({ logs: [DB_LOG] });
      mockDelete.mockReturnValueOnce({
        eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
      });

      await act(async () => {
        await useFoodLogStore.getState().deleteLog('db-id-1', 'user-1', false);
      });

      expect(useFoodLogStore.getState().logs).toHaveLength(0);
    });

    it('throws on Supabase error', async () => {
      useFoodLogStore.setState({ logs: [DB_LOG] });
      mockDelete.mockReturnValueOnce({
        eq: () => ({ eq: () => Promise.resolve({ error: { message: 'Delete failed' } }) }),
      });

      await expect(
        useFoodLogStore.getState().deleteLog('db-id-1', 'user-1', false)
      ).rejects.toEqual({ message: 'Delete failed' });
    });
  });
});

describe('setCapturedPhoto / clearCapturedPhoto', () => {
  it('stores the photo uri and base64', () => {
    useFoodLogStore.getState().setCapturedPhoto('file://photo.jpg', 'base64abc');
    expect(useFoodLogStore.getState().capturedPhotoUri).toBe('file://photo.jpg');
    expect(useFoodLogStore.getState().capturedPhotoBase64).toBe('base64abc');
  });

  it('clears the photo', () => {
    useFoodLogStore.getState().setCapturedPhoto('file://photo.jpg', 'base64abc');
    useFoodLogStore.getState().clearCapturedPhoto();
    expect(useFoodLogStore.getState().capturedPhotoUri).toBeNull();
    expect(useFoodLogStore.getState().capturedPhotoBase64).toBeNull();
  });
});

describe('clearLogs', () => {
  it('empties the logs array', async () => {
    await act(async () => {
      await useFoodLogStore.getState().addLog(MOCK_LOG, undefined, true);
    });
    useFoodLogStore.getState().clearLogs();
    expect(useFoodLogStore.getState().logs).toHaveLength(0);
  });
});
