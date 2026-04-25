import {
  getRecentPastEntries,
  groupEntriesByDate,
  filterFavoriteEntries,
  filterByDateRange,
  applyWaterGoalDelta,
  applyWaterCupDelta,
  getMoodColor,
  getMoodQuote,
  Mood,
} from '../../lib/journalUtils';
import { FoodLog, ExerciseLog } from '../../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeFood(id: string, loggedAt: string): FoodLog {
  return {
    id,
    user_id: 'u1',
    meal_name: `Meal ${id}`,
    foods_detected: [],
    calories: 300,
    protein_g: 20,
    carbs_g: 30,
    fat_g: 10,
    fiber_g: 3,
    sugar_g: 5,
    sodium_mg: 400,
    cholesterol_mg: 50,
    saturated_fat_g: 2,
    logged_at: loggedAt,
    created_at: loggedAt,
  };
}

function makeExercise(id: string, loggedAt: string): ExerciseLog {
  return {
    id,
    user_id: 'u1',
    exercise_name: `Exercise ${id}`,
    exercise_emoji: '🏃',
    duration_minutes: 30,
    calories_burned: 200,
    logged_at: loggedAt,
    created_at: loggedAt,
  };
}

// Build ISO timestamps in local time so comparisons are timezone-safe
function localISO(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

const TODAY = new Date();
const todayStr = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-${String(TODAY.getDate()).padStart(2, '0')}`;

const YESTERDAY_D = new Date(Date.now() - 86400000);
const yesterdayStr = `${YESTERDAY_D.getFullYear()}-${String(YESTERDAY_D.getMonth() + 1).padStart(2, '0')}-${String(YESTERDAY_D.getDate()).padStart(2, '0')}`;

// A fixed past date that is always "not today"
const PAST_ISO = localISO(2026, 1, 10, 12);
const PAST_ISO_2 = localISO(2026, 1, 9, 12);
const TODAY_ISO = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate(), 12).toISOString();

// ─── getRecentPastEntries ──────────────────────────────────────────────────────

describe('getRecentPastEntries', () => {
  describe('empty inputs', () => {
    it('returns empty array when both logs are empty', () => {
      expect(getRecentPastEntries([], [], todayStr, 'all')).toEqual([]);
    });

    it('returns empty array when all logs are from today', () => {
      const logs = [makeFood('a', TODAY_ISO)];
      expect(getRecentPastEntries(logs, [], todayStr, 'all')).toEqual([]);
    });
  });

  describe('filtering today out', () => {
    it('excludes entries whose local date matches todayStr', () => {
      const logs = [makeFood('today', TODAY_ISO), makeFood('past', PAST_ISO)];
      const result = getRecentPastEntries(logs, [], todayStr, 'all');
      expect(result).toHaveLength(1);
      expect(result[0].data.id).toBe('past');
    });

    it('includes entries from yesterday', () => {
      const yestISO = new Date(YESTERDAY_D.getFullYear(), YESTERDAY_D.getMonth(), YESTERDAY_D.getDate(), 12).toISOString();
      const logs = [makeFood('yest', yestISO)];
      const result = getRecentPastEntries(logs, [], todayStr, 'all');
      expect(result).toHaveLength(1);
      expect(result[0].data.id).toBe('yest');
    });

    it('includes both food and exercise from past days', () => {
      const logs = [makeFood('f1', PAST_ISO)];
      const exercises = [makeExercise('e1', PAST_ISO)];
      const result = getRecentPastEntries(logs, exercises, todayStr, 'all');
      expect(result).toHaveLength(2);
    });
  });

  describe('entryType filter', () => {
    const logs = [makeFood('f1', PAST_ISO)];
    const exercises = [makeExercise('e1', PAST_ISO)];

    it('returns only food entries when entryType is "food"', () => {
      const result = getRecentPastEntries(logs, exercises, todayStr, 'food');
      expect(result.every((e) => e.type === 'food')).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('returns only exercise entries when entryType is "exercise"', () => {
      const result = getRecentPastEntries(logs, exercises, todayStr, 'exercise');
      expect(result.every((e) => e.type === 'exercise')).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('returns both types when entryType is "all"', () => {
      const result = getRecentPastEntries(logs, exercises, todayStr, 'all');
      expect(result).toHaveLength(2);
    });
  });

  describe('sort order', () => {
    it('sorts entries newest-first', () => {
      const logs = [makeFood('older', PAST_ISO_2), makeFood('newer', PAST_ISO)];
      const result = getRecentPastEntries(logs, [], todayStr, 'all');
      expect(result[0].data.id).toBe('newer');
      expect(result[1].data.id).toBe('older');
    });

    it('interleaves food and exercise in correct date order', () => {
      const logs = [makeFood('f-old', PAST_ISO_2)];
      const exercises = [makeExercise('e-new', PAST_ISO)];
      const result = getRecentPastEntries(logs, exercises, todayStr, 'all');
      expect(result[0].data.id).toBe('e-new');
      expect(result[1].data.id).toBe('f-old');
    });
  });
});

// ─── groupEntriesByDate ────────────────────────────────────────────────────────

describe('groupEntriesByDate', () => {
  it('returns empty object for empty input', () => {
    expect(groupEntriesByDate([])).toEqual({});
  });

  it('groups entries with the same local date together', () => {
    const iso1 = localISO(2026, 1, 10, 9);
    const iso2 = localISO(2026, 1, 10, 18);
    const entries = [
      { type: 'food' as const, data: makeFood('a', iso1) },
      { type: 'food' as const, data: makeFood('b', iso2) },
    ];
    const grouped = groupEntriesByDate(entries);
    const dates = Object.keys(grouped);
    expect(dates).toHaveLength(1);
    expect(grouped[dates[0]]).toHaveLength(2);
  });

  it('creates separate buckets for different local dates', () => {
    const entries = [
      { type: 'food' as const, data: makeFood('a', PAST_ISO) },
      { type: 'food' as const, data: makeFood('b', PAST_ISO_2) },
    ];
    const grouped = groupEntriesByDate(entries);
    expect(Object.keys(grouped)).toHaveLength(2);
  });

  it('preserves the original entry objects inside buckets', () => {
    const entry = { type: 'food' as const, data: makeFood('x', PAST_ISO) };
    const grouped = groupEntriesByDate([entry]);
    const bucket = Object.values(grouped)[0];
    expect(bucket[0]).toBe(entry);
  });
});

// ─── applyWaterGoalDelta ──────────────────────────────────────────────────────

describe('applyWaterGoalDelta', () => {
  it('increments by 1', () => {
    expect(applyWaterGoalDelta(8, 1)).toBe(9);
  });

  it('decrements by 1', () => {
    expect(applyWaterGoalDelta(8, -1)).toBe(7);
  });

  it('clamps at minimum of 1', () => {
    expect(applyWaterGoalDelta(1, -1)).toBe(1);
    expect(applyWaterGoalDelta(1, -5)).toBe(1);
  });

  it('clamps at maximum of 20', () => {
    expect(applyWaterGoalDelta(20, 1)).toBe(20);
    expect(applyWaterGoalDelta(18, 5)).toBe(20);
  });

  it('allows reaching the boundary values exactly', () => {
    expect(applyWaterGoalDelta(2, -1)).toBe(1);
    expect(applyWaterGoalDelta(19, 1)).toBe(20);
  });

  it('does not change value when delta would push out of bounds', () => {
    expect(applyWaterGoalDelta(1, -10)).toBe(1);
    expect(applyWaterGoalDelta(20, 10)).toBe(20);
  });
});

// ─── filterFavoriteEntries ────────────────────────────────────────────────────

describe('filterFavoriteEntries', () => {
  const food1 = { type: 'food' as const, data: makeFood('f1', PAST_ISO) };
  const food2 = { type: 'food' as const, data: { ...makeFood('f2', PAST_ISO), meal_name: 'Pasta' } };
  const ex1   = { type: 'exercise' as const, data: makeExercise('e1', PAST_ISO) };
  const ex2   = { type: 'exercise' as const, data: { ...makeExercise('e2', PAST_ISO), exercise_name: 'Yoga' } };
  const all   = [food1, food2, ex1, ex2];

  it('returns empty when no entries match any favorite', () => {
    expect(filterFavoriteEntries(all, ['Unknown Meal'], ['Unknown Exercise'])).toHaveLength(0);
  });

  it('returns empty when favorite lists are empty', () => {
    expect(filterFavoriteEntries(all, [], [])).toHaveLength(0);
  });

  it('returns food entries whose meal_name is in the favorites list', () => {
    const result = filterFavoriteEntries(all, [`Meal f1`], []);
    expect(result).toHaveLength(1);
    expect(result[0].data.id).toBe('f1');
  });

  it('returns exercise entries whose exercise_name is in the favorites list', () => {
    const result = filterFavoriteEntries(all, [], [`Exercise e1`]);
    expect(result).toHaveLength(1);
    expect(result[0].data.id).toBe('e1');
  });

  it('returns both food and exercise entries when both are favorited', () => {
    const result = filterFavoriteEntries(all, ['Meal f1'], ['Exercise e1']);
    expect(result).toHaveLength(2);
  });

  it('returns multiple food entries when multiple names match', () => {
    const result = filterFavoriteEntries(all, ['Meal f1', 'Pasta'], []);
    expect(result).toHaveLength(2);
  });

  it('does not include entries whose name is not in the favorites list', () => {
    const result = filterFavoriteEntries(all, ['Meal f1'], []);
    const ids = result.map((e) => e.data.id);
    expect(ids).not.toContain('f2');
    expect(ids).not.toContain('e1');
    expect(ids).not.toContain('e2');
  });

  it('returns empty array for empty input', () => {
    expect(filterFavoriteEntries([], ['Meal f1'], ['Exercise e1'])).toHaveLength(0);
  });
});

// ─── filterByDateRange ────────────────────────────────────────────────────────

describe('filterByDateRange', () => {
  // Create items in local time so tests are timezone-agnostic
  const jan10 = new Date(2026, 0, 10, 12).toISOString(); // 2026-01-10 local
  const jan15 = new Date(2026, 0, 15, 12).toISOString(); // 2026-01-15 local
  const jan20 = new Date(2026, 0, 20, 12).toISOString(); // 2026-01-20 local

  const items = [
    makeFood('a', jan10),
    makeFood('b', jan15),
    makeFood('c', jan20),
  ];

  it('returns all items when both bounds are empty strings', () => {
    expect(filterByDateRange(items, '', '')).toHaveLength(3);
  });

  it('returns all items when bounds are shorter than 10 chars (incomplete dates)', () => {
    expect(filterByDateRange(items, '2026-01', '2026-01')).toHaveLength(3);
  });

  it('filters items on or after fromDate', () => {
    const result = filterByDateRange(items, '2026-01-15', '');
    const ids = result.map((i) => i.id);
    expect(ids).not.toContain('a');
    expect(ids).toContain('b');
    expect(ids).toContain('c');
  });

  it('filters items on or before toDate', () => {
    const result = filterByDateRange(items, '', '2026-01-15');
    const ids = result.map((i) => i.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).not.toContain('c');
  });

  it('filters items within a date range (both bounds)', () => {
    const result = filterByDateRange(items, '2026-01-12', '2026-01-18');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('includes items exactly on the fromDate boundary', () => {
    expect(filterByDateRange(items, '2026-01-10', '').some((i) => i.id === 'a')).toBe(true);
  });

  it('includes items exactly on the toDate boundary', () => {
    expect(filterByDateRange(items, '', '2026-01-20').some((i) => i.id === 'c')).toBe(true);
  });

  it('returns empty array when no items fall in range', () => {
    expect(filterByDateRange(items, '2026-02-01', '2026-02-28')).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(filterByDateRange([], '2026-01-01', '2026-12-31')).toHaveLength(0);
  });

  it('single-day range returns only items from that local date', () => {
    const result = filterByDateRange(items, '2026-01-15', '2026-01-15');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });
});

// ─── getMoodColor ─────────────────────────────────────────────────────────────

const ALL_MOODS: Mood[] = ['great', 'good', 'okay', 'low', 'stressed', 'tired'];

describe('getMoodColor', () => {
  it('returns bg, border, text, and accent for every mood', () => {
    ALL_MOODS.forEach((mood) => {
      const c = getMoodColor(mood);
      expect(typeof c.bg).toBe('string');
      expect(typeof c.border).toBe('string');
      expect(typeof c.text).toBe('string');
      expect(typeof c.accent).toBe('string');
    });
  });

  it('each mood has a distinct border color', () => {
    const borders = ALL_MOODS.map((m) => getMoodColor(m).border);
    expect(new Set(borders).size).toBe(ALL_MOODS.length);
  });

  it('all color values are valid 6-digit hex strings', () => {
    const hex = /^#[0-9A-Fa-f]{6}$/;
    ALL_MOODS.forEach((mood) => {
      const c = getMoodColor(mood);
      expect(c.bg).toMatch(hex);
      expect(c.border).toMatch(hex);
      expect(c.text).toMatch(hex);
      expect(c.accent).toMatch(hex);
    });
  });

  it('positive moods use a different border than difficult moods', () => {
    expect(getMoodColor('great').border).not.toBe(getMoodColor('low').border);
    expect(getMoodColor('good').border).not.toBe(getMoodColor('stressed').border);
  });
});

// ─── getMoodQuote ─────────────────────────────────────────────────────────────

describe('getMoodQuote', () => {
  it('returns a non-empty string for every mood', () => {
    ALL_MOODS.forEach((mood) => {
      const q = getMoodQuote(mood);
      expect(typeof q).toBe('string');
      expect(q.length).toBeGreaterThan(10);
    });
  });

  it('different moods produce mostly distinct quotes', () => {
    const quotes = ALL_MOODS.map(getMoodQuote);
    expect(new Set(quotes).size).toBeGreaterThanOrEqual(4);
  });
});

// ─── applyWaterCupDelta ───────────────────────────────────────────────────────

describe('applyWaterCupDelta — fine-tune buttons', () => {
  it('+1 increments by 1', () => {
    expect(applyWaterCupDelta(3, 1)).toBe(4);
  });

  it('+5 increments by 5', () => {
    expect(applyWaterCupDelta(3, 5)).toBe(8);
  });

  it('+10 increments by 10', () => {
    expect(applyWaterCupDelta(3, 10)).toBe(13);
  });

  it('-1 decrements by 1', () => {
    expect(applyWaterCupDelta(3, -1)).toBe(2);
  });

  it('-5 decrements by 5', () => {
    expect(applyWaterCupDelta(8, -5)).toBe(3);
  });

  it('-10 decrements by 10', () => {
    expect(applyWaterCupDelta(12, -10)).toBe(2);
  });

  it('-5 clamps to 0 when cups is less than 5', () => {
    expect(applyWaterCupDelta(3, -5)).toBe(0);
  });

  it('-10 clamps to 0 when cups is less than 10', () => {
    expect(applyWaterCupDelta(3, -10)).toBe(0);
  });

  it('-1 clamps to 0 when cups is already 0', () => {
    expect(applyWaterCupDelta(0, -1)).toBe(0);
  });

  it('result is never negative', () => {
    expect(applyWaterCupDelta(0, -10)).toBeGreaterThanOrEqual(0);
  });

  it('allows going above the goal (no upper clamp on cups)', () => {
    expect(applyWaterCupDelta(8, 5)).toBe(13);
  });
});
