import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import * as LocalStorage from '../lib/asyncStorage';
import { FoodLog } from '../types';

interface FoodLogState {
  logs: FoodLog[];
  isLoading: boolean;
  capturedPhotoUri: string | null;
  capturedPhotoBase64: string | null;

  fetchLogs: (userId?: string, isGuest?: boolean) => Promise<void>;
  addLog: (log: Omit<FoodLog, 'id' | 'created_at'>, userId?: string, isGuest?: boolean) => Promise<void>;
  updateLog: (id: string, updates: Partial<FoodLog>, userId?: string, isGuest?: boolean) => Promise<void>;
  deleteLog: (id: string, userId?: string, isGuest?: boolean) => Promise<void>;
  setCapturedPhoto: (uri: string, base64: string) => void;
  clearCapturedPhoto: () => void;
  clearLogs: () => void;
}

export const useFoodLogStore = create<FoodLogState>((set, get) => ({
  logs: [],
  isLoading: false,
  capturedPhotoUri: null,
  capturedPhotoBase64: null,

  fetchLogs: async (userId, isGuest) => {
    set({ isLoading: true });
    try {
      if (isGuest) {
        const logs = await LocalStorage.getGuestLogs();
        set({ logs });
        return;
      }

      if (!userId) return;

      const { data, error } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false });

      if (error) throw error;
      set({ logs: (data as FoodLog[]) || [] });
    } catch {
      // silent — keep existing logs on screen
    } finally {
      set({ isLoading: false });
    }
  },

  addLog: async (log, userId, isGuest) => {
    const now = new Date().toISOString();
    const id = LocalStorage.generateId();

    const fullLog: FoodLog = {
      ...log,
      id,
      created_at: now,
      logged_at: log.logged_at || now,
    };

    if (isGuest) {
      await LocalStorage.saveGuestLog(fullLog);
      set((state) => ({ logs: [fullLog, ...state.logs] }));
      return;
    }

    if (!userId) return;

    // Optimistic update so the journal shows it immediately
    set((state) => ({ logs: [fullLog, ...state.logs] }));

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      meal_name: log.meal_name,
      foods_detected: log.foods_detected,
      calories: log.calories,
      protein_g: log.protein_g,
      carbs_g: log.carbs_g,
      fat_g: log.fat_g,
      fiber_g: log.fiber_g,
      sugar_g: log.sugar_g,
      sodium_mg: log.sodium_mg,
      cholesterol_mg: log.cholesterol_mg,
      saturated_fat_g: log.saturated_fat_g,
      notes: log.notes,
      logged_at: log.logged_at,
    };
    if (log.photo_url != null) insertPayload.photo_url = log.photo_url;

    const { data, error } = await supabase
      .from('food_logs')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      // Roll back optimistic update on failure
      set((state) => ({ logs: state.logs.filter((l) => l.id !== id) }));
      throw error;
    }

    // Replace optimistic entry with the real one from Supabase
    set((state) => ({
      logs: state.logs.map((l) => (l.id === id ? (data as FoodLog) : l)),
    }));
  },

  updateLog: async (id, updates, userId, isGuest) => {
    if (isGuest) {
      await LocalStorage.updateGuestLog(id, updates);
      set((state) => ({
        logs: state.logs.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      }));
      return;
    }

    if (!userId) return;

    const { error } = await supabase
      .from('food_logs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    set((state) => ({
      logs: state.logs.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }));
  },

  deleteLog: async (id, userId, isGuest) => {
    if (isGuest) {
      await LocalStorage.deleteGuestLog(id);
      set((state) => ({ logs: state.logs.filter((l) => l.id !== id) }));
      return;
    }

    if (!userId) return;

    const { error } = await supabase
      .from('food_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    set((state) => ({ logs: state.logs.filter((l) => l.id !== id) }));
  },

  setCapturedPhoto: (uri, base64) => {
    set({ capturedPhotoUri: uri, capturedPhotoBase64: base64 });
  },

  clearCapturedPhoto: () => {
    set({ capturedPhotoUri: null, capturedPhotoBase64: null });
  },

  clearLogs: () => set({ logs: [] }),
}));
