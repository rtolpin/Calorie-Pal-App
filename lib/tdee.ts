import { ActivityLevel, Goal } from '../types';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  active: 1.55,
  very_active: 1.725,
};

const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  lose_weight: -500,
  maintain: 0,
  gain_muscle: 300,
};

export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  isMale: boolean,
  activityLevel: ActivityLevel
): number {
  // Mifflin-St Jeor equation
  const bmr = isMale
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

export function calculateDailyCalorieTarget(
  weightKg: number,
  heightCm: number,
  age: number,
  activityLevel: ActivityLevel,
  goal: Goal
): number {
  // Use female formula by default (most conservative)
  const tdee = calculateTDEE(weightKg, heightCm, age, false, activityLevel);
  const adjusted = tdee + GOAL_ADJUSTMENTS[goal];
  return Math.max(1200, Math.min(4000, adjusted));
}

export function calculateMacroGrams(
  dailyCalories: number,
  proteinPct: number,
  carbsPct: number,
  fatPct: number
) {
  return {
    protein_g: Math.round((dailyCalories * (proteinPct / 100)) / 4),
    carbs_g: Math.round((dailyCalories * (carbsPct / 100)) / 4),
    fat_g: Math.round((dailyCalories * (fatPct / 100)) / 9),
  };
}
