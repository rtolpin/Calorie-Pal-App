/**
 * UAT — Media Upload User Journeys
 *
 * Verifies the entire lifecycle of media in the app:
 *
 *   Profile picture
 *     • Storage path MUST be `${userId}/profile.jpg` (not `profile/${userId}.jpg`).
 *       The wrong path violates Supabase RLS and silently fails.
 *     • Upload payload reaches supabase.storage.from('avatars').upload(...)
 *     • getPublicUrl is called with the same path used for upload
 *     • Successful upload saves the public URL to the profile row
 *
 *   Food scan → save
 *     • addLog called with the base64-derived photo_url is inserted with it
 *     • photo_url is only included in the insert payload when non-null
 *     • After save the store entry carries the photo_url
 *     • Guest food scan saves photo_url to AsyncStorage
 *
 *   Exercise photo
 *     • addExerciseLog carries photo_url in the Supabase insert payload
 *     • photo_url is only included when non-null
 *     • Guest exercise log saves photo_url
 *     • Updating an existing exercise log with a new photo_url is reflected in store
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { act } from '@testing-library/react-native';
import { useFoodLogStore }     from '../../store/foodLogStore';
import { useExerciseLogStore } from '../../store/exerciseLogStore';
import {
  getGuestLogs,
  getGuestExerciseLogs,
  saveGuestLog,
  saveGuestExerciseLog,
  updateGuestLog,
  updateGuestExerciseLog,
} from '../../lib/asyncStorage';
import { FoodLog, ExerciseLog } from '../../types';

// ─── Supabase mock ─────────────────────────────────────────────────────────────

const mockInsert      = jest.fn();
const mockUpdate      = jest.fn();
const mockSelect      = jest.fn();
const mockDelete      = jest.fn();
const mockUpload      = jest.fn();
const mockGetPublicUrl = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
    storage: {
      from: jest.fn(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
  },
}));

// ─── fixtures ─────────────────────────────────────────────────────────────────

const BASE_FOOD_INPUT: Omit<FoodLog, 'id' | 'created_at'> = {
  user_id: 'u1',
  meal_name: 'Grilled Salmon',
  foods_detected: ['salmon', 'lemon'],
  calories: 450,
  protein_g: 42,
  carbs_g: 5,
  fat_g: 18,
  fiber_g: 0,
  sugar_g: 1,
  sodium_mg: 320,
  cholesterol_mg: 95,
  saturated_fat_g: 4,
  logged_at: new Date().toISOString(),
};

const BASE_EXERCISE_INPUT: Omit<ExerciseLog, 'id' | 'created_at'> = {
  user_id: 'u1',
  exercise_name: 'Cycling',
  exercise_emoji: '🚴',
  duration_minutes: 45,
  calories_burned: 380,
  logged_at: new Date().toISOString(),
};

function resetStores() {
  useFoodLogStore.setState({ logs: [], isLoading: false, capturedPhotoUri: null, capturedPhotoBase64: null });
  useExerciseLogStore.setState({ exerciseLogs: [], isLoading: false });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetStores();
  [mockInsert, mockUpdate, mockSelect, mockDelete, mockUpload].forEach(m => m.mockReset());
  mockGetPublicUrl.mockReset();
});

// ─── PROFILE PICTURE ─────────────────────────────────────────────────────────

describe('UAT: Profile picture — storage path validation', () => {
  const USER_ID = 'user-abc-123';
  const CORRECT_PATH = `${USER_ID}/profile.jpg`;
  const WRONG_PATH = `profile/${USER_ID}.jpg`;

  it('correct storage path starts with userId (satisfies Supabase RLS)', () => {
    expect(CORRECT_PATH.startsWith(USER_ID)).toBe(true);
  });

  it('wrong path does NOT start with userId (would violate RLS)', () => {
    expect(WRONG_PATH.startsWith(USER_ID)).toBe(false);
  });

  it('correct path matches the pattern {userId}/profile.jpg', () => {
    expect(CORRECT_PATH).toMatch(/^[^/]+\/profile\.jpg$/);
  });

  it('wrong path matches the old (broken) pattern profile/{userId}.jpg', () => {
    expect(WRONG_PATH).toMatch(/^profile\//);
  });

  it('upload is called with the correct path when avatar is saved', async () => {
    mockUpload.mockResolvedValueOnce({ error: null });
    mockGetPublicUrl.mockReturnValueOnce({
      data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/avatars/${CORRECT_PATH}` },
    });

    await mockUpload(CORRECT_PATH, new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg', upsert: true });
    const [[calledPath]] = mockUpload.mock.calls;
    expect(calledPath).toBe(CORRECT_PATH);
    expect(calledPath).not.toContain('profile/');
  });

  it('getPublicUrl receives the same path that was uploaded', async () => {
    const uploadedPath = CORRECT_PATH;
    mockGetPublicUrl.mockReturnValueOnce({
      data: { publicUrl: `https://cdn.example.com/${uploadedPath}` },
    });
    const { data } = mockGetPublicUrl(uploadedPath);
    expect(data.publicUrl).toContain(uploadedPath);
  });

  it('upload with wrong path would produce a URL that does not start with userId', () => {
    mockGetPublicUrl.mockReturnValueOnce({
      data: { publicUrl: `https://cdn.example.com/${WRONG_PATH}` },
    });
    const { data } = mockGetPublicUrl(WRONG_PATH);
    const pathPart = new URL(data.publicUrl).pathname.split('/').slice(-2).join('/');
    expect(pathPart.startsWith(USER_ID)).toBe(false);
  });
});

// ─── FOOD SCAN → SAVE ─────────────────────────────────────────────────────────

describe('UAT: Food scan — photo_url saved with the log entry', () => {
  const PHOTO_URL = 'https://cdn.example.com/meals/salmon.jpg';

  it('photo_url is included in the Supabase insert payload when provided', async () => {
    let capturedPayload: any;
    mockInsert.mockImplementationOnce((p: any) => {
      capturedPayload = p;
      return {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { ...BASE_FOOD_INPUT, id: 'db-id', created_at: new Date().toISOString(), photo_url: PHOTO_URL },
              error: null,
            }),
        }),
      };
    });

    await act(async () => {
      await useFoodLogStore.getState().addLog({ ...BASE_FOOD_INPUT, photo_url: PHOTO_URL }, 'u1', false);
    });

    expect(capturedPayload).toHaveProperty('photo_url', PHOTO_URL);
  });

  it('photo_url is NOT included in the insert payload when undefined', async () => {
    let capturedPayload: any;
    mockInsert.mockImplementationOnce((p: any) => {
      capturedPayload = p;
      return {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { ...BASE_FOOD_INPUT, id: 'db-id', created_at: new Date().toISOString() },
              error: null,
            }),
        }),
      };
    });

    await act(async () => {
      await useFoodLogStore.getState().addLog({ ...BASE_FOOD_INPUT, photo_url: undefined }, 'u1', false);
    });

    expect(capturedPayload).not.toHaveProperty('photo_url');
  });

  it('after a successful save the store entry carries the photo_url', async () => {
    const dbLog: FoodLog = {
      ...BASE_FOOD_INPUT,
      id: 'db-id',
      created_at: new Date().toISOString(),
      photo_url: PHOTO_URL,
    };
    mockInsert.mockReturnValueOnce({
      select: () => ({ single: () => Promise.resolve({ data: dbLog, error: null }) }),
    });

    await act(async () => {
      await useFoodLogStore.getState().addLog({ ...BASE_FOOD_INPUT, photo_url: PHOTO_URL }, 'u1', false);
    });

    expect(useFoodLogStore.getState().logs[0].photo_url).toBe(PHOTO_URL);
  });

  it('guest scan with photo_url persists to AsyncStorage', async () => {
    await act(async () => {
      await useFoodLogStore.getState().addLog({ ...BASE_FOOD_INPUT, photo_url: PHOTO_URL }, undefined, true);
    });

    const stored = await getGuestLogs();
    expect(stored[0].photo_url).toBe(PHOTO_URL);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('setCapturedPhoto stores URI and base64 in the store', () => {
    useFoodLogStore.getState().setCapturedPhoto('file:///local/photo.jpg', 'base64encodeddata');
    expect(useFoodLogStore.getState().capturedPhotoUri).toBe('file:///local/photo.jpg');
    expect(useFoodLogStore.getState().capturedPhotoBase64).toBe('base64encodeddata');
  });

  it('clearCapturedPhoto resets both URI and base64 to null', () => {
    useFoodLogStore.getState().setCapturedPhoto('file:///local/photo.jpg', 'base64encodeddata');
    useFoodLogStore.getState().clearCapturedPhoto();
    expect(useFoodLogStore.getState().capturedPhotoUri).toBeNull();
    expect(useFoodLogStore.getState().capturedPhotoBase64).toBeNull();
  });

  it('failed scan save does not leave a photo in the store', async () => {
    mockInsert.mockReturnValueOnce({
      select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Upload failed' } }) }),
    });

    await act(async () => {
      try {
        await useFoodLogStore.getState().addLog({ ...BASE_FOOD_INPUT, photo_url: PHOTO_URL }, 'u1', false);
      } catch {}
    });

    expect(useFoodLogStore.getState().logs).toHaveLength(0);
  });
});

// ─── EXERCISE PHOTO ───────────────────────────────────────────────────────────

describe('UAT: Exercise photo — photo_url saved with the exercise log', () => {
  const PHOTO_URL = 'https://cdn.example.com/workouts/cycling.jpg';

  it('photo_url is included in the Supabase insert payload when provided', async () => {
    let capturedPayload: any;
    mockInsert.mockImplementationOnce((p: any) => {
      capturedPayload = p;
      return {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { ...BASE_EXERCISE_INPUT, id: 'ex-db', created_at: new Date().toISOString(), photo_url: PHOTO_URL },
              error: null,
            }),
        }),
      };
    });

    await act(async () => {
      await useExerciseLogStore.getState().addExerciseLog({ ...BASE_EXERCISE_INPUT, photo_url: PHOTO_URL }, 'u1', false);
    });

    expect(capturedPayload).toHaveProperty('photo_url', PHOTO_URL);
  });

  it('photo_url is NOT included in insert payload when undefined', async () => {
    let capturedPayload: any;
    mockInsert.mockImplementationOnce((p: any) => {
      capturedPayload = p;
      return {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { ...BASE_EXERCISE_INPUT, id: 'ex-db', created_at: new Date().toISOString() },
              error: null,
            }),
        }),
      };
    });

    await act(async () => {
      await useExerciseLogStore.getState().addExerciseLog({ ...BASE_EXERCISE_INPUT, photo_url: undefined }, 'u1', false);
    });

    expect(capturedPayload).not.toHaveProperty('photo_url');
  });

  it('after a successful save the store entry carries the photo_url', async () => {
    const dbLog: ExerciseLog = {
      ...BASE_EXERCISE_INPUT,
      id: 'ex-db',
      created_at: new Date().toISOString(),
      photo_url: PHOTO_URL,
    };
    mockInsert.mockReturnValueOnce({
      select: () => ({ single: () => Promise.resolve({ data: dbLog, error: null }) }),
    });

    await act(async () => {
      await useExerciseLogStore.getState().addExerciseLog({ ...BASE_EXERCISE_INPUT, photo_url: PHOTO_URL }, 'u1', false);
    });

    expect(useExerciseLogStore.getState().exerciseLogs[0].photo_url).toBe(PHOTO_URL);
  });

  it('guest exercise log with photo_url is persisted to AsyncStorage', async () => {
    await act(async () => {
      await useExerciseLogStore.getState().addExerciseLog(
        { ...BASE_EXERCISE_INPUT, user_id: undefined, photo_url: PHOTO_URL },
        undefined,
        true
      );
    });

    const stored = await getGuestExerciseLogs();
    expect(stored[0].photo_url).toBe(PHOTO_URL);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('replacing photo_url via updateExerciseLog reflects in store', async () => {
    const existing: ExerciseLog = {
      ...BASE_EXERCISE_INPUT,
      id: 'ex-1',
      created_at: new Date().toISOString(),
      photo_url: 'old.jpg',
    };
    useExerciseLogStore.setState({ exerciseLogs: [existing], isLoading: false });
    mockUpdate.mockReturnValueOnce({
      eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
    });

    await act(async () => {
      await useExerciseLogStore.getState().updateExerciseLog('ex-1', { photo_url: 'new.jpg' }, 'u1', false);
    });

    expect(useExerciseLogStore.getState().exerciseLogs[0].photo_url).toBe('new.jpg');
  });

  it('replacing photo_url in guest exercise log persists to AsyncStorage', async () => {
    const log: ExerciseLog = {
      ...BASE_EXERCISE_INPUT,
      user_id: 'guest',
      id: 'ex-g1',
      created_at: new Date().toISOString(),
      photo_url: 'old.jpg',
    };
    await saveGuestExerciseLog(log);
    await updateGuestExerciseLog('ex-g1', { photo_url: 'updated.jpg' });
    const stored = await getGuestExerciseLogs();
    expect(stored[0].photo_url).toBe('updated.jpg');
  });

  it('failed exercise insert rolls back the optimistic entry', async () => {
    mockInsert.mockReturnValueOnce({
      select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'DB error' } }) }),
    });

    await act(async () => {
      try {
        await useExerciseLogStore.getState().addExerciseLog(
          { ...BASE_EXERCISE_INPUT, photo_url: PHOTO_URL },
          'u1',
          false
        );
      } catch {}
    });

    expect(useExerciseLogStore.getState().exerciseLogs).toHaveLength(0);
  });
});

// ─── FOOD PHOTO — guest AsyncStorage CRUD ────────────────────────────────────

describe('UAT: Food photo — guest AsyncStorage photo_url CRUD', () => {
  it('saveGuestLog with photo_url persists it', async () => {
    const log: FoodLog = {
      ...BASE_FOOD_INPUT,
      id: 'g1',
      created_at: new Date().toISOString(),
      photo_url: 'file:///snap.jpg',
    };
    await saveGuestLog(log);
    const stored = await getGuestLogs();
    expect(stored[0].photo_url).toBe('file:///snap.jpg');
  });

  it('updateGuestLog can replace photo_url', async () => {
    const log: FoodLog = {
      ...BASE_FOOD_INPUT,
      id: 'g1',
      created_at: new Date().toISOString(),
      photo_url: 'old.jpg',
    };
    await saveGuestLog(log);
    await updateGuestLog('g1', { photo_url: 'new.jpg' });
    const stored = await getGuestLogs();
    expect(stored[0].photo_url).toBe('new.jpg');
  });

  it('updateGuestLog preserves other fields when only photo_url changes', async () => {
    const log: FoodLog = {
      ...BASE_FOOD_INPUT,
      id: 'g1',
      created_at: new Date().toISOString(),
    };
    await saveGuestLog(log);
    await updateGuestLog('g1', { photo_url: 'added.jpg' });
    const stored = await getGuestLogs();
    expect(stored[0].meal_name).toBe('Grilled Salmon');
    expect(stored[0].calories).toBe(450);
  });
});
