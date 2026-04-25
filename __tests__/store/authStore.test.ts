import { act } from '@testing-library/react-native';
import { useAuthStore } from '../../store/authStore';

// Mock Supabase
const mockGetSession = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChange = jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
const mockSupabaseFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signInWithPassword: (creds: any) => mockSignInWithPassword(creds),
      signUp: (creds: any) => mockSignUp(creds),
      signOut: () => mockSignOut(),
      onAuthStateChange: (cb: any) => mockOnAuthStateChange(cb),
    },
    from: (table: string) => mockSupabaseFrom(table),
  },
}));

const MOCK_SESSION = {
  user: { id: 'user-1', email: 'test@example.com' },
  access_token: 'token-123',
};

const MOCK_PROFILE = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  daily_calorie_target: 1800,
  protein_target_pct: 30,
  carbs_target_pct: 40,
  fat_target_pct: 30,
  notification_enabled: true,
  notification_time: '19:00',
  created_at: new Date().toISOString(),
};

function resetStore() {
  useAuthStore.setState({
    session: null,
    profile: null,
    isGuest: false,
    isLoading: true,
    initialized: false,
  });
}

beforeEach(() => {
  resetStore();
  jest.clearAllMocks();
});

describe('signIn', () => {
  it('calls supabase signInWithPassword with correct credentials', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    await act(async () => {
      await useAuthStore.getState().signIn('test@example.com', 'password123');
    });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('sets isLoading to false after success', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    await act(async () => {
      await useAuthStore.getState().signIn('test@example.com', 'password123');
    });
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('sets isLoading to false after failure', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid credentials' } });
    await act(async () => {
      try {
        await useAuthStore.getState().signIn('test@example.com', 'wrongpassword');
      } catch {}
    });
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('throws on invalid credentials', async () => {
    const error = { message: 'Invalid login credentials' };
    mockSignInWithPassword.mockResolvedValueOnce({ error });
    await expect(useAuthStore.getState().signIn('bad@email.com', 'wrong')).rejects.toEqual(error);
  });

  it('sets isLoading to false even when signInWithPassword throws unexpectedly', async () => {
    mockSignInWithPassword.mockRejectedValueOnce(new Error('Network error'));
    await act(async () => {
      try {
        await useAuthStore.getState().signIn('test@example.com', 'password');
      } catch {}
    });
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

describe('signUp', () => {
  it('calls signUp then immediately signIn', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });

    await act(async () => {
      await useAuthStore.getState().signUp('new@example.com', 'password123');
    });

    expect(mockSignUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'password123' });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'new@example.com', password: 'password123' });
  });

  it('throws and resets isLoading when signUp returns an error', async () => {
    const error = { message: 'Email already registered' };
    mockSignUp.mockResolvedValueOnce({ error });

    await act(async () => {
      try {
        await useAuthStore.getState().signUp('existing@example.com', 'password');
      } catch {}
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('throws when email confirmation is required', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });
    const signInError = { message: 'Email not confirmed' };
    mockSignInWithPassword.mockResolvedValueOnce({ error: signInError });

    await expect(useAuthStore.getState().signUp('new@example.com', 'password')).rejects.toEqual(signInError);
  });

  it('sets isLoading to false after success', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });

    await act(async () => {
      await useAuthStore.getState().signUp('new@example.com', 'password');
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('sets isLoading to false even when an unexpected error is thrown', async () => {
    mockSignUp.mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      try {
        await useAuthStore.getState().signUp('test@example.com', 'password');
      } catch {}
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

describe('signOut', () => {
  it('clears session, profile and guest state', async () => {
    useAuthStore.setState({ session: MOCK_SESSION as any, profile: MOCK_PROFILE as any, isGuest: true });
    mockSignOut.mockResolvedValueOnce({});

    await act(async () => {
      await useAuthStore.getState().signOut();
    });

    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.isGuest).toBe(false);
  });
});

describe('continueAsGuest', () => {
  it('sets isGuest to true and isLoading to false', () => {
    useAuthStore.getState().continueAsGuest();
    const state = useAuthStore.getState();
    expect(state.isGuest).toBe(true);
    expect(state.isLoading).toBe(false);
  });
});

describe('setProfile', () => {
  it('sets the profile in state', () => {
    useAuthStore.getState().setProfile(MOCK_PROFILE as any);
    expect(useAuthStore.getState().profile).toEqual(MOCK_PROFILE);
  });
});

describe('updateProfile', () => {
  it('does nothing if there is no session', async () => {
    useAuthStore.setState({ session: null });
    await act(async () => {
      await useAuthStore.getState().updateProfile({ daily_calorie_target: 2000 });
    });
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it('updates profile in state on success', async () => {
    useAuthStore.setState({ session: MOCK_SESSION as any, profile: MOCK_PROFILE as any });

    const mockUpdate = jest.fn().mockResolvedValueOnce({ error: null });
    const mockEq = jest.fn(() => mockUpdate());
    mockSupabaseFrom.mockReturnValueOnce({
      update: jest.fn(() => ({ eq: mockEq })),
    });

    await act(async () => {
      await useAuthStore.getState().updateProfile({ daily_calorie_target: 2000 });
    });

    expect(useAuthStore.getState().profile?.daily_calorie_target).toBe(2000);
  });

  it('throws and does not update state when Supabase returns an error', async () => {
    useAuthStore.setState({ session: MOCK_SESSION as any, profile: MOCK_PROFILE as any });

    const mockUpdate = jest.fn().mockResolvedValueOnce({ error: { message: 'DB error' } });
    const mockEq = jest.fn(() => mockUpdate());
    mockSupabaseFrom.mockReturnValueOnce({
      update: jest.fn(() => ({ eq: mockEq })),
    });

    await expect(useAuthStore.getState().updateProfile({ daily_calorie_target: 9999 })).rejects.toEqual({
      message: 'DB error',
    });

    expect(useAuthStore.getState().profile?.daily_calorie_target).toBe(1800); // unchanged
  });
});
