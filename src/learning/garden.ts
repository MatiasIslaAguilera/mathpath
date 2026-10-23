// Home's garden and its cat. Both are a picture of real learning state, never decoration:
// one plot per master's skill (the same set as `overallProgress`), its plant's growth is the
// skill's state, a thirsty plant is a review or memory check waiting today, and the cat's mood
// is today's progress. Nothing dies, plants never shrink, and the cat is never sad
// (PLAN §2.2: never punishing).

import { hasSkill } from '../engine/registry';
import { TREE } from '../skills/tree';
import { dateKey, emptySkill, type Progress } from '../storage/progress';
import { isGentleDay, todaysAgenda } from './session';
import { skillState } from './states';
import { MIN_SESSION, problemsToday, streakReport } from './streak';
import { lockedBy } from './unlock';

/** soil: not built yet · grass: locked · seed: open, not started · sprout → sapling → bud → bloom. */
export type Stage = 'soil' | 'grass' | 'seed' | 'sprout' | 'sapling' | 'bud' | 'bloom';

const ORDER: Stage[] = ['soil', 'grass', 'seed', 'sprout', 'sapling', 'bud', 'bloom'];
export const stageRank = (s: Stage) => ORDER.indexOf(s);

export interface Plot {
  id: string;
  title: string;
  stage: Stage;
  /** A review or memory check is waiting today. */
  thirsty: boolean;
  /** Mastered, but a later review slipped: the bloom has faded until it's reviewed again. */
  faded: boolean;
}

/** Waiting today, as the session will actually serve it: a gentle comeback day holds memory checks back. */
function waitingToday(p: Progress, now: Date): Set<string> {
  const agenda = todaysAgenda(p, now);
  return new Set(isGentleDay(p, now) ? agenda.reviewsDue : [...agenda.reviewsDue, ...agenda.retentionChecks]);
}

export function gardenPlots(p: Progress, now = new Date()): Plot[] {
  const waiting = waitingToday(p, now);
  return TREE.filter((n) => !n.optional && n.track !== 'gre').map((n) => {
    const sp = p.skills[n.id] ?? emptySkill();
    let stage: Stage;
    if (!hasSkill(n.id)) stage = 'soil';
    else if (lockedBy(p, n.id).length) stage = 'grass';
    else {
      const s = skillState(sp);
      stage = s === 'new' ? 'seed' : s === 'learning' ? 'sprout' : s === 'practiced' ? 'sapling' : s === 'check-pending' ? 'bud' : 'bloom';
    }
    return { id: n.id, title: n.title, stage, thirsty: waiting.has(n.id), faded: !!sp.rusty && !!sp.masteredAt };
  });
}

/**
 * Plants never shrink: a plot shows the highest stage it has reached (`seen`, remembered per
 * device). A skill that slips (practiced → learning) shows it as thirsty, not as a smaller plant.
 * Also returns the plots that grew since `seen`, which get the one grow animation.
 */
export function ratchet(plots: Plot[], seen: Record<string, Stage>): { plots: Plot[]; grew: Set<string>; seen: Record<string, Stage> } {
  const grew = new Set<string>();
  const next: Record<string, Stage> = { ...seen };
  const out = plots.map((pl) => {
    const before = seen[pl.id];
    // Locked/unbuilt plots aren't growth; only a planted stage is remembered.
    if (stageRank(pl.stage) < stageRank('sprout')) return pl;
    if (before && stageRank(before) >= stageRank(pl.stage)) return before === pl.stage ? pl : { ...pl, stage: before };
    grew.add(pl.id);
    next[pl.id] = pl.stage;
    return pl;
  });
  return { plots: out, grew, seen: next };
}

export function gardenSummary(plots: Plot[]) {
  const count = (...stages: Stage[]) => plots.filter((pl) => stages.includes(pl.stage)).length;
  return {
    bloom: count('bloom'),
    growing: count('sprout', 'sapling', 'bud'),
    thirsty: plots.filter((pl) => pl.thirsty).length,
    /** Open and ready to start (not locked, not unbuilt). */
    toPlant: count('seed'),
    total: plots.length,
  };
}

/** sleeping: nothing yet today · curious: started · content: today counts · happy: goal met. */
export type Mood = 'sleeping' | 'curious' | 'content' | 'happy';

export function catMood(p: Progress, onboarding = false, now = new Date()): Mood {
  if (onboarding) return 'curious';
  const today = problemsToday(p.days, now);
  if (today === 0) return 'sleeping';
  if (today >= p.settings.dailyGoal) return 'happy';
  return today >= MIN_SESSION ? 'content' : 'curious';
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One line for the cat's speech bubble: the next concrete thing, phrased as an offer, never a reproach. */
export function catSays(p: Progress, onboarding: boolean, now = new Date()): string {
  if (onboarding) return "Hi, I'm Pareto. Let's see what you already know.";
  const today = problemsToday(p.days, now);
  const goal = p.settings.dailyGoal;
  const waiting = waitingToday(p, now).size;
  if (today >= goal) return waiting ? `Goal done. ${plural(waiting, 'plant')} can wait till tomorrow.` : 'Goal done. The garden looks great today.';
  if (today >= MIN_SESSION) return `Today counts. ${plural(goal - today, 'more problem')} for the full goal.`;
  if (today > 0) return `${MIN_SESSION - today} more and today counts.`;
  if (isGentleDay(p, now)) return 'Welcome back. An easy warm-up is ready when you are.';
  const agenda = todaysAgenda(p, now);
  if (agenda.retentionChecks.length) return `A memory check is ready when you are.`;
  if (agenda.reviewsDue.length) return `${plural(agenda.reviewsDue.length, 'plant')} could use water when you're ready.`;
  return "A new session is ready when you are.";
}

export type WeekDot = { date: string; weekday: string; label: string; state: 'done' | 'frozen' | 'open' | 'today' };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The last seven days, oldest first, for the streak row. */
export function weekDots(p: Progress, now = new Date()): WeekDot[] {
  const frozen = new Set(streakReport(p.days, now).frozenDays);
  const todayKey = dateKey(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i);
    const key = dateKey(d);
    const done = (p.days[key]?.problems ?? 0) >= MIN_SESSION;
    const state = done ? 'done' : frozen.has(key) ? 'frozen' : key === todayKey ? 'today' : 'open';
    const name = key === todayKey ? 'Today' : DAY_NAMES[d.getDay()];
    const what = { done: 'practiced', frozen: 'covered by a streak freeze', today: 'not yet', open: 'not practiced' }[state];
    return { date: key, weekday: 'SMTWTFS'[d.getDay()], label: `${name}: ${what}`, state };
  });
}
