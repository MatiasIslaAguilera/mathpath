import { describe, expect, it } from 'vitest';
import { dailyReminderIcs, escapeText, foldLine, nextOccurrence } from '../src/reminders/ics';
import { msUntilReminder } from '../src/reminders/notify';

const now = new Date(2026, 9, 17, 18, 30); // Oct 17 2026, 18:30 local

describe('calendar reminder (.ics)', () => {
  const ics = dailyReminderIcs({ time: '19:00', appUrl: 'https://example.test/app/', now });
  const lines = ics.split('\r\n');

  it('uses CRLF line endings and the required structure', () => {
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(lines.at(-2)).toBe('END:VCALENDAR');
    expect(lines.some((l) => l.startsWith('PRODID:'))).toBe(true);
  });

  it('repeats daily at the chosen local time, starting at the next occurrence', () => {
    expect(lines).toContain('RRULE:FREQ=DAILY');
    expect(lines).toContain('DTSTART:20261017T190000'); // floating local time, later today
    const late = dailyReminderIcs({ time: '07:15', appUrl: 'x', now });
    expect(late).toContain('DTSTART:20261018T071500'); // 07:15 already passed → tomorrow
  });

  it('alerts at the event time and has a stable UID (re-import updates, not duplicates)', () => {
    expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY');
    expect(lines).toContain('TRIGGER:PT0M');
    expect(lines.filter((l) => l.startsWith('UID:'))).toEqual(['UID:mathpath-daily-reminder@mathpath.local']);
    expect(lines.find((l) => l.startsWith('DTSTAMP:'))).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);
  });

  it('keeps every physical line within 75 octets', () => {
    const enc = new TextEncoder();
    for (const l of lines) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
  });

  it('escapes text and folds long lines reversibly', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const long = 'DESCRIPTION:' + 'é'.repeat(80);
    const folded = foldLine(long);
    expect(folded.split('\r\n ').join('')).toBe(long); // unfolding restores it
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
  });

  it('rejects malformed times', () => {
    expect(() => nextOccurrence('25:00', now)).toThrow();
    expect(() => nextOccurrence('7pm', now)).toThrow();
  });
});

describe('in-app reminder timing', () => {
  it('waits until the time, unless today is already done or the time has passed', () => {
    expect(msUntilReminder('19:00', false, now)).toBe(30 * 60 * 1000);
    expect(msUntilReminder('19:00', true, now)).toBeNull();
    expect(msUntilReminder('18:00', false, now)).toBeNull();
  });
});
