// Builds a daily session (PLAN §2.2):
//   warm-up (likely success, never a skill awaiting its retention check)
//   → retention checks (cold: the first attempt of the day on that skill, unassisted, level ≥ 4)
//   → ~70% current skill / ~30% review, interleaved
//   → finisher (likely success)
// Reviews are FSRS-due skills (most-forgotten first), plus rusty and fragile skills. Until there
// are due reviews, the 30% explores other available skills. Once ≥ 3 skills are solid, review
// items hide which skill they are, so you have to recognize the method yourself.
// After a wrong answer or any help, a same-skill follow-up comes next. Problems are generated
// lazily so difficulty adapts within the session.

import { makeProblem, SKILLS } from '../engine/registry';
import { randomSeed } from '../engine/rng';
import type { Level, Problem } from '../engine/types';
import { dateKey, emptySkill, type Progress } from '../storage/progress';
import { nextLevel, pCorrect } from './mastery';
import type { SkillEvent } from './record';
import { isDue, retrievability, type StoredCard } from './scheduler';
import { fragileReport, isSolid, MASTERY_LEVEL, retentionCheckDue, skillState, workingLevel } from './states';
import { daysAway, GENTLE_AFTER_DAYS } from './streak';
import { unlockedSkills } from './unlock';

export type SlotKind = 'warmup' | 'current' | 'review' | 'retention' | 'finisher' | 'followup';

export interface Slot {
  kind: Exclude<SlotKind, 'followup'>;
  /** Fixed skill for retention slots. */
  skillId?: string;
}

export interface Session {
  goal: number;
  slots: Slot[];
  currentSkill?: string;
  /** Due reviews in priority order, then other skills to explore. */
  reviewQueue: string[];
  reviewCursor: number;
  /** Hide skill names on review/retention items. */
  interleaved: boolean;
  /** Comeback after a long break: review only, one level easier. */
  gentle: boolean;
  only?: string;
  index: number;
  pendingFollowUp?: string;
  followUpsUsed: number;
  answered: number;
  correct: number;
  xp: number;
  events: SkillEvent[];
}

const MAX_FOLLOWUPS = 4;
const MAX_RETENTION_CHECKS = 2;

const skillOf = (p: Progress, id: string) => p.skills[id] ?? emptySkill();

/** Skills you can practice: prerequisites solid, or already started (learning/unlock.ts). */
export const availableSkills = (p: Progress) => unlockedSkills(p);

/**
 * The skill to spend ~70% of the session on, in tree order: one you're still learning, else the
 * next new one, else one that's practiced but not yet at mastery level. (Practiced skills keep
 * moving toward level 4 and the retention check through reviews, so new material isn't held up.)
 */
export function pickCurrentSkill(p: Progress, candidates: string[]): string | undefined {
  const inState = (s: string) => candidates.find((id) => skillState(skillOf(p, id)) === s);
  return inState('learning') ?? inState('new') ?? inState('practiced');
}

const recall = (card: StoredCard | undefined, now = new Date()) => (card ? retrievability(card, now) : 0);

export interface Agenda {
  reviewsDue: string[];
  retentionChecks: string[];
}

/** What's waiting today: shown on Home and used to build the session. */
export function todaysAgenda(p: Progress, now = new Date()): Agenda {
  const today = dateKey(now);
  const ids = availableSkills(p);
  const retentionChecks = ids.filter((id) => retentionCheckDue(skillOf(p, id), today));
  const due = ids
    .filter((id) => !retentionChecks.includes(id))
    .filter((id) => {
      const sp = skillOf(p, id);
      // No card yet (progress from before FSRS existed) counts as due.
      return (sp.attempts > 0 || !!sp.placedAt) && sp.lastPracticed !== today && (!sp.fsrs || isDue(sp.fsrs, now) || sp.rusty || fragileReport(sp).fragile);
    })
    .sort((a, b) => recall(skillOf(p, a).fsrs) - recall(skillOf(p, b).fsrs));
  return { reviewsDue: due, retentionChecks };
}

export function startSession(p: Progress, goal: number, options: { only?: string; random?: () => number; now?: Date } = {}): Session {
  const rand = options.random ?? Math.random;
  const now = options.now ?? new Date();
  const n = Math.max(3, goal);
  const base = { goal: n, index: 0, followUpsUsed: 0, answered: 0, correct: 0, xp: 0, events: [], reviewCursor: 0, gentle: false };

  if (options.only) {
    const slots: Slot[] = [{ kind: 'warmup' }, ...Array.from({ length: n - 2 }, () => ({ kind: 'current' as const })), { kind: 'finisher' }];
    return { ...base, slots, currentSkill: options.only, reviewQueue: [], interleaved: false, only: options.only };
  }

  const available = availableSkills(p);
  const agenda = todaysAgenda(p, now);

  // After a long break: an all-review session one level easier, so coming back starts with wins.
  // Retention checks wait for a normal day (they'd be measuring the break, not the learning).
  const practiced = available.filter((id) => skillOf(p, id).attempts > 0);
  if ((daysAway(p.days, now) ?? 0) > GENTLE_AFTER_DAYS && practiced.length) {
    const queue = [...practiced].sort((a, b) => recall(skillOf(p, a).fsrs, now) - recall(skillOf(p, b).fsrs, now));
    const slots: Slot[] = [{ kind: 'warmup' }, ...Array.from({ length: n - 2 }, () => ({ kind: 'review' as const })), { kind: 'finisher' }];
    return { ...base, slots, currentSkill: undefined, reviewQueue: queue, interleaved: false, gentle: true };
  }
  const retention = agenda.retentionChecks.slice(0, MAX_RETENTION_CHECKS);
  const currentSkill = pickCurrentSkill(
    p,
    available.filter((id) => !retention.includes(id)),
  );
  const explore = available.filter((id) => id !== currentSkill && !retention.includes(id) && !agenda.reviewsDue.includes(id));
  let reviewQueue = [...agenda.reviewsDue.filter((id) => id !== currentSkill), ...explore.filter((id) => skillOf(p, id).attempts > 0), ...explore.filter((id) => skillOf(p, id).attempts === 0)];
  // Everything mastered and nothing due: keep practicing anything (gently).
  if (!currentSkill && !reviewQueue.length) reviewQueue = available.filter((id) => !retention.includes(id));
  const interleaved = available.filter((id) => isSolid(skillState(skillOf(p, id)))).length >= 3;

  const middle = Math.max(0, n - 2 - retention.length);
  const reviews = !currentSkill ? middle : reviewQueue.length ? Math.round(middle * 0.3) : 0;
  const mid: Slot['kind'][] = [...Array(middle - reviews).fill('current'), ...Array(reviews).fill('review')];
  for (let i = mid.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [mid[i], mid[j]] = [mid[j], mid[i]];
  }
  return {
    ...base,
    slots: [{ kind: 'warmup' }, ...retention.map((skillId) => ({ kind: 'retention' as const, skillId })), ...mid.map((kind) => ({ kind })), { kind: 'finisher' }],
    currentSkill,
    reviewQueue,
    interleaved,
  };
}

const gentleLevel = (s: Session, level: Level) => (s.gentle ? (Math.max(1, level - 1) as Level) : level);

export const sessionDone = (s: Session) => s.index >= s.slots.length && !s.pendingFollowUp;

/** The skill/level with the highest predicted success, one level below its working level. */
function easiest(p: Progress, ids: string[]): { id: string; level: Level } {
  let best = { id: ids[0], level: 1 as Level, prob: -1 };
  for (const id of ids) {
    const s = skillOf(p, id);
    const level = Math.max(1, nextLevel(s.rating) - 1) as Level;
    const prob = s.attempts ? pCorrect(s.rating, level) : 0;
    if (prob > best.prob) best = { id, level, prob };
  }
  return best;
}

export interface NextUp {
  problem: Problem;
  kind: SlotKind;
  /** Don't show which skill this is (interleaved review): recognizing the method is the point. */
  hideSkill: boolean;
}

/** Returns the next problem and advances the session, or null when the session is done. */
export function nextProblem(s: Session, p: Progress, now = new Date()): { session: Session; next: NextUp } | null {
  if (sessionDone(s)) return null;
  const seed = randomSeed();
  const make = (id: string, level: Level) => makeProblem(SKILLS.find((k) => k.id === id)!, level, seed);
  const today = dateKey(now);

  if (s.pendingFollowUp) {
    const id = s.pendingFollowUp;
    const working = gentleLevel(s, workingLevel(skillOf(p, id)));
    // A follow-up after the finisher is the session's last problem: keep it gentle.
    const level = (s.index >= s.slots.length ? Math.max(1, working - 1) : working) as Level;
    return { session: { ...s, pendingFollowUp: undefined }, next: { problem: make(id, level), kind: 'followup', hideSkill: false } };
  }

  const slot = s.slots[s.index];
  const advanced: Session = { ...s, index: s.index + 1 };
  const pendingChecks = s.slots.slice(s.index).filter((x) => x.kind === 'retention').map((x) => x.skillId!);
  const pool = [...new Set([s.currentSkill, ...s.reviewQueue, ...(s.only ? [s.only] : [])])].filter((id): id is string => !!id);
  const practiced = pool.filter((id) => skillOf(p, id).attempts > 0 && !pendingChecks.includes(id));

  switch (slot.kind) {
    case 'warmup':
    case 'finisher': {
      const { id, level } = easiest(p, practiced.length ? practiced : [s.only ?? s.currentSkill ?? pool[0]]);
      return { session: advanced, next: { problem: make(id, level), kind: slot.kind, hideSkill: false } };
    }
    case 'retention': {
      const id = slot.skillId!;
      if (skillOf(p, id).lastPracticed === today) {
        // Already touched today, so it can't be a cold check: skip it (it stays due for tomorrow).
        return nextProblem(advanced, p, now);
      }
      const level = Math.max(MASTERY_LEVEL, nextLevel(skillOf(p, id).rating)) as Level;
      return { session: advanced, next: { problem: make(id, level), kind: 'retention', hideSkill: s.interleaved } };
    }
    case 'current': {
      const id = s.currentSkill ?? s.reviewQueue[0];
      return { session: advanced, next: { problem: make(id, gentleLevel(s, workingLevel(skillOf(p, id)))), kind: 'current', hideSkill: false } };
    }
    case 'review': {
      const queue = s.reviewQueue.length ? s.reviewQueue : [s.currentSkill!];
      const id = queue[s.reviewCursor % queue.length];
      return {
        session: { ...advanced, reviewCursor: s.reviewCursor + 1 },
        next: { problem: make(id, gentleLevel(s, workingLevel(skillOf(p, id)))), kind: 'review', hideSkill: s.interleaved },
      };
    }
  }
}

/** Call after each finished problem. Queues a same-skill follow-up after a miss or any help. */
export function afterProblem(s: Session, problem: Problem, correct: boolean, needsFollowUp: boolean, xp: number, events: SkillEvent[] = []): Session {
  const next = { ...s, answered: s.answered + 1, correct: s.correct + (correct ? 1 : 0), xp: s.xp + xp, events: [...s.events, ...events] };
  if (needsFollowUp && next.followUpsUsed < MAX_FOLLOWUPS) {
    next.pendingFollowUp = problem.skillId;
    next.followUpsUsed += 1;
  }
  return next;
}
