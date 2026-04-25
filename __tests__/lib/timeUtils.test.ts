import {
  parseNotifTime,
  buildNotifTime,
  formatDisplayHour,
  isAmHour,
  toggleAmPm,
  adjustHour,
  adjustMinute,
} from '../../lib/timeUtils';

// ─── parseNotifTime ───────────────────────────────────────────────────────────

describe('parseNotifTime', () => {
  it('parses a standard 24-hour time string', () => {
    expect(parseNotifTime('19:00')).toEqual({ hour: 19, minute: 0 });
  });

  it('parses midnight correctly', () => {
    expect(parseNotifTime('00:00')).toEqual({ hour: 0, minute: 0 });
  });

  it('parses 12:30 correctly', () => {
    expect(parseNotifTime('12:30')).toEqual({ hour: 12, minute: 30 });
  });

  it('parses 08:05 with zero-padding correctly', () => {
    expect(parseNotifTime('08:05')).toEqual({ hour: 8, minute: 5 });
  });

  it('defaults to 19:00 when string is empty', () => {
    expect(parseNotifTime('')).toEqual({ hour: 19, minute: 0 });
  });

  it('defaults to 19:00 when string is invalid', () => {
    expect(parseNotifTime('bad')).toEqual({ hour: 19, minute: 0 });
  });

  it('clamps hour to 23 for out-of-range values', () => {
    expect(parseNotifTime('25:00').hour).toBe(23);
  });

  it('clamps minute to 59 for out-of-range values', () => {
    expect(parseNotifTime('10:90').minute).toBe(59);
  });
});

// ─── buildNotifTime ───────────────────────────────────────────────────────────

describe('buildNotifTime', () => {
  it('produces a zero-padded HH:MM string', () => {
    expect(buildNotifTime(7, 5)).toBe('07:05');
  });

  it('handles double-digit values correctly', () => {
    expect(buildNotifTime(19, 30)).toBe('19:30');
  });

  it('handles midnight', () => {
    expect(buildNotifTime(0, 0)).toBe('00:00');
  });

  it('round-trips through parseNotifTime', () => {
    const time = '14:45';
    const { hour, minute } = parseNotifTime(time);
    expect(buildNotifTime(hour, minute)).toBe(time);
  });
});

// ─── formatDisplayHour ────────────────────────────────────────────────────────

describe('formatDisplayHour', () => {
  describe('24h format', () => {
    it('returns the hour unchanged', () => {
      expect(formatDisplayHour(0,  '24h')).toBe(0);
      expect(formatDisplayHour(13, '24h')).toBe(13);
      expect(formatDisplayHour(23, '24h')).toBe(23);
    });
  });

  describe('12h format', () => {
    it('converts hour 0 (midnight) to 12', () => {
      expect(formatDisplayHour(0, '12h')).toBe(12);
    });

    it('converts hours 1-11 (AM) unchanged', () => {
      expect(formatDisplayHour(1,  '12h')).toBe(1);
      expect(formatDisplayHour(11, '12h')).toBe(11);
    });

    it('keeps 12 (noon) as 12', () => {
      expect(formatDisplayHour(12, '12h')).toBe(12);
    });

    it('converts hours 13-23 (PM) to 1-11', () => {
      expect(formatDisplayHour(13, '12h')).toBe(1);
      expect(formatDisplayHour(18, '12h')).toBe(6);
      expect(formatDisplayHour(23, '12h')).toBe(11);
    });
  });
});

// ─── isAmHour ─────────────────────────────────────────────────────────────────

describe('isAmHour', () => {
  it('returns true for hours 0-11 (AM)', () => {
    expect(isAmHour(0)).toBe(true);
    expect(isAmHour(11)).toBe(true);
  });

  it('returns false for hours 12-23 (PM)', () => {
    expect(isAmHour(12)).toBe(false);
    expect(isAmHour(23)).toBe(false);
  });
});

// ─── toggleAmPm ──────────────────────────────────────────────────────────────

describe('toggleAmPm', () => {
  it('switches AM hours to PM by adding 12', () => {
    expect(toggleAmPm(7)).toBe(19);
    expect(toggleAmPm(0)).toBe(12);
    expect(toggleAmPm(11)).toBe(23);
  });

  it('switches PM hours to AM by subtracting 12', () => {
    expect(toggleAmPm(19)).toBe(7);
    expect(toggleAmPm(12)).toBe(0);
    expect(toggleAmPm(23)).toBe(11);
  });

  it('is its own inverse', () => {
    expect(toggleAmPm(toggleAmPm(9))).toBe(9);
    expect(toggleAmPm(toggleAmPm(21))).toBe(21);
  });
});

// ─── adjustHour ──────────────────────────────────────────────────────────────

describe('adjustHour', () => {
  it('increments by 1', () => {
    expect(adjustHour(10, 1)).toBe(11);
  });

  it('wraps from 23 back to 0', () => {
    expect(adjustHour(23, 1)).toBe(0);
  });

  it('decrements by 1', () => {
    expect(adjustHour(10, -1)).toBe(9);
  });

  it('wraps from 0 back to 23', () => {
    expect(adjustHour(0, -1)).toBe(23);
  });

  it('wraps correctly for large deltas', () => {
    expect(adjustHour(0, 25)).toBe(1); // 25 % 24 = 1
  });
});

// ─── adjustMinute ────────────────────────────────────────────────────────────

describe('adjustMinute', () => {
  it('increments by 5', () => {
    expect(adjustMinute(30, 5)).toBe(35);
  });

  it('wraps from 55 back to 0 when adding 5', () => {
    expect(adjustMinute(55, 5)).toBe(0);
  });

  it('decrements by 5', () => {
    expect(adjustMinute(30, -5)).toBe(25);
  });

  it('wraps from 0 back to 55 when subtracting 5', () => {
    expect(adjustMinute(0, -5)).toBe(55);
  });

  it('wraps for arbitrary values', () => {
    expect(adjustMinute(0, -15)).toBe(45);
  });
});
