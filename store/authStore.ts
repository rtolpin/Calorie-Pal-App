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
  syncSession: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

// Incremented every time SIGNED_OUT fires. Each async profile fetch captures
// the generation at start; if it differs on completion the fetch is stale
// (user signed out while it was in flight) and is discarded.
// This avoids calling getSession() inside onAuthStateChange (which can
// deadlock Supabase's internal session lock) and avoids checking
// get().session (which is null during the recovery flow, breaking sign-in).
let _fetchGeneration = 0;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isGuest: false,
  isLoading: true,
  initialized: false,
  initialize: async () => {
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

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          // Owned by reset-password.tsx. Do not update the store with the
          // temporary recovery session — it would trigger the tabs guard and
          // bounce the user to the welcome screen before they set a password.
          return;
        }

        if (!session) {
          // SIGNED_OUT: invalidate any profile fetches that are in flight so
          // they don't restore the session after the user has logged out.
          _fetchGeneration++;
          set({ session: null, profile: null });
          return;
        }

        // SIGNED_IN / USER_UPDATED / TOKEN_REFRESHED etc.
        const generation = _fetchGeneration;
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        // Discard if a SIGNED_OUT fired while the fetch was in flight.
        if (generation !== _fetchGeneration) return;

        set({ session, profile: profile as UserProfile, isGuest: false });
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

  // Called after a successful password reset to immediately sync the new
  // authenticated session into the store, without waiting for onAuthStateChange
  // to complete its async profile fetch. This ensures the tabs guard sees a
  // valid session the moment the user taps "Continue to App".
  syncSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    set({ session, profile: profile as UserProfile, isGuest: false });
  },

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
