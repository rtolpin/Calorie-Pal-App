import { FoodLog, ExerciseLog } from '../types';
import { toLocalDateStr } from './dateUtils';

export type Mood = 'great' | 'good' | 'okay' | 'low' | 'stressed' | 'tired';

export interface MoodColor {
  bg: string;
  border: string;
  text: string;
  accent: string;
}

const MOOD_COLORS: Record<Mood, MoodColor> = {
  great:   { bg: '#F0FFF4', border: '#4CAF50', text: '#2E7D32', accent: '#4CAF50' },
  good:    { bg: '#F1F8E9', border: '#8BC34A', text: '#558B2F', accent: '#8BC34A' },
  okay:    { bg: '#FFF8E1', border: '#FFB300', text: '#E65100', accent: '#FFB300' },
  low:     { bg: '#E3F2FD', border: '#2196F3', text: '#1565C0', accent: '#2196F3' },
  stressed:{ bg: '#F3E5F5', border: '#9C27B0', text: '#6A1B9A', accent: '#9C27B0' },
  tired:   { bg: '#ECEFF1', border: '#607D8B', text: '#37474F', accent: '#607D8B' },
};

const MOOD_QUOTES: Record<Mood, [string, string]> = {
  great:   ['You\'re absolutely glowing today! Keep that energy! 🔥', 'Days like this are what it\'s all about. You\'ve got this!'],
  good:    ['Consistency beats perfection. Great work today! 😊', 'A good day is a building block. You\'re making progress!'],
  okay:    ['Neutral days are part of the journey. Every step counts 💪', 'Not every day needs to be extraordinary. You showed up!'],
  low:     ['Be gentle with yourself today. Tomorrow is a fresh start 🌅', 'Low days are temporary. You are stronger than you feel right now 💙'],
  stressed:['One breath at a time. You\'re handling more than you know 💜', 'Stress means you care. Take a moment to reset.'],
  tired:   ['Rest is part of recovery. You\'ve earned it 😴', 'Listen to your body — it\'s telling you something important.'],
};

export function getMoodColor(mood: Mood): MoodColor {
  return MOOD_COLORS[mood];
}

export function getMoodQuote(mood: Mood): string {
  const pair = MOOD_QUOTES[mood];
  return pair[new Date().getDay() % 2];
}

export type JournalEntryType = 'all' | 'food' | 'exercise';

export type JournalEntry =
  | { type: 'food'; data: FoodLog }
  | { type: 'exercise'; data: ExerciseLog };

/**
 * Returns entries from all days other than todayStr, respecting the entry type
 * filter. Used to surface recent activity when today has nothing logged yet.
 */
export function getRecentPastEntries(
  logs: FoodLog[],
  exerciseLogs: ExerciseLog[],
  todayStr: string,
  entryType: JournalEntryType,
): JournalEntry[] {
  let food: JournalEntry[] =
    entryType === 'exercise'
      ? []
      : logs
          .filter((l) => toLocalDateStr(new Date(l.logged_at)) !== todayStr)
          .map((d) => ({ type: 'food' as const, data: d }));

  let exercise: JournalEntry[] =
    entryType === 'food'
      ? []
      : exerciseLogs
          .filter((l) => toLocalDateStr(new Date(l.logged_at)) !== todayStr)
          .map((d) => ({ type: 'exercise' as const, data: d }));

  return [...food, ...exercise].sort(
    (a, b) => new Date(b.data.logged_at).getTime() - new Date(a.data.logged_at).getTime(),
  );
}

/** Groups a flat entry list into { date → entries[] }, date strings are local YYYY-MM-DD. */
export function groupEntriesByDate(entries: JournalEntry[]): Record<string, JournalEntry[]> {
  const map: Record<string, JournalEntry[]> = {};
  for (const entry of entries) {
    const date = toLocalDateStr(new Date(entry.data.logged_at));
    if (!map[date]) map[date] = [];
    map[date].push(entry);
  }
  return map;
}

/**
 * Filters a flat entry list to only those whose meal/exercise name is in the
 * corresponding favorites set.
 */
export function filterFavoriteEntries(
  entries: JournalEntry[],
  favoriteMealNames: string[],
  favoriteExerciseNames: string[],
): JournalEntry[] {
  const mealSet = new Set(favoriteMealNames);
  const exerciseSet = new Set(favoriteExerciseNames);
  return entries.filter((e) =>
    e.type === 'food'
      ? mealSet.has((e.data as FoodLog).meal_name)
      : exerciseSet.has((e.data as ExerciseLog).exercise_name),
  );
}

/**
 * Filters items to those whose local date falls within [fromDate, toDate].
 * Either bound may be an empty string to mean "unbounded".
 * Dates must be YYYY-MM-DD strings.
 */
export function filterByDateRange<T extends { logged_at: string }>(
  items: T[],
  fromDate: string,
  toDate: string,
): T[] {
  return items.filter((l) => {
    const d = toLocalDateStr(new Date(l.logged_at));
    if (fromDate.length === 10 && d < fromDate) return false;
    if (toDate.length === 10 && d > toDate) return false;
    return true;
  });
}

/** Clamps a water-goal delta so the result stays within [1, 20]. */
export function applyWaterGoalDelta(current: number, delta: number): number {
  return Math.min(20, Math.max(1, current + delta));
}

/** Clamps a water-cup delta so the result never goes below 0. */
export function applyWaterCupDelta(current: number, delta: number): number {
  return Math.max(0, current + delta);
}
