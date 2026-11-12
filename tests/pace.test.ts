// Pace and error handling (Nov 2026): a second skill in parallel, stuck skills, syllabus-weighted
// order, level-4 tries, test-out, the notebook, timed sessions, second tries, the 4:00 day.

import { describe, expect, it } from 'vitest';
import { getSkill, hasSkill, makeProblem } from '../src/engine/registry';
import type { Level } from '../src/engine/types';
import { MILESTONES, milestoneProgress, skillPriority } from '../src/learning/milestones';
import { recentMisses, redoItems } from '../src/learning/notebook';
import { paceLine, paceReport } from '../src/learning/pace';
import { applyPlacementEvent, testOutEvent } from '../src/learning/placement';
import { applyAttemptEvent, attemptEvent, graded, recordAttempt } from '../src/learning/record';
import { isDue } from '../src/learning/scheduler';
import { afterProblem, nextProblem, pickCurrentSkill, sessionDone, startSession, wrapUp, type Session } from '../src/learning/session';
import { dueForMasteryTry, isFoundation, isStuck, skillState } from '../src/learning/states';
import { daysThisWeek, problemsToday, streakReport } from '../src/learning/streak';
import { TREE } from '../src/skills/tree';
import { DAY_SHIFT_FROM, dayKey, emptyProgress, emptySkill, type AttemptRecord, type Progress } from '../src/storage/progress';

const LIN = 'linear-equations';
const COMP = 'function-composition';
const NOW = new Date(2026, 9, 20, 10);

const attempts = (id: string, level: Level, count: number, correct = true, from = NOW.getTime() - 30 * 86_400_000): AttemptRecord[] =>
  Array.from({ length: count }, (_, i) => ({ ts: from + i, problemId: `${id}:${level}:${i}`, level, correct, help: 'none' as const, hintsUsed: 0, firstOfDay: false }));

/** Practiced at level 3: every skill that only needs it is open. */
const practiced = (id: string) => ({ ...emptySkill(), rating: 1.5, held: 3 as Level, attempts: 30, lastPracticed: '2026-10-01', history: attempts(id, 3, 12) });

const serve = (p: Progress, s: Session, now = NOW) => {
  const out: { kind: string; skillId: string; level: number; traps: string[] }[] = [];
  while (!sessionDone(s)) {
    const r = nextProblem(s, p, now)!;
    out.push({ kind: r.next.kind, skillId: r.next.problem.skillId, level: r.next.problem.level, traps: r.next.problem.misconceptions.map((m) => m.id) });
    s = afterProblem(r.session, r.next.problem, true, false, 10);
  }
  return out;
};

describe('milestones and syllabus order', () => {
  const core = TREE.filter((n) => !n.optional && n.track !== 'gre').map((n) => n.id);

  it('every core tree skill belongs to exactly one milestone', () => {
    const listed = MILESTONES.flatMap((m) => m.skills);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...core].sort());
  });

  it('counts solid skills per milestone, and never calls one reached while a skill is unbuilt', () => {
    const p = emptyProgress();
    for (const id of core.filter(hasSkill)) p.skills[id] = practiced(id);
    for (const m of milestoneProgress(p)) {
      expect(m.solid).toBe(m.built);
      expect(m.reached).toBe(m.built === m.total);
    }
    expect(milestoneProgress(emptyProgress()).every((m) => m.solid === 0 && !m.reached)).toBe(true);
  });

  it('a skill that gates the calculus chain outranks a leaf', () => {
    expect(skillPriority('limits')).toBeGreaterThan(skillPriority('function-transformations'));
    expect(skillPriority('matrix-operations')).toBeGreaterThan(skillPriority('function-transformations'));
    expect(skillPriority('gre-integers')).toBe(0);
  });

  it('opens the highest-priority new skill, not the next one in tree order', () => {
    const p = emptyProgress();
    const open = ['function-transformations', 'geometric-series', 'limits', 'matrix-operations', 'supply-demand-equilibrium'];
    const best = [...open].sort((a, b) => skillPriority(b) - skillPriority(a))[0];
    expect(pickCurrentSkill(p, open)).toBe(best);
    expect(best).not.toBe('function-transformations');
    // A skill already being learned still comes first: finish what you started.
    p.skills['function-transformations'] = { ...emptySkill(), attempts: 4 };
    expect(pickCurrentSkill(p, open)).toBe('function-transformations');
  });
});

describe('a second skill in parallel', () => {
  it('pairs the current skill with one from another track and gives it about 40% of the current slots', () => {
    const p = emptyProgress();
    p.skills[LIN] = practiced(LIN);
    const s = startSession(p, 10, { now: NOW, random: () => 0.3 });
    expect(s.currentSkill).toBeDefined();
    expect(s.secondSkill).toBe('supply-demand-equilibrium');
    expect(getSkill(s.currentSkill!).track).toBe('math');
    const current = s.slots.filter((x) => x.kind === 'current');
    const second = current.filter((x) => x.second).length;
    expect(second).toBeGreaterThan(0);
    expect(second).toBeLessThan(current.length / 2 + 0.01);
    const served = serve(p, s).filter((x) => x.kind === 'current' || x.kind === 'stretch').map((x) => x.skillId);
    expect(served).toContain(s.currentSkill);
    expect(served).toContain('supply-demand-equilibrium');
    expect(s.reviewQueue).not.toContain(s.secondSkill);
  });

  it('has no second skill when only one thing is open', () => {
    const s = startSession(emptyProgress(), 10, { now: NOW });
    expect(s.currentSkill).toBe(LIN);
    expect(s.secondSkill).toBeUndefined();
    expect(s.slots.some((x) => x.second)).toBe(false);
  });
});

describe('stuck skills', () => {
  const stuckSkill = () => ({
    ...emptySkill(), rating: -0.7, held: 1 as Level, attempts: 45, lastPracticed: '2026-10-19',
    history: [...attempts(COMP, 1, 14), ...attempts(COMP, 1, 6, false)],
  });

  it('is 40+ attempts, not a foundation, and under 80% recently; slow but accurate is not stuck', () => {
    expect(isStuck(stuckSkill())).toBe(true);
    expect(isStuck({ ...stuckSkill(), attempts: 39 })).toBe(false);
    expect(isStuck({ ...stuckSkill(), history: attempts(COMP, 1, 20) })).toBe(false);
    const solid = { ...stuckSkill(), rating: 0.3, history: [...attempts(COMP, 2, 14), ...attempts(COMP, 2, 6, false)] };
    expect(isFoundation(solid)).toBe(true);
    expect(isStuck(solid)).toBe(false);
  });

  it('stops being the current skill and gets one trap-targeted item a session instead', () => {
    const p = emptyProgress();
    p.skills[LIN] = practiced(LIN);
    p.skills['functions-basics'] = practiced('functions-basics');
    p.skills[COMP] = stuckSkill();
    p.misconceptionCounts[`${COMP}/inner-only`] = 3;
    p.misconceptionCounts[`${COMP}/lost-inner-sign`] = 1;
    expect(getSkill(COMP).misconceptions['inner-only']).toBeDefined();
    const s = startSession(p, 10, { now: NOW, random: () => 0.3 });
    expect(s.currentSkill).not.toBe(COMP);
    expect(s.secondSkill).not.toBe(COMP);
    const fixed = s.slots.filter((x) => x.kind === 'review' && x.skillId === COMP);
    expect(fixed).toHaveLength(1);
    expect(fixed[0].trap).toBe('inner-only');
    const item = serve(p, s).find((x) => x.kind === 'review' && x.skillId === COMP)!;
    expect(item.traps).toContain('inner-only');
  });

  it('is still practiced when nothing else is open', () => {
    const p = emptyProgress();
    p.skills[COMP] = stuckSkill();
    expect(pickCurrentSkill(p, [COMP])).toBe(COMP);
  });
});

describe('a weekly level-4 try for practiced skills', () => {
  it('is due when a practiced skill at level 3 has seen no level-4 item for a week', () => {
    const sp = practiced(LIN);
    expect(skillState(sp)).toBe('practiced');
    expect(dueForMasteryTry(sp, NOW)).toBe(true);
    const recent: AttemptRecord = { ...attempts(LIN, 4, 1)[0], ts: NOW.getTime() - 2 * 86_400_000 };
    expect(dueForMasteryTry({ ...sp, history: [...sp.history, recent] }, NOW)).toBe(false);
    expect(dueForMasteryTry({ ...sp, history: [...sp.history, { ...recent, ts: NOW.getTime() - 8 * 86_400_000 }] }, NOW)).toBe(true);
    expect(dueForMasteryTry({ ...sp, readyAt: '2026-10-18' }, NOW)).toBe(false);
    expect(dueForMasteryTry({ ...sp, rating: 0.3, held: 2 }, NOW)).toBe(false);
  });

  it('is served in a review slot as a stretch at level 4', () => {
    const p = emptyProgress();
    p.skills[LIN] = practiced(LIN);
    const s = startSession(p, 10, { now: NOW, random: () => 0.3 });
    const served = serve(p, s);
    expect(served.some((x) => x.skillId === LIN && x.kind === 'stretch' && x.level === 4)).toBe(true);
  });
});

describe('test-out', () => {
  it('is two cold level-3 items with no follow-ups; passing places the skill without touching the placement record', () => {
    const p = emptyProgress();
    p.skills[LIN] = practiced(LIN);
    p.placement = { date: '2026-10-01', results: { [LIN]: 'passed' }, items: [] };
    let s = startSession(p, 2, { testOut: 'exponent-rules', now: NOW });
    expect(s.slots).toHaveLength(2);
    const first = nextProblem(s, p, NOW)!;
    expect(first.next.kind).toBe('testout');
    expect(first.next.problem).toMatchObject({ skillId: 'exponent-rules', level: 3 });
    expect(first.next.problem.variant).toBeUndefined();
    s = afterProblem(first.session, first.next.problem, false, true, 0, [], 'add-for-quotient');
    expect(s.pendingFollowUp).toBeUndefined();
    expect(nextProblem(s, p, NOW)!.next.kind).toBe('testout');

    applyPlacementEvent(p, testOutEvent('exponent-rules', NOW));
    expect(skillState(p.skills['exponent-rules'])).toBe('practiced');
    expect(isFoundation(p.skills['exponent-rules'])).toBe(true);
    expect(p.placement.results).toEqual({ [LIN]: 'passed' });
    expect(p.onboarding).toBeUndefined();
  });
});

describe('notebook', () => {
  const miss = (skillId: string, level: Level, daysAgo: number, misconception?: string, kind: 'wrong' | 'hint' = 'wrong') => ({
    ts: NOW.getTime() - daysAgo * 86_400_000, skillId, problemId: `${skillId}:${level}:1`, level, kind, input: '7', misconception, missedSteps: [],
  });

  it('lists recent wrong answers and redoes each kind of mistake once, newest first', () => {
    const p = emptyProgress();
    p.mistakes = [
      miss('quadratic-formula', 1, 20, 'neg-c-sign'), // too old
      miss('quadratic-formula', 1, 5, 'neg-c-sign'),
      miss('quadratic-formula', 1, 4, 'neg-c-sign'),
      miss(LIN, 2, 3),
      miss(LIN, 2, 2, undefined, 'hint'), // helped, not a wrong answer
      miss('no-such-skill', 1, 1),
    ];
    expect(recentMisses(p, NOW)).toHaveLength(3);
    expect(redoItems(p, 8, NOW)).toEqual([
      { skillId: LIN, level: 2, trap: undefined },
      { skillId: 'quadratic-formula', level: 1, trap: 'neg-c-sign' },
    ]);
  });

  it('builds a session of exactly those items, with the same trap set', () => {
    const p = emptyProgress();
    const redo = [{ skillId: 'quadratic-formula', level: 1 as Level, trap: 'neg-c-sign' }, { skillId: LIN, level: 2 as Level }];
    const s = startSession(p, redo.length, { redo, now: NOW });
    const served = serve(p, s);
    expect(served.map((x) => [x.kind, x.skillId, x.level])).toEqual([['redo', 'quadratic-formula', 1], ['redo', LIN, 2]]);
    expect(served[0].traps).toContain('neg-c-sign');
  });
});

describe('timed sessions', () => {
  it('plans enough slots to fill the time and skips to the finisher when it is up', () => {
    const p = emptyProgress();
    const s = startSession(p, 10, { minutes: 15, now: NOW });
    expect(s.timeLimitMs).toBe(15 * 60_000);
    expect(s.slots.length).toBe(30);
    const mid = { ...s, index: 4 };
    expect(wrapUp(mid, 14 * 60_000)).toBe(mid);
    const wrapped = wrapUp(mid, 15 * 60_000);
    expect(wrapped.index).toBe(s.slots.length - 1);
    expect(nextProblem(wrapped, p, NOW)!.next.kind).toBe('finisher');
    expect(wrapUp(wrapped, 99 * 60_000)).toBe(wrapped);
    // Sessions by count, and one-skill runs, never have a limit.
    expect(startSession(p, 10, { now: NOW }).timeLimitMs).toBeUndefined();
    expect(startSession(p, 5, { only: LIN, minutes: 15, now: NOW }).timeLimitMs).toBeUndefined();
  });
});

describe('a second try after a wrong answer', () => {
  const problem = makeProblem(getSkill(LIN), 2, 7);
  const base = { problem, help: 'none' as const, hintsUsed: 0, missedSteps: [], input: '99' };

  it('grades a fixed slip like a hinted solve: half XP, never a solo solve, never raises the rating', () => {
    expect(graded({ correct: false, help: 'none', fixedOnRetry: true })).toEqual({ correct: true, help: 'hint' });
    expect(graded({ correct: false, help: 'none', fixedOnRetry: false })).toEqual({ correct: false, help: 'none' });
    expect(graded({ correct: true, help: 'none' })).toEqual({ correct: true, help: 'none' });

    const start = emptyProgress();
    start.skills[LIN] = { ...emptySkill(), rating: 0.3, attempts: 10 };
    const fixed = recordAttempt(start, { ...base, correct: false, retry: { input: '4', correct: true } }, NOW);
    const wrong = recordAttempt(start, { ...base, correct: false, retry: { input: '5', correct: false } }, NOW);
    const solo = recordAttempt(start, { ...base, correct: true }, NOW);
    expect(fixed.logged).toMatchObject({ correct: false, input: '99', fixedOnRetry: true });
    expect(fixed.logged.retryInput).toBeUndefined();
    expect(wrong.logged).toMatchObject({ correct: false, input: '99', fixedOnRetry: false, retryInput: '5' });
    expect(fixed.xp).toBe(10);
    expect(wrong.xp).toBe(0);
    expect(solo.xp).toBe(20);
    expect(fixed.progress.skills[LIN].correctUnassisted).toBe(0);
    const rating = (r: typeof fixed) => r.progress.skills[LIN].rating;
    expect(rating(fixed)).toBeLessThanOrEqual(0.3);
    expect(rating(fixed)).toBeGreaterThan(rating(wrong));
    expect(rating(solo)).toBeGreaterThan(0.3);
    expect(fixed.progress.mistakes.at(-1)).toMatchObject({ kind: 'wrong', input: '99', fixed: true });
    expect(wrong.progress.mistakes.at(-1)!.fixed).toBeUndefined();
  });

  it('an event without the field replays exactly as before', () => {
    const a = emptyProgress();
    const b = emptyProgress();
    const e = attemptEvent({ ...base, correct: false }, NOW);
    applyAttemptEvent(a, e);
    applyAttemptEvent(b, { ...e, fixedOnRetry: undefined });
    expect(a).toEqual(b);
  });
});

describe('the learning day turns over at 4:00, from the cut-over on', () => {
  const after = new Date(DAY_SHIFT_FROM + 30 * 86_400_000);
  const at = (hour: number, minute = 0) => new Date(after.getFullYear(), after.getMonth(), after.getDate(), hour, minute);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(after.getFullYear(), after.getMonth(), after.getDate() - 1);

  it('1:30 at night still belongs to the day before; 4:00 starts the new one', () => {
    expect(dayKey(at(1, 30))).toBe(key(yesterday));
    expect(dayKey(at(3, 59))).toBe(key(yesterday));
    expect(dayKey(at(4, 0))).toBe(key(at(4)));
    expect(dayKey(at(23, 59))).toBe(key(at(4)));
  });

  it('events before the cut-over keep their midnight days', () => {
    expect(dayKey(new Date(2026, 9, 23, 1, 30))).toBe('2026-10-23');
  });

  it('a session that runs past midnight is one day: one first-of-day attempt, one streak day', () => {
    const problem = makeProblem(getSkill(LIN), 1, 3);
    const solve = { problem, correct: true, help: 'none' as const, hintsUsed: 0, missedSteps: [] };
    const late = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 50);
    let p = emptyProgress();
    for (const t of [late, at(0, 10), at(0, 20)]) ({ progress: p } = recordAttempt(p, solve, t));
    expect(Object.keys(p.days)).toEqual([key(yesterday)]);
    expect(p.days[key(yesterday)].problems).toBe(3);
    expect(p.skills[LIN].history.map((a) => a.firstOfDay)).toEqual([true, false, false]);
    expect(problemsToday(p.days, at(1))).toBe(3);
    expect(problemsToday(p.days, at(5))).toBe(0);
    expect(streakReport(p.days, at(1)).current).toBe(1);
    expect(daysThisWeek(p.days, at(1))).toBeGreaterThanOrEqual(1);
    // The review falls due late in the evening of some day X (the first answer was at 23:50).
    // At 2:00 on X it is still the day before, so not due; at 2:00 the next night it still is X.
    const card = p.skills[LIN].fsrs!;
    const due = new Date(card.due);
    expect(due.getHours()).toBe(23);
    expect(isDue(card, new Date(due.getFullYear(), due.getMonth(), due.getDate(), 2))).toBe(false);
    expect(isDue(card, new Date(due.getFullYear(), due.getMonth(), due.getDate(), 12))).toBe(true);
    expect(isDue(card, new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1, 2))).toBe(true);
  });
});

describe('pace toward the target date', () => {
  const core = TREE.filter((n) => !n.optional && n.track !== 'gre');

  it('counts solid core skills and projects the finish from the pace so far', () => {
    const p = emptyProgress();
    p.createdAt = new Date(NOW.getTime() - 28 * 86_400_000).toISOString();
    for (const id of [LIN, 'functions-basics', 'exponent-rules', 'gre-integers']) p.skills[id] = practiced(id);
    const r = paceReport(p, NOW);
    expect(r.total).toBe(core.length);
    expect(r.solid).toBe(3); // the GRE skill isn't core
    expect(r.perWeek).toBeCloseTo(0.75, 5);
    expect(r.projected! > '2026-10-20').toBe(true);
    expect(r.target).toBeUndefined();
    expect(paceLine(r)).toBeNull();
  });

  it('says what the target needs, without a pace in the first week', () => {
    const p = emptyProgress();
    p.createdAt = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
    p.skills[LIN] = practiced(LIN);
    p.settings.targetDate = '2027-08-16';
    const r = paceReport(p, NOW);
    expect(r.perWeek).toBeUndefined();
    expect(r.neededPerWeek).toBeCloseTo((core.length - 1) / r.weeksLeft!, 5);
    expect(paceLine(r)).toMatch(/a week reaches your target/);
  });

  it('is on pace only when the pace so far reaches the target', () => {
    const p = emptyProgress();
    p.createdAt = new Date(NOW.getTime() - 28 * 86_400_000).toISOString();
    for (const id of [LIN, 'functions-basics', 'exponent-rules']) p.skills[id] = practiced(id);
    p.settings.targetDate = '2026-12-01';
    expect(paceReport(p, NOW).onPace).toBe(false);
    p.settings.targetDate = '2029-01-01';
    const r = paceReport(p, NOW);
    expect(r.onPace).toBe(true);
    expect(paceLine(r)).toMatch(/^On pace/);
    p.settings.targetDate = '2026-01-01';
    expect(paceLine(paceReport(p, NOW))).toMatch(/Target date passed/);
  });
});
