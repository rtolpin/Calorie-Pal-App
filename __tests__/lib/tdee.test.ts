import { calculateTDEE, calculateDailyCalorieTarget, calculateMacroGrams, WEIGHT_LOSS_DEFICITS } from '../../lib/tdee';

// ─── Gender-based calculateDailyCalorieTarget ─────────────────────────────────

describe('calculateDailyCalorieTarget — gender', () => {
  const baseArgs = [70, 175, 30, 'active' as const, 'maintain' as const] as const;

  it('male target is higher than female target given same stats', () => {
    const male   = calculateDailyCalorieTarget(...baseArgs, 1, 'male');
    const female = calculateDailyCalorieTarget(...baseArgs, 1, 'female');
    expect(male).toBeGreaterThan(female);
  });

  it('"other" target is between male and female', () => {
    const male   = calculateDailyCalorieTarget(...baseArgs, 1, 'male');
    const female = calculateDailyCalorieTarget(...baseArgs, 1, 'female');
    const other  = calculateDailyCalorieTarget(...baseArgs, 1, 'other');
    expect(other).toBeGreaterThan(female);
    expect(other).toBeLessThan(male);
  });

  it('defaults to female formula when gender is omitted (backward compatibility)', () => {
    const withDefault = calculateDailyCalorieTarget(...baseArgs);
    const explicit    = calculateDailyCalorieTarget(...baseArgs, 1, 'female');
    expect(withDefault).toBe(explicit);
  });

  it('male weight-loss target still respects the 1-lb/week deficit', () => {
    const maintain = calculateDailyCalorieTarget(...baseArgs, 1, 'male');
    const lose     = calculateDailyCalorieTarget(70, 175, 30, 'active', 'lose_weight', 1, 'male');
    expect(maintain - lose).toBe(500);
  });

  it('female muscle-gain target is 300 cal above female maintain', () => {
    const maintain = calculateDailyCalorieTarget(60, 165, 25, 'active', 'maintain', 1, 'female');
    const gain     = calculateDailyCalorieTarget(60, 165, 25, 'active', 'gain_muscle', 1, 'female');
    expect(gain - maintain).toBe(300);
  });

  it('clamps to 1200 minimum for male too', () => {
    expect(
      calculateDailyCalorieTarget(35, 140, 18, 'sedentary', 'lose_weight', 2, 'male')
    ).toBeGreaterThanOrEqual(1200);
  });

  it('clamps to 4000 maximum for male too', () => {
    expect(
      calculateDailyCalorieTarget(200, 220, 25, 'very_active', 'gain_muscle', 1, 'male')
    ).toBeLessThanOrEqual(4000);
  });
});

describe('calculateTDEE', () => {
  it('calculates male BMR with sedentary activity', () => {
    // BMR = 10*70 + 6.25*175 - 5*30 + 5 = 1648.75 → TDEE = 1648.75 * 1.2 = 1978.5 → 1979
    expect(calculateTDEE(70, 175, 30, true, 'sedentary')).toBe(1979);
  });

  it('calculates female BMR with sedentary activity', () => {
    // BMR = 10*60 + 6.25*165 - 5*25 - 161 = 1345.25 → TDEE = 1345.25 * 1.2 = 1614.3 → 1614
    expect(calculateTDEE(60, 165, 25, false, 'sedentary')).toBe(1614);
  });

  it('male TDEE is higher than female TDEE given same stats', () => {
    const male = calculateTDEE(70, 175, 30, true, 'active');
    const female = calculateTDEE(70, 175, 30, false, 'active');
    expect(male).toBeGreaterThan(female);
  });

  it('lightly_active is higher than sedentary', () => {
    expect(calculateTDEE(70, 175, 30, true, 'lightly_active')).toBeGreaterThan(
      calculateTDEE(70, 175, 30, true, 'sedentary')
    );
  });

  it('active is higher than lightly_active', () => {
    expect(calculateTDEE(70, 175, 30, true, 'active')).toBeGreaterThan(
      calculateTDEE(70, 175, 30, true, 'lightly_active')
    );
  });

  it('very_active is higher than active', () => {
    expect(calculateTDEE(70, 175, 30, true, 'very_active')).toBeGreaterThan(
      calculateTDEE(70, 175, 30, true, 'active')
    );
  });

  it('heavier person has higher TDEE', () => {
    const lighter = calculateTDEE(60, 175, 30, true, 'active');
    const heavier = calculateTDEE(90, 175, 30, true, 'active');
    expect(heavier).toBeGreaterThan(lighter);
  });

  it('taller person has higher TDEE', () => {
    const shorter = calculateTDEE(70, 160, 30, true, 'active');
    const taller = calculateTDEE(70, 190, 30, true, 'active');
    expect(taller).toBeGreaterThan(shorter);
  });

  it('older person has lower TDEE', () => {
    const younger = calculateTDEE(70, 175, 25, true, 'active');
    const older = calculateTDEE(70, 175, 50, true, 'active');
    expect(older).toBeLessThan(younger);
  });

  it('returns a positive integer', () => {
    const result = calculateTDEE(70, 175, 30, true, 'active');
    expect(result).toBeGreaterThan(0);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('WEIGHT_LOSS_DEFICITS', () => {
  it('1 lb/week = 500 cal/day deficit', () => {
    expect(WEIGHT_LOSS_DEFICITS[1]).toBe(500);
  });

  it('1.5 lb/week = 750 cal/day deficit', () => {
    expect(WEIGHT_LOSS_DEFICITS[1.5]).toBe(750);
  });

  it('2 lb/week = 1000 cal/day deficit', () => {
    expect(WEIGHT_LOSS_DEFICITS[2]).toBe(1000);
  });
});

describe('calculateDailyCalorieTarget', () => {
  it('defaults to 1 lb/week (−500 cal/day) when no rate given', () => {
    const maintain = calculateDailyCalorieTarget(70, 175, 30, 'active', 'maintain');
    const lose = calculateDailyCalorieTarget(70, 175, 30, 'active', 'lose_weight');
    expect(maintain - lose).toBe(500);
  });

  it('1 lb/week rate is 500 fewer calories than maintain', () => {
    const maintain = calculateDailyCalorieTarget(70, 175, 30, 'active', 'maintain');
    const lose = calculateDailyCalorieTarget(70, 175, 30, 'active', 'lose_weight', 1);
    expect(maintain - lose).toBe(500);
  });

  it('1.5 lb/week rate is 750 fewer calories than maintain', () => {
    const maintain = calculateDailyCalorieTarget(70, 175, 30, 'active', 'maintain');
    const lose = calculateDailyCalorieTarget(70, 175, 30, 'active', 'lose_weight', 1.5);
    expect(maintain - lose).toBe(750);
  });

  it('2 lb/week rate is 1000 fewer calories than maintain', () => {
    const maintain = calculateDailyCalorieTarget(70, 175, 30, 'active', 'maintain');
    const lose = calculateDailyCalorieTarget(70, 175, 30, 'active', 'lose_weight', 2);
    expect(maintain - lose).toBe(1000);
  });

  it('each loss rate produces a strictly lower target than the previous', () => {
    const rate1 = calculateDailyCalorieTarget(70, 175, 30, 'active', 'lose_weight', 1);
    const rate1_5 = calculateDailyCalorieTarget(70, 175, 30, 'active', 'lose_weight', 1.5);
    const rate2 = calculateDailyCalorieTarget(70, 175, 30, 'active', 'lose_weight', 2);
    expect(rate1).toBeGreaterThan(rate1_5);
    expect(rate1_5).toBeGreaterThan(rate2);
  });

  it('weightLossRate is ignored for maintain goal', () => {
    const base = calculateDailyCalorieTarget(70, 175, 30, 'active', 'maintain');
    expect(calculateDailyCalorieTarget(70, 175, 30, 'active', 'maintain', 1)).toBe(base);
    expect(calculateDailyCalorieTarget(70, 175, 30, 'active', 'maintain', 2)).toBe(base);
  });

  it('weightLossRate is ignored for gain_muscle goal', () => {
    const base = calculateDailyCalorieTarget(70, 175, 30, 'active', 'gain_muscle');
    expect(calculateDailyCalorieTarget(70, 175, 30, 'active', 'gain_muscle', 1)).toBe(base);
    expect(calculateDailyCalorieTarget(70, 175, 30, 'active', 'gain_muscle', 2)).toBe(base);
  });

  it('gain_muscle is 300 more calories than maintain', () => {
    const maintain = calculateDailyCalorieTarget(70, 175, 30, 'active', 'maintain');
    const gain = calculateDailyCalorieTarget(70, 175, 30, 'active', 'gain_muscle');
    expect(gain - maintain).toBe(300);
  });

  it('clamps to minimum 1200 cal even with aggressive 2 lb/week rate', () => {
    const result = calculateDailyCalorieTarget(35, 140, 18, 'sedentary', 'lose_weight', 2);
    expect(result).toBeGreaterThanOrEqual(1200);
  });

  it('clamps result to minimum of 1200 calories (default rate)', () => {
    const result = calculateDailyCalorieTarget(35, 140, 18, 'sedentary', 'lose_weight');
    expect(result).toBeGreaterThanOrEqual(1200);
  });

  it('clamps result to maximum of 4000 calories', () => {
    const result = calculateDailyCalorieTarget(200, 220, 25, 'very_active', 'gain_muscle');
    expect(result).toBeLessThanOrEqual(4000);
  });

  it('returns a positive value for all activity levels', () => {
    const levels = ['sedentary', 'lightly_active', 'active', 'very_active'] as const;
    levels.forEach((level) => {
      expect(calculateDailyCalorieTarget(70, 175, 30, level, 'maintain')).toBeGreaterThan(0);
    });
  });

  it('returns a positive value for all goals', () => {
    const goals = ['lose_weight', 'maintain', 'gain_muscle'] as const;
    goals.forEach((goal) => {
      expect(calculateDailyCalorieTarget(70, 175, 30, 'active', goal)).toBeGreaterThan(0);
    });
  });
});

describe('calculateMacroGrams', () => {
  it('calculates protein grams (4 cal/g)', () => {
    // 2000 cal * 30% = 600 cal / 4 = 150g
    expect(calculateMacroGrams(2000, 30, 40, 30).protein_g).toBe(150);
  });

  it('calculates carb grams (4 cal/g)', () => {
    // 2000 cal * 40% = 800 cal / 4 = 200g
    expect(calculateMacroGrams(2000, 30, 40, 30).carbs_g).toBe(200);
  });

  it('calculates fat grams (9 cal/g)', () => {
    // 2000 cal * 30% = 600 cal / 9 = 66.67 → 67g
    expect(calculateMacroGrams(2000, 30, 40, 30).fat_g).toBe(67);
  });

  it('returns zeros when calories are 0', () => {
    const result = calculateMacroGrams(0, 30, 40, 30);
    expect(result.protein_g).toBe(0);
    expect(result.carbs_g).toBe(0);
    expect(result.fat_g).toBe(0);
  });

  it('handles 100% protein split', () => {
    const result = calculateMacroGrams(2000, 100, 0, 0);
    expect(result.protein_g).toBe(500);
    expect(result.carbs_g).toBe(0);
    expect(result.fat_g).toBe(0);
  });

  it('handles high-fat keto split (5/25/70)', () => {
    const result = calculateMacroGrams(2000, 5, 25, 70);
    expect(result.protein_g).toBe(25);   // 100 cal / 4
    expect(result.carbs_g).toBe(125);   // 500 cal / 4
    expect(result.fat_g).toBe(156);     // 1400 cal / 9 = 155.6 → 156
  });

  it('all values are non-negative integers', () => {
    const result = calculateMacroGrams(1800, 30, 40, 30);
    expect(result.protein_g).toBeGreaterThanOrEqual(0);
    expect(result.carbs_g).toBeGreaterThanOrEqual(0);
    expect(result.fat_g).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.protein_g)).toBe(true);
    expect(Number.isInteger(result.carbs_g)).toBe(true);
    expect(Number.isInteger(result.fat_g)).toBe(true);
  });
});
