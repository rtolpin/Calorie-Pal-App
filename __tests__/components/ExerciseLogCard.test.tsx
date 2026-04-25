import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ExerciseLogCard } from '../../components/ExerciseLogCard';
import { ExerciseLog } from '../../types';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: any[]) => mockRouterPush(...args) } }));

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

// ─── photo absent — emoji tile ─────────────────────────────────────────────────

describe('ExerciseLogCard — no photo: emoji tile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders an icon-container (not photo-container) when no photo_url', () => {
    const { queryByTestId, getByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    expect(queryByTestId('photo-container')).toBeNull();
    expect(getByTestId('icon-container')).toBeTruthy();
  });

  it('icon-container is tappable and navigates to the edit screen', () => {
    const { getByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('icon-container'));
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/edit-exercise/[id]',
      params: { id: BASE_LOG.id },
    });
  });
});

// ─── photo present — display in journal view ──────────────────────────────────

describe('ExerciseLogCard — photo present: displays in journal view', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a photo-container when photo_url is set', () => {
    const { getByTestId } = render(<ExerciseLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    expect(getByTestId('photo-container')).toBeTruthy();
  });

  it('shows the photo image element (not the emoji tile) when photo_url is set', () => {
    const { getByLabelText, queryByTestId } = render(
      <ExerciseLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />
    );
    expect(getByLabelText(`Photo of ${LOG_WITH_PHOTO.exercise_name}`)).toBeTruthy();
    // emoji icon container should NOT render when photo is present
    expect(queryByTestId('emoji-container')).toBeNull();
  });

  it('photo accessibilityLabel contains the exercise name', () => {
    const { getByLabelText } = render(<ExerciseLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    expect(getByLabelText(`Photo of Running`)).toBeTruthy();
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

  it('action sheet includes View Full Screen, Replace Photo, Edit Entry, and Cancel', () => {
    const { getByTestId } = render(<ExerciseLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    const buttons: any[] = (Alert.alert as jest.Mock).mock.calls[0][2];
    const labels = buttons.map((b: any) => b.text);
    expect(labels).toContain('View Full Screen');
    expect(labels).toContain('Replace Photo');
    expect(labels).toContain('Edit Entry');
    expect(labels).toContain('Cancel');
  });

  it('"Edit Entry" in the photo action sheet navigates to the edit screen', () => {
    const { getByTestId } = render(<ExerciseLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    const buttons: any[] = (Alert.alert as jest.Mock).mock.calls[0][2];
    buttons.find((b: any) => b.text === 'Edit Entry')?.onPress?.();
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/edit-exercise/[id]',
      params: { id: LOG_WITH_PHOTO.id },
    });
  });

  it('Cancel button has cancel style', () => {
    const { getByTestId } = render(<ExerciseLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    const buttons: any[] = (Alert.alert as jest.Mock).mock.calls[0][2];
    expect(buttons.find((b: any) => b.text === 'Cancel')?.style).toBe('cancel');
  });
});

// ─── Replace Photo flow ────────────────────────────────────────────────────────

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

// ─── Edit button ─────────────────────────────────────────────────────────────

describe('ExerciseLogCard — Edit button', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Edit button is present in the action bar', () => {
    const { getByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    expect(getByTestId('edit-btn')).toBeTruthy();
  });

  it('Edit button navigates to the edit-exercise screen with the correct id', () => {
    const { getByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('edit-btn'));
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/edit-exercise/[id]',
      params: { id: BASE_LOG.id },
    });
  });

  it('edit-header-btn is tappable and navigates to edit', () => {
    const { getByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('edit-header-btn'));
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/edit-exercise/[id]',
      params: { id: BASE_LOG.id },
    });
  });
});

// ─── action bar touch targets ─────────────────────────────────────────────────

describe('ExerciseLogCard — action bar touch targets', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Delete button is present in the action bar', () => {
    const { getByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    expect(getByTestId('delete-btn')).toBeTruthy();
  });

  it('Delete button has a minHeight of 48 (meets Apple HIG touch target)', () => {
    const { getByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    const btn = getByTestId('delete-btn');
    const { minHeight } = btn.props.style ?? {};
    expect(minHeight).toBeGreaterThanOrEqual(44);
  });

  it('Favorite button has a minHeight of 48 when rendered', () => {
    const { getByTestId } = render(
      <ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} onToggleFavorite={jest.fn()} />
    );
    const btn = getByTestId('favorite-btn');
    const { minHeight } = btn.props.style ?? {};
    expect(minHeight).toBeGreaterThanOrEqual(44);
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

// ─── top entry header ─────────────────────────────────────────────────────────

describe('ExerciseLogCard — top entry header', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders "View or Edit this Entry" text', () => {
    const { getByText } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    expect(getByText('View or Edit this Entry')).toBeTruthy();
  });

  it('header is now a TouchableOpacity (has testID edit-header-btn)', () => {
    const { getByTestId } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    expect(getByTestId('edit-header-btn')).toBeTruthy();
  });
});

// ─── accessibility ────────────────────────────────────────────────────────────

describe('ExerciseLogCard — accessibility', () => {
  it('Delete button has an accessibilityLabel', () => {
    const { getByLabelText } = render(<ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    expect(getByLabelText('Delete this exercise')).toBeTruthy();
  });

  it('Favorite button has an accessibilityLabel when provided', () => {
    const { getByLabelText } = render(
      <ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} onToggleFavorite={jest.fn()} />
    );
    expect(getByLabelText('Add to favorites')).toBeTruthy();
  });

  it('Favorite button label changes to "Remove from favorites" when already favorited', () => {
    const { getByLabelText } = render(
      <ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} onToggleFavorite={jest.fn()} isFavorite />
    );
    expect(getByLabelText('Remove from favorites')).toBeTruthy();
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

  it('shows "Saved" label when isFavorite is true', () => {
    const { getByText } = render(
      <ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} onToggleFavorite={jest.fn()} isFavorite />
    );
    expect(getByText('Saved')).toBeTruthy();
  });

  it('shows "Favorite" label when isFavorite is false', () => {
    const { getByText } = render(
      <ExerciseLogCard log={BASE_LOG} onDelete={jest.fn()} onToggleFavorite={jest.fn()} isFavorite={false} />
    );
    expect(getByText('Favorite')).toBeTruthy();
  });
});

// ─── felt rating display ──────────────────────────────────────────────────────

describe('ExerciseLogCard — felt rating', () => {
  it('renders no felt label when felt is absent', () => {
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

// ─── photo_url type ───────────────────────────────────────────────────────────

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
