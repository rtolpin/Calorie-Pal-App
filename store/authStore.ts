import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

interface AuthState {
  session: Session | null;
  profile: UserProfile | null;
  isGuest: boolean;
  isLoading: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

// Prevents initialize() from running more than once. React Strict Mode fires
// effects twice (mount → cleanup → remount), which would register two
// onAuthStateChange subscriptions and trigger double lock acquisitions.
let _initializeCalled = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isGuest: false,
  isLoading: true,
  initialized: false,
  initialize: async () => {
    if (_initializeCalled) return;
    _initializeCalled = true;

    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();

        set({
          session: data.session,
          profile: profile as UserProfile,
          isGuest: false,
          isLoading: false,
          initialized: true,
        });
      } else {
        set({ isLoading: false, initialized: true });
      }

      // onAuthStateChange must NOT be async and must NOT await any Supabase
      // calls inside the callback. A known gotrue-js bug causes a Web Locks
      // deadlock when async work is done inside this handler, producing:
      // "Lock was released because another request stole it"
      supabase.auth.onAuthStateChange((event, session) => {
        // PASSWORD_RECOVERY is owned by reset-password.tsx — don't update
        // the store with the temporary recovery session.
        if (event === 'PASSWORD_RECOVERY') return;

        if (session) {
          // Set session synchronously, then fire-and-forget the profile fetch.
          // Awaiting inside this callback is what causes the lock deadlock.
          set({ session, isGuest: false });
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data: profile }) => {
              set({ profile: profile as UserProfile });
            });
        } else {
          set({ session: null, profile: null });
        }
      });
    } catch {
      set({ isLoading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email, password) => {
    set({ isLoading: true });
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      // Immediately sign in — works when email confirmation is disabled in Supabase.
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    // Clear local state first so the UI navigates away immediately,
    // regardless of how long the server-side invalidation takes.
    set({ session: null, profile: null, isGuest: false });
    try {
      await supabase.auth.signOut();
    } catch {
      // Local state is already cleared; server invalidation is best-effort.
    }
  },

  continueAsGuest: () => {
    set({ isGuest: true, isLoading: false });
  },

  setProfile: (profile) => set({ profile }),

  updateProfile: async (updates) => {
    const { session } = get();
    if (!session) return;

    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);

    if (error) throw error;
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...updates } : null,
    }));
  },
}));
