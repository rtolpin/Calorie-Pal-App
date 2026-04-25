import { ActivityLevel, Gender, Goal } from '../types';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  active: 1.55,
  very_active: 1.725,
};

// Cal deficit per lb of fat per week (1 lb fat ≈ 3,500 kcal → 500 cal/day deficit)
export type WeightLossRate = 1 | 1.5 | 2;

export const WEIGHT_LOSS_DEFICITS: Record<WeightLossRate, number> = {
  1: 500,    // −500 cal/day → ~1 lb/week
  1.5: 750,  // −750 cal/day → ~1.5 lb/week
  2: 1000,   // −1000 cal/day → ~2 lb/week
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

/** Maps a Gender to a TDEE, using the average of male/female for 'other'. */
function tdeeForGender(
  weightKg: number,
  heightCm: number,
  age: number,
  activityLevel: ActivityLevel,
  gender: Gender,
): number {
  if (gender === 'male') {
    return calculateTDEE(weightKg, heightCm, age, true, activityLevel);
  }
  if (gender === 'female') {
    return calculateTDEE(weightKg, heightCm, age, false, activityLevel);
  }
  // 'other': average of male and female Mifflin-St Jeor values
  const male   = calculateTDEE(weightKg, heightCm, age, true,  activityLevel);
  const female = calculateTDEE(weightKg, heightCm, age, false, activityLevel);
  return Math.round((male + female) / 2);
}

export function calculateDailyCalorieTarget(
  weightKg: number,
  heightCm: number,
  age: number,
  activityLevel: ActivityLevel,
  goal: Goal,
  weightLossRate: WeightLossRate = 1,
  gender: Gender = 'female',
): number {
  const tdee = tdeeForGender(weightKg, heightCm, age, activityLevel, gender);
  let adjustment: number;
  if (goal === 'lose_weight') {
    adjustment = -WEIGHT_LOSS_DEFICITS[weightLossRate];
  } else if (goal === 'gain_muscle') {
    adjustment = 300;
  } else {
    adjustment = 0;
  }
  return Math.max(1200, Math.min(4000, tdee + adjustment));
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
