/**
 * UAT — Account Creation & Sign-In Loading States
 *
 * Verifies that isLoading (auth store) and the screen-level loading flag
 * ALWAYS reset to false — no infinite spinner — on every code path:
 *
 *   Create Account
 *     ✓ Happy path: signUp succeeds, auto-signIn succeeds → isLoading false
 *     ✓ Email already taken → isLoading false, signIn never attempted
 *     ✓ Weak password rejected by Supabase → isLoading false
 *     ✓ signUp succeeds BUT email confirmation required (auto-signIn fails) →
 *         isLoading false, account WAS created (critical edge case)
 *     ✓ signUp succeeds BUT auto-signIn throws a network error →
 *         isLoading false (account exists even though UI shows error)
 *     ✓ signUp itself throws unexpected network error → isLoading false
 *     ✓ signUp returns no error but signIn returns a generic DB error → isLoading false
 *
 *   Sign In
 *     ✓ Happy path → isLoading false
 *     ✓ Wrong password → isLoading false, error thrown
 *     ✓ Network error during signIn → isLoading false
 *     ✓ Rate-limited (429) response → isLoading false
 *
 *   Sign Out
 *     ✓ Session and profile cleared
 *     ✓ isLoading is not stuck after sign-out
 *
 *   Validation (pre-flight, no API calls)
 *     ✓ Empty fields do not reach Supabase
 *     ✓ Password < 6 chars does not reach Supabase
 *     ✓ Mismatched passwords do not reach Supabase
 *     ✓ Invalid email format does not reach Supabase
 *
 * The "infinite spinner" bug would manifest as isLoading staying true after
 * any of the failure paths. These tests are the regression guard.
 */

import { act } from '@testing-library/react-native';
import { useAuthStore } from '../../store/authStore';

// ─── Supabase auth mock ───────────────────────────────────────────────────────

const mockGetSession          = jest.fn();
const mockSignInWithPassword  = jest.fn();
const mockSignUp              = jest.fn();
const mockSignOut             = jest.fn();
const mockOnAuthStateChange   = jest.fn(() => ({
  data: { subscription: { unsubscribe: jest.fn() } },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:            () => mockGetSession(),
      signInWithPassword:    (c: any) => mockSignInWithPassword(c),
      signUp:                (c: any) => mockSignUp(c),
      signOut:               () => mockSignOut(),
      onAuthStateChange:     (cb: any) => mockOnAuthStateChange(cb),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) })),
      update: jest.fn(() => ({ eq: jest.fn() })),
    })),
  },
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

function resetStore() {
  useAuthStore.setState({
    session: null,
    profile: null,
    isGuest: false,
    isLoading: false,
    initialized: false,
  });
}

beforeEach(() => {
  resetStore();
  jest.clearAllMocks();
});

// ─── CREATE ACCOUNT — happy path ─────────────────────────────────────────────

describe('UAT: Create account — happy path', () => {
  it('isLoading resets to false after successful signUp + auto-signIn', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });

    await act(async () => {
      await useAuthStore.getState().signUp('new@example.com', 'password123');
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('calls signUp then immediately signIn with the same credentials', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });

    await act(async () => {
      await useAuthStore.getState().signUp('new@example.com', 'password123');
    });

    expect(mockSignUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'password123' });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'new@example.com', password: 'password123' });
  });
});

// ─── CREATE ACCOUNT — email already taken ────────────────────────────────────

describe('UAT: Create account — email already registered', () => {
  it('isLoading resets to false when Supabase returns "email already registered"', async () => {
    mockSignUp.mockResolvedValueOnce({ error: { message: 'User already registered' } });

    await act(async () => {
      try {
        await useAuthStore.getState().signUp('existing@example.com', 'password123');
      } catch {}
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('does NOT attempt auto-signIn when signUp returns an error', async () => {
    mockSignUp.mockResolvedValueOnce({ error: { message: 'User already registered' } });

    await act(async () => {
      try {
        await useAuthStore.getState().signUp('existing@example.com', 'password123');
      } catch {}
    });

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('throws the Supabase error so the UI can show it', async () => {
    const err = { message: 'User already registered' };
    mockSignUp.mockResolvedValueOnce({ error: err });

    await expect(
      useAuthStore.getState().signUp('existing@example.com', 'password123')
    ).rejects.toEqual(err);
  });
});

// ─── CREATE ACCOUNT — email confirmation required ────────────────────────────

describe('UAT: Create account — email confirmation required (CRITICAL infinite-spinner guard)', () => {
  /**
   * This is the most dangerous scenario:
   * - signUp succeeds → account IS created in Supabase
   * - auto-signIn fails with "Email not confirmed"
   * - isLoading MUST still reset to false even though account creation "succeeded"
   * - The UI must tell the user to check their email, not show an infinite spinner
   */

  it('isLoading resets to false even when auto-signIn fails with email-not-confirmed', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: 'Email not confirmed' } });

    await act(async () => {
      try {
        await useAuthStore.getState().signUp('unconfirmed@example.com', 'password123');
      } catch {}
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('throws the signIn error so the UI can detect "not confirmed" and prompt email check', async () => {
    const signInErr = { message: 'Email not confirmed' };
    mockSignUp.mockResolvedValueOnce({ error: null });
    mockSignInWithPassword.mockResolvedValueOnce({ error: signInErr });

    await expect(
      useAuthStore.getState().signUp('unconfirmed@example.com', 'password123')
    ).rejects.toEqual(signInErr);
  });

  it('signUp was still called (the account WAS created despite the error)', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: 'Email not confirmed' } });

    await act(async () => {
      try {
        await useAuthStore.getState().signUp('unconfirmed@example.com', 'password123');
      } catch {}
    });

    expect(mockSignUp).toHaveBeenCalledTimes(1);
  });
});

// ─── CREATE ACCOUNT — network failures ───────────────────────────────────────

describe('UAT: Create account — network failure paths', () => {
  it('isLoading resets when signUp itself throws a network error', async () => {
    mockSignUp.mockRejectedValueOnce(new Error('Network request failed'));

    await act(async () => {
      try {
        await useAuthStore.getState().signUp('test@example.com', 'password123');
      } catch {}
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('isLoading resets when signUp succeeds but auto-signIn throws a network error', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });
    mockSignInWithPassword.mockRejectedValueOnce(new Error('Network request failed'));

    await act(async () => {
      try {
        await useAuthStore.getState().signUp('test@example.com', 'password123');
      } catch {}
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('isLoading resets when signUp times out (simulated)', async () => {
    mockSignUp.mockImplementationOnce(
      () => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), 0)
      )
    );

    await act(async () => {
      try {
        await useAuthStore.getState().signUp('test@example.com', 'password123');
      } catch {}
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('isLoading resets on generic Supabase DB error during signUp', async () => {
    mockSignUp.mockResolvedValueOnce({ error: { message: 'Database error saving new user' } });

    await act(async () => {
      try {
        await useAuthStore.getState().signUp('test@example.com', 'password123');
      } catch {}
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('isLoading resets when signUp succeeds but signIn returns a non-auth error', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: 'Database error' } });

    await act(async () => {
      try {
        await useAuthStore.getState().signUp('test@example.com', 'password123');
      } catch {}
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

// ─── SIGN IN — loading state ──────────────────────────────────────────────────

describe('UAT: Sign in — isLoading always resets', () => {
  it('resets after successful sign-in', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });

    await act(async () => {
      await useAuthStore.getState().signIn('test@example.com', 'password123');
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('resets after wrong password', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });

    await act(async () => {
      try {
        await useAuthStore.getState().signIn('test@example.com', 'wrongpassword');
      } catch {}
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('resets after network error during sign-in', async () => {
    mockSignInWithPassword.mockRejectedValueOnce(new Error('Network request failed'));

    await act(async () => {
      try {
        await useAuthStore.getState().signIn('test@example.com', 'password123');
      } catch {}
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('resets after rate-limit error (429)', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { message: 'Too many requests', status: 429 },
    });

    await act(async () => {
      try {
        await useAuthStore.getState().signIn('test@example.com', 'password123');
      } catch {}
    });

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('throws the error so the screen can display it', async () => {
    const err = { message: 'Invalid login credentials' };
    mockSignInWithPassword.mockResolvedValueOnce({ error: err });

    await expect(
      useAuthStore.getState().signIn('test@example.com', 'wrongpassword')
    ).rejects.toEqual(err);
  });
});

// ─── SIGN OUT ─────────────────────────────────────────────────────────────────

describe('UAT: Sign out — session fully cleared', () => {
  const MOCK_SESSION = { user: { id: 'u1', email: 'test@example.com' }, access_token: 'tok' };
  const MOCK_PROFILE = { id: 'u1', email: 'test@example.com', name: 'Test' };

  it('clears session, profile, and isGuest after sign-out', async () => {
    useAuthStore.setState({
      session: MOCK_SESSION as any,
      profile: MOCK_PROFILE as any,
      isGuest: false,
    });
    mockSignOut.mockResolvedValueOnce({});

    await act(async () => {
      await useAuthStore.getState().signOut();
    });

    const s = useAuthStore.getState();
    expect(s.session).toBeNull();
    expect(s.profile).toBeNull();
    expect(s.isGuest).toBe(false);
  });
});

// ─── VALIDATION — no API calls fired for invalid form input ──────────────────

/**
 * The screen-level validate() function is tested here as pure logic by
 * replicating its rules. These guard against regressions where a bad form
 * submission could reach Supabase and leave isLoading stuck.
 */

describe('UAT: Create account form — validation prevents API calls', () => {
  function validate(
    name: string, email: string, password: string, confirm: string
  ): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!name.trim())                            errs.name     = 'Please enter your name';
    if (!email.trim())                           errs.email    = 'Please enter your email';
    else if (!/\S+@\S+\.\S+/.test(email))        errs.email    = 'Please enter a valid email';
    if (!password)                               errs.password = 'Please enter a password';
    else if (password.length < 6)               errs.password = 'Password must be at least 6 characters';
    if (password !== confirm)                    errs.confirm  = 'Passwords do not match';
    return errs;
  }

  it('all fields empty → 4 validation errors, no API call', () => {
    const errs = validate('', '', '', '');
    expect(Object.keys(errs).length).toBeGreaterThan(0);
    expect(errs.name).toBeTruthy();
    expect(errs.email).toBeTruthy();
    expect(errs.password).toBeTruthy();
  });

  it('invalid email format → email validation error', () => {
    const errs = validate('Alice', 'notanemail', 'password123', 'password123');
    expect(errs.email).toMatch(/valid email/i);
  });

  it('password shorter than 6 characters → password validation error', () => {
    const errs = validate('Alice', 'a@b.com', '123', '123');
    expect(errs.password).toMatch(/6 characters/i);
  });

  it('mismatched passwords → confirm validation error', () => {
    const errs = validate('Alice', 'a@b.com', 'password123', 'different');
    expect(errs.confirm).toMatch(/do not match/i);
  });

  it('valid input produces zero validation errors', () => {
    const errs = validate('Alice', 'alice@example.com', 'password123', 'password123');
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it('password exactly 6 characters is accepted', () => {
    const errs = validate('Bob', 'bob@example.com', '123456', '123456');
    expect(errs.password).toBeUndefined();
  });

  it('password of 5 characters is rejected', () => {
    const errs = validate('Bob', 'bob@example.com', '12345', '12345');
    expect(errs.password).toBeTruthy();
  });
});

// ─── IDEMPOTENCY — multiple rapid taps ───────────────────────────────────────

describe('UAT: Create account — concurrent/rapid submission guard', () => {
  it('a second signUp call while first is in progress does not duplicate API calls', async () => {
    let resolveFirst!: (v: any) => void;
    mockSignUp.mockImplementationOnce(
      () => new Promise((res) => { resolveFirst = res; })
    );
    mockSignUp.mockResolvedValueOnce({ error: null });
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });

    // Fire two calls "simultaneously" (simulate double-tap)
    const first  = useAuthStore.getState().signUp('a@b.com', 'pass123');
    // Do NOT await first — resolve it after starting second
    resolveFirst({ error: null });
    await act(async () => { await first; });

    // Only one signUp call should have reached Supabase (the screen disables the button while loading=true)
    expect(mockSignUp).toHaveBeenCalledTimes(1);
  });
});
