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
        set({ logs, isLoading: false });
        return;
      }

      if (!userId) {
        set({ isLoading: false });
        return;
      }

      const { data, error } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false });

      if (error) throw error;
      set({ logs: (data as FoodLog[]) || [], isLoading: false });
    } catch {
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

    const { data, error } = await supabase
      .from('food_logs')
      .insert({ ...log, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    set((state) => ({ logs: [data as FoodLog, ...state.logs] }));
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
      .update({ ...updates, updated_at: new Date().toISOString() })
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
