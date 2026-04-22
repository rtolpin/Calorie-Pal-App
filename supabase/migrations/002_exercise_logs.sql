-- CaloriePal: Exercise Logs Migration
-- Run this in your Supabase SQL Editor AFTER 001_initial.sql

CREATE TABLE IF NOT EXISTS public.exercise_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  exercise_emoji TEXT DEFAULT '🏃',
  duration_minutes FLOAT NOT NULL DEFAULT 0,
  calories_burned FLOAT NOT NULL DEFAULT 0,
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS exercise_logs_user_id_idx ON public.exercise_logs(user_id);
CREATE INDEX IF NOT EXISTS exercise_logs_logged_at_idx ON public.exercise_logs(logged_at DESC);
CREATE INDEX IF NOT EXISTS exercise_logs_user_logged_idx ON public.exercise_logs(user_id, logged_at DESC);

-- Row Level Security
ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exercise logs"
  ON public.exercise_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exercise logs"
  ON public.exercise_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exercise logs"
  ON public.exercise_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exercise logs"
  ON public.exercise_logs FOR DELETE
  USING (auth.uid() = user_id);
