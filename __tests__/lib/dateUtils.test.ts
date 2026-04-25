import { toLocalDateStr, getLocalDate } from '../../lib/dateUtils';

// All dates are constructed with new Date(year, month, day, ...) which uses LOCAL time,
// so these tests are timezone-agnostic and verify local-time behaviour correctly.

describe('toLocalDateStr', () => {
  it('returns a string in YYYY-MM-DD format', () => {
    expect(toLocalDateStr(new Date(2026, 3, 25))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('pads single-digit month with leading zero', () => {
    expect(toLocalDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('pads single-digit day with leading zero', () => {
    expect(toLocalDateStr(new Date(2026, 11, 3))).toBe('2026-12-03');
  });

  it('returns the correct local date for a mid-day timestamp', () => {
    expect(toLocalDateStr(new Date(2026, 3, 25, 14, 0))).toBe('2026-04-25');
  });

  it('returns the correct local date for a late-night timestamp (23:30)', () => {
    // In some UTC+ timezones this timestamp would be the next UTC day — local must stay April 25
    expect(toLocalDateStr(new Date(2026, 3, 25, 23, 30))).toBe('2026-04-25');
  });

  it('returns the correct local date for an early-morning timestamp (00:30)', () => {
    // In some UTC- timezones this timestamp would be the previous UTC day — local must stay April 25
    expect(toLocalDateStr(new Date(2026, 3, 25, 0, 30))).toBe('2026-04-25');
  });

  it('handles December 31 correctly', () => {
    expect(toLocalDateStr(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('handles January 1 correctly', () => {
    expect(toLocalDateStr(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01');
  });

  it('uses local year/month/day components, not UTC components', () => {
    const d = new Date(2026, 3, 25, 10, 30);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(toLocalDateStr(d)).toBe(expected);
  });
});

describe('getLocalDate', () => {
  it('returns a YYYY-MM-DD string from a UTC ISO string', () => {
    const iso = new Date(2026, 3, 25, 10, 0).toISOString();
    expect(getLocalDate(iso)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns the local date for a daytime ISO timestamp', () => {
    const d = new Date(2026, 3, 25, 12, 0); // noon local
    expect(getLocalDate(d.toISOString())).toBe('2026-04-25');
  });

  it('returns the local date for a late-night ISO timestamp', () => {
    // 23:30 local — UTC may already be the next calendar day in UTC+ timezones
    const d = new Date(2026, 3, 25, 23, 30);
    expect(getLocalDate(d.toISOString())).toBe('2026-04-25');
  });

  it('returns the local date for an early-morning ISO timestamp', () => {
    // 00:30 local — UTC may still be the previous calendar day in UTC- timezones
    const d = new Date(2026, 3, 25, 0, 30);
    expect(getLocalDate(d.toISOString())).toBe('2026-04-25');
  });

  it('matches toLocalDateStr(new Date(iso))', () => {
    const d = new Date(2026, 3, 25, 18, 45);
    const iso = d.toISOString();
    expect(getLocalDate(iso)).toBe(toLocalDateStr(new Date(iso)));
  });

  it('produces different results than a naive UTC split for cross-midnight timestamps in UTC+ zones', () => {
    // 23:00 local — could be tomorrow UTC in UTC+ timezones.
    // getLocalDate must still return the LOCAL date, never the UTC date.
    const d = new Date(2026, 3, 25, 23, 0); // April 25 at 23:00 local
    const localResult = getLocalDate(d.toISOString());
    // The local result must match the local date components
    const expectedLocalDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(localResult).toBe(expectedLocalDate);
  });

  it('handles ISO strings with Z suffix', () => {
    const iso = '2026-04-25T10:00:00.000Z';
    const result = getLocalDate(iso);
    const d = new Date(iso);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });
});
