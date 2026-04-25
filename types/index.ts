export type Goal = 'lose_weight' | 'maintain' | 'gain_muscle';
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'active' | 'very_active';
export type Gender = 'male' | 'female' | 'other';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  gender?: Gender;
  age?: number;
  weight_kg?: number;
  height_cm?: number;
  goal?: Goal;
  activity_level?: ActivityLevel;
  daily_calorie_target: number;
  protein_target_pct: number;
  carbs_target_pct: number;
  fat_target_pct: number;
  notification_enabled: boolean;
  notification_time: string;
  avatar_url?: string;
  created_at: string;
}

export interface FoodLog {
  id: string;
  user_id?: string;
  meal_name: string;
  photo_url?: string;
  foods_detected: string[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  saturated_fat_g: number;
  notes?: string;
  logged_at: string;
  created_at: string;
}

export interface MealAnalysis {
  meal_name: string;
  foods: string[];
  total_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  saturated_fat_g: number;
}

export interface DailySummary {
  date: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  log_count: number;
}

export type ExerciseFelt = 'easy' | 'good' | 'hard' | 'exhausting';

export interface ExerciseLog {
  id: string;
  user_id?: string;
  exercise_name: string;
  exercise_emoji: string;
  duration_minutes: number;
  calories_burned: number;
  felt?: ExerciseFelt;
  photo_url?: string;
  notes?: string;
  logged_at: string;
  created_at: string;
}

export interface DayTemplateFood {
  meal_name: string;
  foods_detected: string[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  saturated_fat_g: number;
  notes?: string;
}

export interface DayTemplateExercise {
  exercise_name: string;
  exercise_emoji: string;
  duration_minutes: number;
  calories_burned: number;
  felt?: ExerciseFelt;
  notes?: string;
}

export interface DayTemplate {
  savedAt: string;
  sourceDate: string;
  foods: DayTemplateFood[];
  exercises: DayTemplateExercise[];
}

export interface ExercisePreset {
  name: string;
  emoji: string;
  cal_per_min: number;
}

export const EXERCISE_PRESETS: ExercisePreset[] = [
  { name: 'Running', emoji: '🏃', cal_per_min: 10 },
  { name: 'Walking', emoji: '🚶', cal_per_min: 4 },
  { name: 'Cycling', emoji: '🚴', cal_per_min: 8 },
  { name: 'Swimming', emoji: '🏊', cal_per_min: 9 },
  { name: 'Weight Training', emoji: '🏋️', cal_per_min: 5 },
  { name: 'HIIT', emoji: '⚡', cal_per_min: 12 },
  { name: 'Yoga', emoji: '🧘', cal_per_min: 3 },
  { name: 'Pilates', emoji: '🤸', cal_per_min: 4 },
  { name: 'Dancing', emoji: '💃', cal_per_min: 6 },
  { name: 'Hiking', emoji: '🥾', cal_per_min: 6 },
  { name: 'Basketball', emoji: '🏀', cal_per_min: 8 },
  { name: 'Soccer', emoji: '⚽', cal_per_min: 9 },
  { name: 'Tennis', emoji: '🎾', cal_per_min: 7 },
  { name: 'Jump Rope', emoji: '⭕', cal_per_min: 11 },
  { name: 'Rowing', emoji: '🚣', cal_per_min: 8 },
  { name: 'Stretching', emoji: '🙆', cal_per_min: 2 },
];

export interface OnboardingData {
  name: string;
  age: string;
  weight_kg: string;
  height_cm: string;
  goal: Goal;
  activity_level: ActivityLevel;
  daily_calorie_target: string;
  protein_target_pct: string;
  carbs_target_pct: string;
  fat_target_pct: string;
}
