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

      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          set({ session, profile: profile as UserProfile, isGuest: false });
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ isLoading: false });
    if (error) throw error;
  },

  signUp: async (email, password) => {
    set({ isLoading: true });
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      set({ isLoading: false });
      throw signUpError;
    }
    // Immediately sign in — works when email confirmation is disabled in Supabase.
    // If confirmation is required, this throws so the UI can prompt the user to check email.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    set({ isLoading: false });
    if (signInError) throw signInError;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, isGuest: false });
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
