import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { FoodLogCard } from '../../components/FoodLogCard';
import { FoodLog } from '../../types';

// jest.mock is hoisted above imports, so the factory must not reference outer variables.
// Retrieve the mock functions via jest.requireMock() inside tests instead.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('../../components/ui/MacroBadge', () => ({ MacroRow: () => null }));

const BASE_LOG: FoodLog = {
  id: 'log-1',
  user_id: 'user-1',
  meal_name: 'Grilled Chicken',
  foods_detected: ['chicken'],
  calories: 300,
  protein_g: 30,
  carbs_g: 10,
  fat_g: 8,
  fiber_g: 2,
  sugar_g: 1,
  sodium_mg: 400,
  cholesterol_mg: 70,
  saturated_fat_g: 2,
  logged_at: '2026-04-25T12:00:00.000Z',
  created_at: '2026-04-25T12:00:00.000Z',
};

function getRouterPush() {
  return jest.requireMock('expo-router').router.push as jest.Mock;
}

describe('FoodLogCard — photo press: no photo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
  });

  it('navigates directly to the edit screen when photo_url is absent', () => {
    const { getByTestId } = render(<FoodLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    expect(getRouterPush()).toHaveBeenCalledWith({
      pathname: '/edit-entry/[id]',
      params: { id: BASE_LOG.id },
    });
  });

  it('does not show an action sheet when photo_url is absent', () => {
    const { getByTestId } = render(<FoodLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('FoodLogCard — photo press: with photo', () => {
  const LOG_WITH_PHOTO = { ...BASE_LOG, photo_url: 'https://example.com/photo.jpg' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
  });

  it('shows an action sheet instead of navigating when photo_url is present', () => {
    const { getByTestId } = render(<FoodLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    expect(Alert.alert).toHaveBeenCalled();
    expect(getRouterPush()).not.toHaveBeenCalled();
  });

  it('action sheet title is the meal name', () => {
    const { getByTestId } = render(<FoodLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    expect(Alert.alert).toHaveBeenCalledWith(LOG_WITH_PHOTO.meal_name, undefined, expect.any(Array));
  });

  it('action sheet includes View Full Screen, Replace Photo, and Cancel options', () => {
    const { getByTestId } = render(<FoodLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    const buttons: any[] = (Alert.alert as jest.Mock).mock.calls[0][2];
    const labels = buttons.map((b) => b.text);
    expect(labels).toContain('View Full Screen');
    expect(labels).toContain('Replace Photo');
    expect(labels).toContain('Cancel');
  });

  it('Cancel button has destructive cancel style', () => {
    const { getByTestId } = render(<FoodLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    const buttons: any[] = (Alert.alert as jest.Mock).mock.calls[0][2];
    const cancel = buttons.find((b) => b.text === 'Cancel');
    expect(cancel?.style).toBe('cancel');
  });

  it('Replace Photo navigates to the edit screen', () => {
    const { getByTestId } = render(<FoodLogCard log={LOG_WITH_PHOTO} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('photo-container'));
    const buttons: any[] = (Alert.alert as jest.Mock).mock.calls[0][2];
    const replace = buttons.find((b) => b.text === 'Replace Photo');
    replace?.onPress?.();
    expect(getRouterPush()).toHaveBeenCalledWith({
      pathname: '/edit-entry/[id]',
      params: { id: LOG_WITH_PHOTO.id },
    });
  });
});

describe('FoodLogCard — delete behaviour', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
  });

  it('shows a confirmation alert when the delete button is pressed', () => {
    const { getByTestId } = render(<FoodLogCard log={BASE_LOG} onDelete={jest.fn()} />);
    fireEvent.press(getByTestId('delete-btn'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Entry',
      expect.stringContaining(BASE_LOG.meal_name),
      expect.any(Array)
    );
  });

  it('calls onDelete with the log id when the destructive button is confirmed', () => {
    const onDelete = jest.fn();
    (Alert.alert as jest.Mock).mockImplementationOnce((_title: string, _msg: string, buttons: any[]) => {
      const destructive = buttons.find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });

    const { getByTestId } = render(<FoodLogCard log={BASE_LOG} onDelete={onDelete} />);
    fireEvent.press(getByTestId('delete-btn'));
    expect(onDelete).toHaveBeenCalledWith(BASE_LOG.id);
  });

  it('does not call onDelete when cancel is pressed', () => {
    const onDelete = jest.fn();
    (Alert.alert as jest.Mock).mockImplementationOnce((_title: string, _msg: string, buttons: any[]) => {
      const cancel = buttons.find((b) => b.style === 'cancel');
      cancel?.onPress?.();
    });

    const { getByTestId } = render(<FoodLogCard log={BASE_LOG} onDelete={onDelete} />);
    fireEvent.press(getByTestId('delete-btn'));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
