import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import * as LocalStorage from '../lib/asyncStorage';
import { ExerciseLog } from '../types';

interface ExerciseLogState {
  exerciseLogs: ExerciseLog[];
  isLoading: boolean;

  fetchExerciseLogs: (userId?: string, isGuest?: boolean) => Promise<void>;
  addExerciseLog: (
    log: Omit<ExerciseLog, 'id' | 'created_at'>,
    userId?: string,
    isGuest?: boolean
  ) => Promise<void>;
  updateExerciseLog: (
    id: string,
    updates: Partial<ExerciseLog>,
    userId?: string,
    isGuest?: boolean
  ) => Promise<void>;
  deleteExerciseLog: (id: string, userId?: string, isGuest?: boolean) => Promise<void>;
  clearExerciseLogs: () => void;
}

export const useExerciseLogStore = create<ExerciseLogState>((set) => ({
  exerciseLogs: [],
  isLoading: false,

  fetchExerciseLogs: async (userId, isGuest) => {
    set({ isLoading: true });
    try {
      if (isGuest) {
        const logs = await LocalStorage.getGuestExerciseLogs();
        set({ exerciseLogs: logs, isLoading: false });
        return;
      }

      if (!userId) {
        set({ isLoading: false });
        return;
      }

      const { data, error } = await supabase
        .from('exercise_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false });

      if (error) throw error;
      set({ exerciseLogs: (data as ExerciseLog[]) || [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addExerciseLog: async (log, userId, isGuest) => {
    const now = new Date().toISOString();
    const id = LocalStorage.generateId();
    const fullLog: ExerciseLog = { ...log, id, created_at: now, logged_at: log.logged_at || now };

    if (isGuest) {
      await LocalStorage.saveGuestExerciseLog(fullLog);
      set((state) => ({ exerciseLogs: [fullLog, ...state.exerciseLogs] }));
      return;
    }

    if (!userId) return;

    const { data, error } = await supabase
      .from('exercise_logs')
      .insert({ ...log, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    set((state) => ({ exerciseLogs: [data as ExerciseLog, ...state.exerciseLogs] }));
  },

  updateExerciseLog: async (id, updates, userId, isGuest) => {
    if (isGuest) {
      await LocalStorage.updateGuestExerciseLog(id, updates);
      set((state) => ({
        exerciseLogs: state.exerciseLogs.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      }));
      return;
    }

    if (!userId) return;

    const { error } = await supabase
      .from('exercise_logs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    set((state) => ({
      exerciseLogs: state.exerciseLogs.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }));
  },

  deleteExerciseLog: async (id, userId, isGuest) => {
    if (isGuest) {
      await LocalStorage.deleteGuestExerciseLog(id);
      set((state) => ({ exerciseLogs: state.exerciseLogs.filter((l) => l.id !== id) }));
      return;
    }

    if (!userId) return;

    const { error } = await supabase
      .from('exercise_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    set((state) => ({ exerciseLogs: state.exerciseLogs.filter((l) => l.id !== id) }));
  },

  clearExerciseLogs: () => set({ exerciseLogs: [] }),
}));
