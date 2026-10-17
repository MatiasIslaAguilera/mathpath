// Streaks, freezes, and consistency (PLAN §2.2). Everything is computed from the day history
// alone (no stored streak state), so it can never drift out of sync:
//   - a day with ≥ MIN_SESSION problems extends the streak
//   - every FREEZE_EVERY-th streak day earns a freeze (hold at most MAX_FREEZES)
//   - a missed day is covered automatically by a freeze, but only while a streak is running
//   - today never breaks anything: it isn't over yet
// The streak is the motivator; total days and weekly consistency are shown just as prominently,
// so a break never erases visible progress.

import { dateKey, type DayRecord } from '../storage/progress';

export const MIN_SESSION = 3;
export const FREEZE_EVERY = 7;
export const MAX_FREEZES = 2;

const shift = (d: Date, days: number) => {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + days);
  return c;
};
const parse = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const qualifies = (days: Record<string, DayRecord>, key: string) => (days[key]?.problems ?? 0) >= MIN_SESSION;

export interface StreakReport {
  current: number;
  longest: number;
  freezes: number;
  /** Days a freeze covered. */
  frozenDays: string[];
  /** Days a running streak ended (the first missed day with no freeze). */
  breaks: string[];
  totalDays: number;
  /** Qualifying days in the last 7 (including today). */
  lastSevenDays: number;
  /** Last day with ≥ MIN_SESSION problems, if any. */
  lastPracticeDay?: string;
}

export function streakReport(days: Record<string, DayRecord>, today = new Date()): StreakReport {
  const keys = Object.keys(days).filter((k) => qualifies(days, k)).sort();
  const todayKey = dateKey(today);
  const report: StreakReport = { current: 0, longest: 0, freezes: 0, frozenDays: [], breaks: [], totalDays: keys.length, lastSevenDays: 0, lastPracticeDay: keys.at(-1) };
  if (!keys.length) return report;

  let streak = 0;
  for (let d = parse(keys[0]); dateKey(d) <= todayKey; d = shift(d, 1)) {
    const key = dateKey(d);
    if (qualifies(days, key)) {
      streak++;
      report.longest = Math.max(report.longest, streak);
      if (streak % FREEZE_EVERY === 0) report.freezes = Math.min(MAX_FREEZES, report.freezes + 1);
    } else if (key === todayKey) {
      // Today isn't over: no freeze used, nothing broken.
    } else if (streak > 0 && report.freezes > 0) {
      report.freezes--;
      report.frozenDays.push(key);
    } else if (streak > 0) {
      report.breaks.push(key);
      streak = 0;
    }
  }
  report.current = streak;
  for (let i = 0; i < 7; i++) if (qualifies(days, dateKey(shift(today, -i)))) report.lastSevenDays++;
  return report;
}

/** Consecutive qualifying days (freezes bridge gaps), ending today or yesterday. */
export function currentStreak(days: Record<string, DayRecord>, today = new Date()): number {
  return streakReport(days, today).current;
}

export function totalPracticeDays(days: Record<string, DayRecord>): number {
  return Object.keys(days).filter((k) => qualifies(days, k)).length;
}

export function problemsToday(days: Record<string, DayRecord>, today = new Date()): number {
  return days[dateKey(today)]?.problems ?? 0;
}

/** Whole days since the last day with any practice (0 = today). Undefined if never practiced. */
export function daysAway(days: Record<string, DayRecord>, today = new Date()): number | undefined {
  const last = Object.keys(days)
    .filter((k) => (days[k]?.problems ?? 0) > 0)
    .sort()
    .at(-1);
  if (!last) return undefined;
  return Math.round((parse(dateKey(today)).getTime() - parse(last).getTime()) / 86_400_000);
}

export type Comeback =
  | { kind: 'none' }
  /** A freeze covered the gap: the streak survived. */
  | { kind: 'frozen'; frozenDays: string[]; streak: number }
  /** The streak ended while you were away: gentle restart, never a guilt screen. */
  | { kind: 'restart'; daysAway: number; totalDays: number; longest: number; gentle: boolean };

/** Long breaks (more than this many days) start with an easier, review-only session. */
export const GENTLE_AFTER_DAYS = 7;

/** What to say when the learner opens the app after time away. */
export function comebackStatus(days: Record<string, DayRecord>, today = new Date()): Comeback {
  const away = daysAway(days, today);
  if (away === undefined || away < 2 || problemsToday(days, today) > 0) return { kind: 'none' };
  const r = streakReport(days, today);
  const since = dateKey(shift(today, -away));
  const recentFreezes = r.frozenDays.filter((k) => k > since);
  if (r.current > 0 && recentFreezes.length) return { kind: 'frozen', frozenDays: recentFreezes, streak: r.current };
  return { kind: 'restart', daysAway: away, totalDays: r.totalDays, longest: r.longest, gentle: away > GENTLE_AFTER_DAYS };
}
