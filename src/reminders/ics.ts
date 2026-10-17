// A daily recurring calendar event (RFC 5545 .ics). This is the reliable reminder: a local-only
// PWA can't fire a notification at a set time while it's closed (Web Push needs a server and the
// Notification Triggers API never shipped), but every phone calendar can. See PLAN §6.

export interface ReminderOptions {
  /** "HH:MM", 24-hour, in the learner's local time. */
  time: string;
  /** Link that opens the app (shown in the event). */
  appUrl: string;
  now?: Date;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function parseTime(time: string): { h: number; m: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) throw new Error(`Invalid time "${time}" (expected HH:MM)`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) throw new Error(`Invalid time "${time}"`);
  return { h, m };
}

/** The next local date-time at `time`: today if it's still ahead, otherwise tomorrow. */
export function nextOccurrence(time: string, now = new Date()): Date {
  const { h, m } = parseTime(time);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/** Floating local time (no Z, no TZID): the event stays at 7 pm wherever the phone is. */
const localStamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Escape TEXT values (RFC 5545 §3.3.11). */
export const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold lines longer than 75 octets (RFC 5545 §3.1), without splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let limit = 75;
  for (const ch of line) {
    if (enc.encode(current + ch).length > limit) {
      parts.push(current);
      current = ch;
      limit = 74; // continuation lines start with a space
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function dailyReminderIcs({ time, appUrl, now = new Date() }: ReminderOptions): string {
  const start = nextOccurrence(time, now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MathPath//Daily reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // A stable UID: re-importing updates the same event instead of creating a duplicate.
    'UID:mathpath-daily-reminder@mathpath.local',
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${localStamp(start)}`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${escapeText('MathPath: today\'s session')}`,
    `DESCRIPTION:${escapeText(`About 10 minutes. On a busy day, 3 problems still counts.\nOpen: ${appUrl}`)}`,
    `URL:${appUrl}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText('Time for MathPath')}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
