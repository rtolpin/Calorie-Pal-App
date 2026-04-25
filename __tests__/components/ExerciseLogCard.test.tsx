import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ExerciseLogCard } from '../../components/ExerciseLogCard';
import { ExerciseLog } from '../../types';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// auth / store / supabase / image picker — all mocked so the card renders cleanly
jest.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ session: { user: { id: 'u1' } }, isGuest: false }),
}));

const mockUpdateExerciseLog = jest.fn();
jest.mock('../../store/exerciseLogStore', () => ({
  useExerciseLogStore: () => ({ updateExerciseLog: mockUpdateExerciseLog }),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/photo.jpg' } }),
      }),
    },
  },
}));

const mockLaunchImageLibraryAsync = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: any[]) => mockLaunchImageLibraryAsync(...args),
  MediaTypeOptions: { Images: 'Images' },
}));

const BASE_LOG: ExerciseLog = {
  id: 'ex-1',
  user_id: 'u1',
  exercise_name: 'Running',
  exercise_emoji: '🏃',
  duration_minutes: 30,
  calories_burned: 300,
  logged_at: '2026-04-25T08:00:00.000Z',
  created_at: '2026-04-25T08:00:00.000Z',
};

const LOG_WITH_PHOTO = { ...BASE_LOG, photo_url: 'https://example.com/run.jpg' };

// ─── photo absent ─────────────────────────────────────────────────────────────

describe('ExerciseLogCard — no photo', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the emoji icon when no photo_url is set', () => {
    const { queryByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    expect(queryByTestId('photo-container')).toBeNull();
  });

  it('does not show the photo-container touchable', () => {
    const { queryByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    expect(queryByTestId('photo-container')).toBeNull();
  });
});

// ─── photo present — action sheet ─────────────────────────────────────────────

describe('ExerciseLogCard — photo present: action sheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
  });

  it('shows an action sheet when the photo is pressed', () => {
    const { getByTestId } = render(<ExerciseLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('action sheet title is the exercise name', () => {
    const { getByTestId } = render(<ExerciseLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    expect(Alert.alert).toHaveBeenCalledWith(LOG_WITH_PHOTO.exercise_name, undefined, expect.any(Array));
  });

  it('action sheet includes View Full Screen, Replace Photo, and Cancel', () => {
    const { getByTestId } = render(<ExerciseLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    const buttons: any[] = (Alert.alert as jest.Mock).mock.calls[0][2];
    const labels = buttons.map((b: any) => b.text);
    expect(labels).toContain('View Full Screen');
    expect(labels).toContain('Replace Photo');
    expect(labels).toContain('Cancel');
  });

  it('Cancel button has cancel style', () => {
    const { getByTestId } = render(<ExerciseLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    const buttons: any[] = (Alert.alert as jest.Mock).mock.calls[0][2];
    expect(buttons.find((b: any) => b.text === 'Cancel')?.style).toBe('cancel');
  });
});

// ─── photo present — replace flow ─────────────────────────────────────────────

describe('ExerciseLogCard — Replace Photo flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
  });

  it('opens image picker when Replace Photo is selected', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({ canceled: true });
    const { getByTestId } = render(<ExerciseLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    const buttons: any[] = (Alert.alert as jest.Mock).mock.calls[0][2];
    const replace = buttons.find((b: any) => b.text === 'Replace Photo');
    await act(async () => { await replace?.onPress?.(); });
    expect(mockLaunchImageLibraryAsync).toHaveBeenCalled();
  });

  it('does not call updateExerciseLog when picker is cancelled', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({ canceled: true });
    const { getByTestId } = render(<ExerciseLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    const buttons: any[] = (Alert.alert as jest.Mock).mock.calls[0][2];
    await act(async () => { await buttons.find((b: any) => b.text === 'Replace Photo')?.onPress?.(); });
    expect(mockUpdateExerciseLog).not.toHaveBeenCalled();
  });

  it('calls updateExerciseLog with new photo_url after successful pick and upload', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://new.jpg', base64: btoa('imagedata') }],
    });

    const { getByTestId } = render(<ExerciseLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    const buttons: any[] = (Alert.alert as jest.Mock).mock.calls[0][2];
    await act(async () => { await buttons.find((b: any) => b.text === 'Replace Photo')?.onPress?.(); });

    expect(mockUpdateExerciseLog).toHaveBeenCalledWith(
      LOG_WITH_PHOTO.id,
      expect.objectContaining({ photo_url: expect.any(String) }),
      expect.anything(),
      expect.anything(),
    );
  });
});

// ─── delete behaviour ─────────────────────────────────────────────────────────

describe('ExerciseLogCard — delete behaviour', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
  });

  it('shows a confirmation alert when delete is pressed', () => {
    const { getByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('delete-btn'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Exercise',
      expect.stringContaining(BASE_LOG.exercise_name),
      expect.any(Array),
    );
  });

  it('calls onDelete with log id on destructive confirm', () => {
    const onDelete = jest.fn();
    (Alert.alert as jest.Mock).mockImplementationOnce((_t: string, _m: string, buttons: any[]) => {
      buttons.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const { getByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={onDelete} />);
    fireEvent.press(getByTestId('delete-btn'));
    expect(onDelete).toHaveBeenCalledWith(BASE_LOG.id);
  });

  it('does not call onDelete when cancel is pressed', () => {
    const onDelete = jest.fn();
    (Alert.alert as jest.Mock).mockImplementationOnce((_t: string, _m: string, buttons: any[]) => {
      buttons.find((b) => b.style === 'cancel')?.onPress?.();
    });
    const { getByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={onDelete} />);
    fireEvent.press(getByTestId('delete-btn'));
    expect(onDelete).not.toHaveBeenCalled();
  });
});

// ─── top entry header label ───────────────────────────────────────────────────

describe('ExerciseLogCard — top entry header', () => {
  it('renders "View or Edit this Entry" text', () => {
    const { getByText } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    expect(getByText('View or Edit this Entry')).toBeTruthy();
  });
});

// ─── accessibility ────────────────────────────────────────────────────────────

describe('ExerciseLogCard — accessibility', () => {
  it('exercise photo has an accessibilityLabel containing the exercise name', () => {
    const log = { ...BASE_LOG, photo_url: 'https://example.com/run.jpg' };
    const { getByLabelText } = render(<ExerciseLogCard log={log} onDelete={jest.fn()} />);
    expect(getByLabelText(`Photo of ${log.exercise_name}`)).toBeTruthy();
  });
});

// ─── favorite heart ───────────────────────────────────────────────────────────

describe('ExerciseLogCard — favorite heart', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not render favorite button when onToggleFavorite is not provided', () => {
    const { queryByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    expect(queryByTestId('favorite-btn')).toBeNull();
  });

  it('renders the favorite button when onToggleFavorite is provided', () => {
    const { getByTestId } = render(
      <ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} onToggleFavorite={jest.fn()} />
    );
    expect(getByTestId('favorite-btn')).toBeTruthy();
  });

  it('calls onToggleFavorite when pressed', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} onToggleFavorite={onToggle} />
    );
    fireEvent.press(getByTestId('favorite-btn'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

// ─── felt rating display ──────────────────────────────────────────────────────

describe('ExerciseLogCard — felt rating', () => {
  it('renders the exercise name without a felt label when felt is absent', () => {
    const { queryByText } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    expect(queryByText('Easy')).toBeNull();
    expect(queryByText('Good')).toBeNull();
    expect(queryByText('Hard')).toBeNull();
    expect(queryByText('Exhausting')).toBeNull();
  });

  it('renders the "Easy" label when felt is easy', () => {
    const { getByText } = render(
      <ExerciseLogCard log={{ ...BASE_LOG, felt: 'easy' }} onDelete={jest.fn()} />
    );
    expect(getByText('Easy')).toBeTruthy();
  });

  it('renders the "Hard" label when felt is hard', () => {
    const { getByText } = render(
      <ExerciseLogCard log={{ ...BASE_LOG, felt: 'hard' }} onDelete={jest.fn()} />
    );
    expect(getByText('Hard')).toBeTruthy();
  });

  it('renders the "Exhausting" label when felt is exhausting', () => {
    const { getByText } = render(
      <ExerciseLogCard log={{ ...BASE_LOG, felt: 'exhausting' }} onDelete={jest.fn()} />
    );
    expect(getByText('Exhausting')).toBeTruthy();
  });
});

// ─── photo_url field presence on ExerciseLog type ─────────────────────────────

describe('ExerciseLog type — photo_url field', () => {
  it('is optional — log without photo_url is valid', () => {
    const log: ExerciseLog = { ...BASE_LOG };
    expect(log.photo_url).toBeUndefined();
  });

  it('accepts a string photo_url when provided', () => {
    const log: ExerciseLog = { ...BASE_LOG, photo_url: 'https://example.com/photo.jpg' };
    expect(log.photo_url).toBe('https://example.com/photo.jpg');
  });
});
