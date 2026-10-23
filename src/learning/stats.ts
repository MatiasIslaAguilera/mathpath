// Numbers for the Stats page and the skill-tree map. Pure functions of Progress.

import { getSkill, hasSkill, SKILLS } from '../engine/registry';
import { TREE, type TreeNode } from '../skills/tree';
import { dateKey, emptySkill, type Progress } from '../storage/progress';
import { fragileReport, skillState, type SkillState } from './states';
import type { LearningEvent } from '../storage/events';
import type { Help } from './mastery';
import { MIN_SESSION, streakReport } from './streak';
import { lockedBy } from './unlock';

export interface SkillStats {
  id: string;
  title: string;
  state: SkillState;
  attempts: number;
  /** Solved with no help, out of all attempts (recent history). */
  unassistedAccuracy: number;
  /** Same, but only the first attempt of each day: the honest retention signal. */
  firstOfDayAccuracy: number;
  /** Share of attempts that used hints, guided mode, or a reveal. */
  helpRate: number;
  interpretationAccuracy?: number;
  fragile: boolean;
}

export function skillStats(p: Progress): SkillStats[] {
  return SKILLS.filter((s) => (p.skills[s.id]?.attempts ?? 0) > 0).map((s) => {
    const sp = p.skills[s.id] ?? emptySkill();
    const h = sp.history;
    const solo = (a: (typeof h)[number]) => a.correct && a.help === 'none';
    const first = h.filter((a) => a.firstOfDay);
    const share = (xs: typeof h, f: (a: (typeof h)[number]) => boolean) => (xs.length ? xs.filter(f).length / xs.length : 0);
    return {
      id: s.id,
      title: s.title,
      state: skillState(sp),
      attempts: sp.attempts,
      unassistedAccuracy: share(h, solo),
      firstOfDayAccuracy: share(first, solo),
      helpRate: share(h, (a) => a.help !== 'none'),
      interpretationAccuracy: sp.interpretation.total ? sp.interpretation.correct / sp.interpretation.total : undefined,
      fragile: fragileReport(sp).fragile,
    };
  });
}

/** Lowest unassisted accuracy among skills with enough attempts to judge (≥ 5). */
export function weakestSkills(p: Progress, n = 3): SkillStats[] {
  return skillStats(p)
    .filter((s) => s.attempts >= 5)
    .sort((a, b) => a.unassistedAccuracy - b.unassistedAccuracy || a.firstOfDayAccuracy - b.firstOfDayAccuracy)
    .slice(0, n);
}

export interface CountedItem {
  skillId: string;
  skillTitle: string;
  id: string;
  label: string;
  count: number;
}

const topCounts = (counts: Record<string, number>, n: number, label: (skillId: string, id: string) => string | undefined): CountedItem[] =>
  Object.entries(counts)
    .map(([key, count]) => {
      const [skillId, id] = key.split('/');
      const l = hasSkill(skillId) ? label(skillId, id) : undefined;
      return l ? { skillId, skillTitle: getSkill(skillId).title, id, label: l, count } : null;
    })
    .filter((x): x is CountedItem => !!x)
    .sort((a, b) => b.count - a.count)
    .slice(0, n);

export const topMisconceptions = (p: Progress, n = 5) => topCounts(p.misconceptionCounts, n, (s, id) => getSkill(s).misconceptions[id]?.name);
export const topMissedSteps = (p: Progress, n = 5) => topCounts(p.stepMisses, n, (s, id) => getSkill(s).stepLabels[id] ?? id);

export interface CalendarDay {
  date: string;
  problems: number;
  /** ≥ MIN_SESSION problems: counted for the streak. */
  counted: boolean;
  frozen: boolean;
  future: boolean;
}

/** The last `weeks` full weeks (Monday-first), ending with the week containing today. */
export function streakCalendar(p: Progress, weeks = 8, today = new Date()): CalendarDay[] {
  const frozen = new Set(streakReport(p.days, today).frozenDays);
  const todayKey = dateKey(today);
  // The Sunday that ends this week (weeks run Monday → Sunday).
  const sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ((7 - today.getDay()) % 7));
  const out: CalendarDay[] = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() - i);
    const key = dateKey(d);
    const problems = p.days[key]?.problems ?? 0;
    out.push({ date: key, problems, counted: problems >= MIN_SESSION, frozen: frozen.has(key), future: key > todayKey });
  }
  return out;
}

// ---------- skill-tree map ----------

export type TreeStatus = 'coming-soon' | 'locked' | SkillState;

export interface TreeItem {
  node: TreeNode;
  status: TreeStatus;
  /** Unmet built prerequisites (for "Unlocks after …"). */
  lockedBy: string[];
}

export interface TreeUnit {
  unit: string;
  items: TreeItem[];
}

export function treeView(p: Progress): { math: TreeUnit[]; econ: TreeUnit[]; gre: TreeUnit[] } {
  const units = (track: 'math' | 'econ' | 'gre') => {
    const out: TreeUnit[] = [];
    for (const node of TREE.filter((n) => n.track === track)) {
      let status: TreeStatus;
      let blockers: string[] = [];
      if (!hasSkill(node.id)) status = 'coming-soon';
      else {
        blockers = lockedBy(p, node.id);
        status = blockers.length ? 'locked' : skillState(p.skills[node.id] ?? emptySkill());
      }
      const unit = out.find((u) => u.unit === node.unit) ?? out[out.push({ unit: node.unit, items: [] }) - 1];
      unit.items.push({ node, status, lockedBy: blockers });
    }
    return out;
  };
  return { math: units('math'), econ: units('econ'), gre: units('gre') };
}

/** Progress through the master's-relevant tree (optional skills and the GRE track excluded). */
export function overallProgress(p: Progress) {
  const core = TREE.filter((n) => !n.optional && n.track !== 'gre');
  const states = core.filter((n) => hasSkill(n.id)).map((n) => skillState(p.skills[n.id] ?? emptySkill()));
  return {
    total: core.length,
    built: states.length,
    mastered: states.filter((s) => s === 'mastered').length,
    practiced: states.filter((s) => s === 'practiced' || s === 'check-pending' || s === 'mastered' || s === 'rusty').length,
  };
}

export interface DayActivity {
  date: string;
  problems: number;
}

/** Problems answered per day, oldest first, for Home's activity chart. */
export function dailyActivity(p: Progress, days = 14, today = new Date()): DayActivity[] {
  return Array.from({ length: days }, (_, i) => {
    const date = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1) + i));
    return { date, problems: p.days[date]?.problems ?? 0 };
  });
}

export interface WeekAccuracy {
  /** Monday of the week, YYYY-MM-DD. */
  weekOf: string;
  /** Unassisted attempts that week. */
  attempts: number;
  /** Share of unassisted attempts solved, or undefined for a week with none. */
  accuracy?: number;
}

/** One answered problem, from the event log (or from a pre-event-log baseline's history). */
export interface LoggedAttempt {
  ts: number;
  correct: boolean;
  help: Help;
}

/**
 * Every attempt in the log. Attempt events are complete; a baseline (progress from before the
 * event log) only carries each skill's capped recent history, which is all that survives of it.
 */
export function attemptLog(events: LearningEvent[]): LoggedAttempt[] {
  const out: LoggedAttempt[] = [];
  for (const e of events) {
    if (e.type === 'attempt') out.push({ ts: e.ts, correct: e.correct, help: e.help });
    else if (e.type === 'baseline') for (const sp of Object.values(e.progress.skills ?? {})) for (const a of sp.history ?? []) out.push({ ts: a.ts, correct: a.correct, help: a.help });
  }
  return out;
}

/**
 * Solo accuracy per calendar week (Monday start), oldest first: of the problems answered without
 * any help, the share solved. Helped attempts are left out entirely (not counted as misses), so
 * taking a hint never lowers the line.
 */
export function weeklyAccuracy(attempts: LoggedAttempt[], weeks = 8, today = new Date()): WeekAccuracy[] {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const starts = Array.from({ length: weeks }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * (weeks - 1 - i)));
  const tally = starts.map(() => ({ n: 0, ok: 0 }));
  for (const a of attempts) {
    if (a.help !== 'none') continue;
    let i = starts.length - 1;
    while (i >= 0 && a.ts < starts[i].getTime()) i--;
    if (i < 0) continue;
    tally[i].n++;
    if (a.correct) tally[i].ok++;
  }
  return starts.map((s, i) => ({ weekOf: dateKey(s), attempts: tally[i].n, accuracy: tally[i].n ? tally[i].ok / tally[i].n : undefined }));
}
