/**
 * UAT — Wellness & Water User Journeys
 *
 * Covers every user-facing interaction with:
 *   • Journal notes  — write, update, clear, blank/whitespace handling
 *   • Mood tracking  — all 6 valid moods, overwrite, multi-day independence
 *   • Water cups     — increment (+1), decrement (-1), floor clamp at 0, save & reload
 *   • Water goal     — tap-to-edit, persistence, min/max clamping
 *   • getAllWellnessDates — discovery of dates with notes or moods
 *   • journalUtils helpers — applyWaterGoalDelta, applyWaterCupDelta, getMoodColor,
 *                            getMoodQuote
 *
 * These are pure-storage UATs — no component rendering required.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import {
  getDailyNote,
  setDailyNote,
  getAllWellnessDates,
  getMood,
  setMood,
  getWaterCups,
  setWaterCups,
  getWaterGoal,
  saveWaterGoal,
  Mood,
} from '../../lib/asyncStorage';

import {
  applyWaterGoalDelta,
  applyWaterCupDelta,
  getMoodColor,
  getMoodQuote,
} from '../../lib/journalUtils';

beforeEach(async () => {
  await AsyncStorage.clear();
});

// ─── NOTES — complete journey ─────────────────────────────────────────────────

describe('UAT: Journal notes — full lifecycle', () => {
  const TODAY = '2026-04-25';
  const YESTERDAY = '2026-04-24';

  it('reads null when no note exists yet', async () => {
    expect(await getDailyNote(TODAY)).toBeNull();
  });

  it('writes a note and reads it back', async () => {
    await setDailyNote(TODAY, 'Felt energised after morning run');
    expect(await getDailyNote(TODAY)).toBe('Felt energised after morning run');
  });

  it('overwrites a note for the same date', async () => {
    await setDailyNote(TODAY, 'First draft');
    await setDailyNote(TODAY, 'Revised entry — tracked every meal today!');
    expect(await getDailyNote(TODAY)).toBe('Revised entry — tracked every meal today!');
  });

  it('clears a note by saving an empty string', async () => {
    await setDailyNote(TODAY, 'Something written earlier');
    await setDailyNote(TODAY, '');
    expect(await getDailyNote(TODAY)).toBeNull();
  });

  it('clears a note by saving only whitespace', async () => {
    await setDailyNote(TODAY, 'Will be wiped');
    await setDailyNote(TODAY, '   \t  ');
    expect(await getDailyNote(TODAY)).toBeNull();
  });

  it('notes for different dates are independent', async () => {
    await setDailyNote(TODAY, 'Today note');
    await setDailyNote(YESTERDAY, 'Yesterday note');
    expect(await getDailyNote(TODAY)).toBe('Today note');
    expect(await getDailyNote(YESTERDAY)).toBe('Yesterday note');
  });

  it('clearing one date does not affect another date', async () => {
    await setDailyNote(TODAY, 'Keep this');
    await setDailyNote(YESTERDAY, 'Remove this');
    await setDailyNote(YESTERDAY, '');
    expect(await getDailyNote(TODAY)).toBe('Keep this');
    expect(await getDailyNote(YESTERDAY)).toBeNull();
  });

  it('preserves special characters and emoji exactly', async () => {
    const note = '3 km run ✅ — PR: 28\'42" 💪 calories < target!';
    await setDailyNote(TODAY, note);
    expect(await getDailyNote(TODAY)).toBe(note);
  });

  it('preserves a 500-character note without truncation', async () => {
    const long = 'x'.repeat(500);
    await setDailyNote(TODAY, long);
    expect(await getDailyNote(TODAY)).toHaveLength(500);
  });

  it('multiple writes in sequence keep only the last value', async () => {
    for (let i = 1; i <= 5; i++) {
      await setDailyNote(TODAY, `Draft ${i}`);
    }
    expect(await getDailyNote(TODAY)).toBe('Draft 5');
  });
});

// ─── MOOD — all 6 moods, overwrite, independence ─────────────────────────────

describe('UAT: Mood tracking — all 6 moods', () => {
  const TODAY = '2026-04-25';

  it('returns null before any mood is set', async () => {
    expect(await getMood(TODAY)).toBeNull();
  });

  it.each<Mood>(['great', 'good', 'okay', 'low', 'stressed', 'tired'])(
    'saves and retrieves mood "%s"',
    async (mood) => {
      await setMood(TODAY, mood);
      expect(await getMood(TODAY)).toBe(mood);
    }
  );

  it('overwrites an earlier mood for the same date', async () => {
    await setMood(TODAY, 'great');
    await setMood(TODAY, 'tired');
    expect(await getMood(TODAY)).toBe('tired');
  });

  it('overwriting does not affect a different date', async () => {
    await setMood(TODAY, 'great');
    await setMood('2026-04-24', 'low');
    await setMood(TODAY, 'okay'); // overwrite today
    expect(await getMood('2026-04-24')).toBe('low'); // yesterday unchanged
  });

  it('five different dates each hold their own mood', async () => {
    const entries: [string, Mood][] = [
      ['2026-04-21', 'tired'],
      ['2026-04-22', 'stressed'],
      ['2026-04-23', 'low'],
      ['2026-04-24', 'okay'],
      ['2026-04-25', 'great'],
    ];
    for (const [date, mood] of entries) await setMood(date, mood);
    for (const [date, mood] of entries) expect(await getMood(date)).toBe(mood);
  });
});

// ─── WELLNESS DATES DISCOVERY ─────────────────────────────────────────────────

describe('UAT: getAllWellnessDates — notes + mood discovery', () => {
  it('returns empty array when nothing is stored', async () => {
    expect(await getAllWellnessDates()).toEqual([]);
  });

  it('returns a date when it has a note', async () => {
    await setDailyNote('2026-04-25', 'Hello!');
    expect(await getAllWellnessDates()).toContain('2026-04-25');
  });

  it('returns a date when it has only a mood', async () => {
    await setMood('2026-04-24', 'good');
    expect(await getAllWellnessDates()).toContain('2026-04-24');
  });

  it('deduplicates a date that has both note and mood', async () => {
    await setDailyNote('2026-04-23', 'Dual entry');
    await setMood('2026-04-23', 'great');
    const dates = await getAllWellnessDates();
    expect(dates.filter((d) => d === '2026-04-23')).toHaveLength(1);
  });

  it('returns dates sorted newest-first', async () => {
    await setDailyNote('2026-04-20', 'old');
    await setDailyNote('2026-04-22', 'mid');
    await setDailyNote('2026-04-25', 'new');
    const dates = await getAllWellnessDates();
    expect(dates.indexOf('2026-04-25')).toBeLessThan(dates.indexOf('2026-04-22'));
    expect(dates.indexOf('2026-04-22')).toBeLessThan(dates.indexOf('2026-04-20'));
  });

  it('clearing a note removes that date from results when no mood exists', async () => {
    await setDailyNote('2026-04-25', 'Will be gone');
    await setDailyNote('2026-04-25', ''); // clear
    const dates = await getAllWellnessDates();
    expect(dates).not.toContain('2026-04-25');
  });

  it('a date with cleared note but still has mood remains in results', async () => {
    await setDailyNote('2026-04-25', 'Gone');
    await setMood('2026-04-25', 'okay');
    await setDailyNote('2026-04-25', ''); // clear note
    expect(await getAllWellnessDates()).toContain('2026-04-25');
  });
});

// ─── WATER CUPS — increment / decrement / clamp ───────────────────────────────

describe('UAT: Water cups — +1/-1 cycle and clamp', () => {
  const DATE = '2026-04-25';

  it('starts at 0 for a new day', async () => {
    expect(await getWaterCups(DATE)).toBe(0);
  });

  it('incrementing (+1) once results in 1 cup', async () => {
    const current = await getWaterCups(DATE);
    const next = applyWaterCupDelta(current, 1);
    await setWaterCups(DATE, next);
    expect(await getWaterCups(DATE)).toBe(1);
  });

  it('incrementing 8 times results in 8 cups', async () => {
    let cups = 0;
    for (let i = 0; i < 8; i++) {
      cups = applyWaterCupDelta(cups, 1);
      await setWaterCups(DATE, cups);
    }
    expect(await getWaterCups(DATE)).toBe(8);
    expect(cups).toBe(8);
  });

  it('decrementing from 3 results in 2', async () => {
    await setWaterCups(DATE, 3);
    const next = applyWaterCupDelta(3, -1);
    await setWaterCups(DATE, next);
    expect(await getWaterCups(DATE)).toBe(2);
  });

  it('decrementing from 0 stays at 0 (floor clamp)', async () => {
    const clamped = applyWaterCupDelta(0, -1);
    expect(clamped).toBe(0);
    await setWaterCups(DATE, clamped);
    expect(await getWaterCups(DATE)).toBe(0);
  });

  it('incrementing then decrementing back to 0 is allowed', async () => {
    let cups = 0;
    cups = applyWaterCupDelta(cups, 1);
    cups = applyWaterCupDelta(cups, 1);
    cups = applyWaterCupDelta(cups, -1);
    cups = applyWaterCupDelta(cups, -1);
    expect(cups).toBe(0);
    await setWaterCups(DATE, cups);
    expect(await getWaterCups(DATE)).toBe(0);
  });

  it('multiple decrements below 0 all clamp to 0', async () => {
    let cups = 0;
    for (let i = 0; i < 5; i++) cups = applyWaterCupDelta(cups, -1);
    expect(cups).toBe(0);
  });

  it('cups for two different dates are isolated', async () => {
    await setWaterCups('2026-04-25', 5);
    await setWaterCups('2026-04-24', 3);
    expect(await getWaterCups('2026-04-25')).toBe(5);
    expect(await getWaterCups('2026-04-24')).toBe(3);
  });

  it('save persists across separate reads', async () => {
    await setWaterCups(DATE, 6);
    const readBack = await getWaterCups(DATE);
    expect(readBack).toBe(6);
  });
});

// ─── WATER GOAL — tap-to-edit, clamping ───────────────────────────────────────

describe('UAT: Water goal — tap-to-edit lifecycle', () => {
  it('default goal is 8 cups', async () => {
    expect(await getWaterGoal()).toBe(8);
  });

  it('user can set a custom goal of 10 and reload it', async () => {
    await saveWaterGoal(10);
    expect(await getWaterGoal()).toBe(10);
  });

  it('user can change goal from 10 to 12', async () => {
    await saveWaterGoal(10);
    await saveWaterGoal(12);
    expect(await getWaterGoal()).toBe(12);
  });

  it('entering 0 clamps up to 1', async () => {
    await saveWaterGoal(0);
    expect(await getWaterGoal()).toBe(1);
  });

  it('entering a negative value clamps up to 1', async () => {
    await saveWaterGoal(-5);
    expect(await getWaterGoal()).toBe(1);
  });

  it('entering 21 clamps down to 20', async () => {
    await saveWaterGoal(21);
    expect(await getWaterGoal()).toBe(20);
  });

  it('boundary value 1 is accepted exactly', async () => {
    await saveWaterGoal(1);
    expect(await getWaterGoal()).toBe(1);
  });

  it('boundary value 20 is accepted exactly', async () => {
    await saveWaterGoal(20);
    expect(await getWaterGoal()).toBe(20);
  });

  it('goal and daily cups are stored independently', async () => {
    await saveWaterGoal(10);
    await setWaterCups('2026-04-25', 4);
    expect(await getWaterGoal()).toBe(10);
    expect(await getWaterCups('2026-04-25')).toBe(4);
  });

  it('applyWaterGoalDelta clamps result between 1 and 20', () => {
    expect(applyWaterGoalDelta(1, -1)).toBe(1);   // floor
    expect(applyWaterGoalDelta(20, 1)).toBe(20);  // ceiling
    expect(applyWaterGoalDelta(8, 2)).toBe(10);   // normal increment
    expect(applyWaterGoalDelta(8, -2)).toBe(6);   // normal decrement
  });
});

// ─── MOOD COLORS and QUOTES (pure functions) ──────────────────────────────────

describe('UAT: getMoodColor — returns colours for all 6 moods', () => {
  it.each<Mood>(['great', 'good', 'okay', 'low', 'stressed', 'tired'])(
    'getMoodColor("%s") returns a non-empty bg/border/text/accent',
    (mood) => {
      const c = getMoodColor(mood);
      expect(c.bg).toBeTruthy();
      expect(c.border).toBeTruthy();
      expect(c.text).toBeTruthy();
      expect(c.accent).toBeTruthy();
    }
  );

  it('great mood returns a green-family background', () => {
    expect(getMoodColor('great').bg).toBe('#F0FFF4');
  });

  it('stressed mood returns a purple-family background', () => {
    expect(getMoodColor('stressed').bg).toBe('#F3E5F5');
  });
});

describe('UAT: getMoodQuote — returns a string for all 6 moods', () => {
  it.each<Mood>(['great', 'good', 'okay', 'low', 'stressed', 'tired'])(
    'getMoodQuote("%s") returns a non-empty string',
    (mood) => {
      const q = getMoodQuote(mood);
      expect(typeof q).toBe('string');
      expect(q.length).toBeGreaterThan(0);
    }
  );
});

// ─── COMBINED JOURNEY: full wellness day ──────────────────────────────────────

describe('UAT: Full wellness day — note + mood + water together', () => {
  const DATE = '2026-04-25';

  it('persists all three data points independently', async () => {
    await setDailyNote(DATE, 'Great run this morning!');
    await setMood(DATE, 'great');
    await setWaterCups(DATE, 7);

    expect(await getDailyNote(DATE)).toBe('Great run this morning!');
    expect(await getMood(DATE)).toBe('great');
    expect(await getWaterCups(DATE)).toBe(7);
  });

  it('updating note does not overwrite mood or water', async () => {
    await setDailyNote(DATE, 'Initial note');
    await setMood(DATE, 'good');
    await setWaterCups(DATE, 5);

    await setDailyNote(DATE, 'Updated note');

    expect(await getMood(DATE)).toBe('good');
    expect(await getWaterCups(DATE)).toBe(5);
  });

  it('overwriting mood does not affect note or water', async () => {
    await setDailyNote(DATE, 'My note');
    await setMood(DATE, 'tired');
    await setWaterCups(DATE, 3);

    await setMood(DATE, 'okay');

    expect(await getDailyNote(DATE)).toBe('My note');
    expect(await getWaterCups(DATE)).toBe(3);
  });

  it('the date appears in getAllWellnessDates after any wellness data is written', async () => {
    await setMood(DATE, 'great');
    expect(await getAllWellnessDates()).toContain(DATE);

    await setDailyNote(DATE, 'Added a note too');
    const dates = await getAllWellnessDates();
    expect(dates.filter((d) => d === DATE)).toHaveLength(1); // still deduplicated
  });
});
