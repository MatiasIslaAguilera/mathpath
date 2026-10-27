// Builds a daily session (PLAN §2.2):
//   warm-up (likely success, never a skill awaiting its retention check)
//   → retention checks (cold: the first attempt of the day on that skill, unassisted, at the
//     level that earned it — 3 with a strong record, otherwise 4)
//   → ~70% current skill / ~30% review, interleaved; every 5th current item is a stretch, one
//     level up (every 3rd once recent solo accuracy is above the 75–85% band); one GRE item
//     mid-session, or two (the second a stretch) in sessions of 8+
//   → finisher (likely success)
// Reviews are FSRS-due skills (most-forgotten first), plus rusty and fragile skills. Until there
// are due reviews, the 30% explores other available skills. Once ≥ 3 skills are solid, review
// items hide which skill they are, so you have to recognize the method yourself.
// After a wrong answer or any help, a same-skill follow-up comes next; after a diagnosed
// misconception, one whose numbers set the same trap. Problems are generated lazily so
// difficulty adapts within the session.

import { getSkill, makeProblem, SKILLS, storyVariant } from '../engine/registry';
import { randomSeed } from '../engine/rng';
import type { Level, Problem } from '../engine/types';
import { dateKey, emptySkill, type Progress, type SkillProgress } from '../storage/progress';
import { nextLevel, pCorrect } from './mastery';
import type { SkillEvent } from './record';
import { isDue, retrievability, type StoredCard } from './scheduler';
import { fragileReport, isAboveTargetBand, isFoundation, isSolid, MASTERY_LEVEL, retentionCheckDue, skillState, workingLevel } from './states';
import { daysAway, GENTLE_AFTER_DAYS } from './streak';
import { unlockedSkills } from './unlock';

export type SlotKind = 'warmup' | 'current' | 'review' | 'retention' | 'gre' | 'finisher' | 'followup' | 'stretch';

export interface Slot {
  kind: Exclude<SlotKind, 'followup' | 'stretch'>;
  /** Fixed skill for retention slots. */
  skillId?: string;
  /** A current-skill (or GRE) item served one level above the working level. */
  stretch?: boolean;
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
  /** The misconception the miss matched: the follow-up should give it a chance to recur. */
  pendingTrap?: string;
  followUpsUsed: number;
  answered: number;
  correct: number;
  xp: number;
  events: SkillEvent[];
}

const MAX_FOLLOWUPS = 4;
/** Seeds tried for a follow-up that sets the same trap, before settling for any problem. */
const TRAP_TRIES = 100;
const MAX_RETENTION_CHECKS = 2;
/** Every STRETCH_EVERY-th current item (starting with the 3rd) is a stretch. */
const STRETCH_EVERY = 5;
/** Above the 75–85% band the working level is too easy: stretch more often (states.ts). */
const STRETCH_EVERY_ABOVE_BAND = 3;
/** No stretches until the rating has settled a little. */
const STRETCH_MIN_ATTEMPTS = 5;
/**
 * Sessions this long get a second GRE item, served as a stretch. Review 8: one GRE item a day
 * left gre-fractions-percents at level 1 after 32 attempts at 78-92% solo.
 */
const SECOND_GRE_FROM = 8;

/**
 * Turn slot kinds into slots, marking stretch items. A stretch lets the rating climb faster
 * (a solve one level up is worth more than one at the working level, a miss costs less) and
 * shows the next problem type before the learner is expected to be good at it.
 */
function toSlots(kinds: Slot['kind'][], every = STRETCH_EVERY): Slot[] {
  let current = 0;
  return kinds.map((kind) => (kind === 'current' && current++ % every === 2 ? { kind, stretch: true } : { kind }));
}

/** Stretch cadence for the session: every 3rd current item when the learner is above the band. */
const cadenceFor = (sp: SkillProgress) => (isAboveTargetBand(sp) ? STRETCH_EVERY_ABOVE_BAND : STRETCH_EVERY);

const skillOf = (p: Progress, id: string) => p.skills[id] ?? emptySkill();

/** Skills you can practice: prerequisites solid, or already started (learning/unlock.ts). */
export const availableSkills = (p: Progress) => unlockedSkills(p);

const isGre = (id: string) => getSkill(id).track === 'gre';
/** Math and econ: the master's path. GRE skills get their own daily slot instead. */
const coreSkills = (p: Progress) => availableSkills(p).filter((id) => !isGre(id));
const greSkills = (p: Progress) => availableSkills(p).filter(isGre);

/**
 * The skill to spend ~70% of the session on, in tree order: one you're still learning that isn't
 * yet a foundation (solid at level 2), else the next new one, else any you're learning, else one
 * that's practiced but not yet at mastery level. (Foundation and practiced skills keep climbing
 * toward level 4 and the retention check through reviews, so new material isn't held up.)
 */
export function pickCurrentSkill(p: Progress, candidates: string[]): string | undefined {
  const find = (ok: (id: string) => boolean) => candidates.find(ok);
  const state = (id: string) => skillState(skillOf(p, id));
  return (
    find((id) => state(id) === 'learning' && !isFoundation(skillOf(p, id))) ??
    find((id) => state(id) === 'new') ??
    find((id) => state(id) === 'learning') ??
    find((id) => state(id) === 'practiced')
  );
}

const recall = (card: StoredCard | undefined, now = new Date()) => (card ? retrievability(card, now) : 0);

export interface Agenda {
  reviewsDue: string[];
  retentionChecks: string[];
}

/**
 * Back after a long break: today's session is all review one level easier, and retention checks
 * wait for a normal day. Home's garden and cat use this too, so they never promise a check the
 * session won't serve.
 */
export function isGentleDay(p: Progress, now = new Date()): boolean {
  return (daysAway(p.days, now) ?? 0) > GENTLE_AFTER_DAYS && coreSkills(p).some((id) => skillOf(p, id).attempts > 0);
}

/** What's waiting today: shown on Home and used to build the session. */
export function todaysAgenda(p: Progress, now = new Date()): Agenda {
  const today = dateKey(now);
  const ids = coreSkills(p);
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
    const slots: Slot[] = [
      { kind: 'warmup' },
      ...toSlots(Array(n - 2).fill('current'), cadenceFor(skillOf(p, options.only))),
      { kind: 'finisher' },
    ];
    return { ...base, slots, currentSkill: options.only, reviewQueue: [], interleaved: false, only: options.only };
  }

  const available = coreSkills(p);
  const agenda = todaysAgenda(p, now);
  // One GRE question in every session (when any GRE skill is open), placed mid-session; two in a
  // session of SECOND_GRE_FROM or more (not on a gentle day), the second one a stretch.
  const greSlots: Slot[] = greSkills(p).length ? [{ kind: 'gre' }] : [];

  // After a long break: an all-review session one level easier, so coming back starts with wins.
  // Retention checks wait for a normal day (they'd be measuring the break, not the learning).
  const practiced = available.filter((id) => skillOf(p, id).attempts > 0);
  if (isGentleDay(p, now)) {
    const queue = [...practiced].sort((a, b) => recall(skillOf(p, a).fsrs, now) - recall(skillOf(p, b).fsrs, now));
    const reviews: Slot[] = Array.from({ length: Math.max(0, n - 2 - greSlots.length) }, () => ({ kind: 'review' as const }));
    const slots: Slot[] = [{ kind: 'warmup' }, ...reviews.slice(0, 1), ...greSlots, ...reviews.slice(1), { kind: 'finisher' }];
    return { ...base, slots, currentSkill: undefined, reviewQueue: queue, interleaved: false, gentle: true };
  }
  if (greSlots.length && n >= SECOND_GRE_FROM) greSlots.push({ kind: 'gre', stretch: true });
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

  const middle = Math.max(0, n - 2 - retention.length - greSlots.length);
  const reviews = !currentSkill ? middle : reviewQueue.length ? Math.round(middle * 0.3) : 0;
  const mid: Slot['kind'][] = [...Array(middle - reviews).fill('current'), ...Array(reviews).fill('review')];
  for (let i = mid.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [mid[i], mid[j]] = [mid[j], mid[i]];
  }
  const midSlots = toSlots(mid, cadenceFor(currentSkill ? skillOf(p, currentSkill) : emptySkill()));
  // GRE items spread evenly through the middle: at 1/2, or at 1/3 and 2/3.
  const cuts = greSlots.map((_, i) => Math.ceil((midSlots.length * (i + 1)) / (greSlots.length + 1)));
  const middleWithGre = [...midSlots];
  for (let g = greSlots.length - 1; g >= 0; g--) middleWithGre.splice(cuts[g], 0, greSlots[g]);
  return {
    ...base,
    slots: [
      { kind: 'warmup' },
      ...retention.map((skillId) => ({ kind: 'retention' as const, skillId })),
      ...middleWithGre,
      { kind: 'finisher' },
    ],
    currentSkill,
    reviewQueue,
    interleaved,
  };
}

const gentleLevel = (s: Session, level: Level) => (s.gentle ? (Math.max(1, level - 1) as Level) : level);

export const sessionDone = (s: Session) => s.index >= s.slots.length && !s.pendingFollowUp;

/** A warm-up or finisher should be a likely win. */
const EASY_MIN_P = 0.8;

/**
 * Warm-up and finisher: a likely win, rotated. Among skills you'd likely solve, the one seen
 * least recently, one level below its working level (at the working level once you're above the
 * 75–85% band, where one below is a giveaway). With no likely win, the most likely one. Always
 * taking the most likely one served the same fastest skill at level 1 in every session (review 6:
 * 45 level-1 exponent-rules items in 6 days, 100% correct, and the skill never climbed).
 */
function easiest(p: Progress, ids: string[], gentle: boolean): { id: string; level: Level } {
  const options = ids.map((id) => {
    const s = skillOf(p, id);
    const working = workingLevel(s);
    const level = (!gentle && isAboveTargetBand(s) ? working : Math.max(1, working - 1)) as Level;
    return { id, level, prob: s.attempts ? pCorrect(s.rating, level) : 0, seen: s.history.at(-1)?.ts ?? 0 };
  });
  const likely = options.filter((o) => o.prob >= EASY_MIN_P);
  if (likely.length) return likely.reduce((a, b) => (b.seen < a.seen ? b : a));
  return options.reduce((a, b) => (b.prob > a.prob ? b : a));
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
  /** Practice items may be stories (about half, where the skill has them); `plain` for warm-ups, finishers, checks. */
  const make = (id: string, level: Level, plain = false, sd = seed) => {
    const skill = SKILLS.find((k) => k.id === id)!;
    return makeProblem(skill, level, sd, plain ? undefined : storyVariant(skill, level, sd));
  };
  const today = dateKey(now);

  if (s.pendingFollowUp) {
    const id = s.pendingFollowUp;
    const working = gentleLevel(s, workingLevel(skillOf(p, id)));
    // A follow-up after the finisher is the session's last problem: keep it gentle.
    const level = (s.index >= s.slots.length ? Math.max(1, working - 1) : working) as Level;
    // Review 8: after three "added 4ac" misses with c < 0, every follow-up drew c > 0, where the
    // mistake can't happen, so a correct follow-up proved nothing.
    let problem = make(id, level);
    for (let i = 0; s.pendingTrap && i < TRAP_TRIES && !problem.misconceptions.some((m) => m.id === s.pendingTrap); i++) {
      problem = make(id, level, false, randomSeed());
    }
    return { session: { ...s, pendingFollowUp: undefined, pendingTrap: undefined }, next: { problem, kind: 'followup', hideSkill: false } };
  }

  const slot = s.slots[s.index];
  const advanced: Session = { ...s, index: s.index + 1 };
  const pendingChecks = s.slots.slice(s.index).filter((x) => x.kind === 'retention').map((x) => x.skillId!);
  const pool = [...new Set([s.currentSkill, ...s.reviewQueue, ...(s.only ? [s.only] : [])])].filter((id): id is string => !!id);
  const practiced = pool.filter((id) => skillOf(p, id).attempts > 0 && !pendingChecks.includes(id));

  switch (slot.kind) {
    case 'warmup':
    case 'finisher': {
      const { id, level } = easiest(p, practiced.length ? practiced : [s.only ?? s.currentSkill ?? pool[0]], s.gentle);
      return { session: advanced, next: { problem: make(id, level, true), kind: slot.kind, hideSkill: false } };
    }
    case 'retention': {
      const id = slot.skillId!;
      const sp = skillOf(p, id);
      if (sp.lastPracticed === today) {
        // Already touched today, so it can't be a cold check: skip it (it stays due for tomorrow).
        return nextProblem(advanced, p, now);
      }
      // Serve the check at the level that earned it (3 or 4), or the working level if higher now.
      const earned = sp.readyLevel ?? MASTERY_LEVEL;
      const level = (Math.max(earned, nextLevel(sp.rating)) as Level);
      return { session: advanced, next: { problem: make(id, level, true), kind: 'retention', hideSkill: s.interleaved } };
    }
    case 'current': {
      const id = s.currentSkill ?? s.reviewQueue[0];
      const sp = skillOf(p, id);
      const working = gentleLevel(s, workingLevel(sp));
      const stretch = !!slot.stretch && !s.gentle && !sp.rusty && working < 5 && sp.attempts >= STRETCH_MIN_ATTEMPTS;
      const level = (stretch ? working + 1 : working) as Level;
      return { session: advanced, next: { problem: make(id, level), kind: stretch ? 'stretch' : 'current', hideSkill: false } };
    }
    case 'gre': {
      const id = pickGreSkill(p, now);
      if (!id) return nextProblem(advanced, p, now);
      const sp = skillOf(p, id);
      const working = gentleLevel(s, workingLevel(sp));
      const stretch = !!slot.stretch && !s.gentle && !sp.rusty && working < 5 && sp.attempts >= STRETCH_MIN_ATTEMPTS;
      return { session: advanced, next: { problem: make(id, (stretch ? working + 1 : working) as Level), kind: 'gre', hideSkill: false } };
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

/**
 * Today's GRE skill: a due GRE review first (most forgotten), else the GRE skill you're learning,
 * else the next new one, else the weakest. Undefined if no GRE skill is open.
 */
export function pickGreSkill(p: Progress, now = new Date()): string | undefined {
  const ids = greSkills(p);
  if (!ids.length) return undefined;
  const today = dateKey(now);
  const due = ids
    .filter((id) => {
      const sp = skillOf(p, id);
      return sp.attempts > 0 && sp.lastPracticed !== today && (!sp.fsrs || isDue(sp.fsrs, now) || sp.rusty);
    })
    .sort((a, b) => recall(skillOf(p, a).fsrs, now) - recall(skillOf(p, b).fsrs, now));
  return due[0] ?? pickCurrentSkill(p, ids) ?? [...ids].sort((a, b) => skillOf(p, a).rating - skillOf(p, b).rating)[0];
}

/**
 * Call after each finished problem. Queues a same-skill follow-up after a miss or any help,
 * aimed at `misconception` (the one the miss matched) when there is one.
 */
export function afterProblem(
  s: Session,
  problem: Problem,
  correct: boolean,
  needsFollowUp: boolean,
  xp: number,
  events: SkillEvent[] = [],
  misconception?: string,
): Session {
  const next = { ...s, answered: s.answered + 1, correct: s.correct + (correct ? 1 : 0), xp: s.xp + xp, events: [...s.events, ...events] };
  if (needsFollowUp && next.followUpsUsed < MAX_FOLLOWUPS) {
    next.pendingFollowUp = problem.skillId;
    next.pendingTrap = misconception;
    next.followUpsUsed += 1;
  }
  return next;
}
