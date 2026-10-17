import { describe, expect, it } from 'vitest';
import { makeProblem } from '../src/engine/registry';
import { linearEquations } from '../src/skills/math/linear-equations';
import { prefilledSteps } from '../src/learning/fading';
import { INITIAL_RATING, nextLevel, pCorrect, skillStatus, updateRating } from '../src/learning/mastery';
import { recordAttempt } from '../src/learning/record';
import { afterProblem, nextProblem, sessionDone, startSession } from '../src/learning/session';
import { currentStreak, totalPracticeDays } from '../src/learning/streak';
import { xpFor } from '../src/learning/scoring';
import { parseProgressFile, serializeProgress } from '../src/storage/exportImport';
import { emptyProgress, emptySkill, migrate, ProgressFormatError } from '../src/storage/progress';

describe('mastery rating', () => {
  it('starts at level 1 and climbs with unassisted success', () => {
    let r = INITIAL_RATING;
    expect(nextLevel(r)).toBe(1);
    for (let i = 0; i < 16; i++) r = updateRating(r, i, nextLevel(r), true, 'none');
    expect(nextLevel(r)).toBeGreaterThanOrEqual(4);
    expect(skillStatus(r, 16)).toBe('practiced');
  });

  it('a hinted solve never raises the rating', () => {
    for (const r of [-2, 0, 1.5]) expect(updateRating(r, 3, 2, true, 'hint')).toBeLessThanOrEqual(r);
  });

  it('wrong answers and guided mode lower the rating', () => {
    expect(updateRating(0, 3, 3, false, 'none')).toBeLessThan(0);
    expect(updateRating(0, 3, 3, false, 'guided')).toBeLessThan(0);
  });

  it('chosen level keeps predicted success at or above 75% when possible', () => {
    for (let r = -0.75; r <= 4; r += 0.25) expect(pCorrect(r, nextLevel(r))).toBeGreaterThanOrEqual(0.75);
    // Below that, even level 1 is hard: stay at level 1.
    expect(nextLevel(-1.5)).toBe(1);
  });
});

describe('fading', () => {
  it('shows more worked steps when mastery is low, always leaves one for the learner', () => {
    expect(prefilledSteps(5, -3)).toBe(4);
    expect(prefilledSteps(5, 4)).toBe(0);
    for (let r = -3; r <= 4; r += 0.5) {
      expect(prefilledSteps(4, r)).toBeLessThanOrEqual(3);
      expect(prefilledSteps(4, r + 0.5)).toBeLessThanOrEqual(prefilledSteps(4, r));
    }
  });
});

describe('scoring', () => {
  it('follows the help rules', () => {
    expect(xpFor(3, true, 'none')).toBe(30);
    expect(xpFor(3, true, 'hint')).toBe(15);
    expect(xpFor(3, true, 'guided')).toBe(0);
    expect(xpFor(3, false, 'none')).toBe(0);
  });
});

describe('recording attempts', () => {
  const problem = makeProblem(linearEquations, 2, 5);

  it('guided problems still count toward the daily goal and log missed steps', () => {
    const now = new Date(2026, 9, 17, 9);
    const { progress, xp } = recordAttempt(emptyProgress(), { problem, correct: true, help: 'guided', hintsUsed: 0, missedSteps: ['collect'] }, now);
    expect(xp).toBe(0);
    expect(progress.days['2026-10-17'].problems).toBe(1);
    expect(progress.mistakes[0]).toMatchObject({ kind: 'guided', missedSteps: ['collect'] });
    expect(progress.stepMisses['linear-equations/collect']).toBe(1);
  });

  it('logs misconceptions and marks first attempt of the day', () => {
    const now = new Date(2026, 9, 17, 9);
    let { progress } = recordAttempt(emptyProgress(), { problem, correct: false, help: 'none', hintsUsed: 0, input: '3', misconception: 'sign-constant', missedSteps: [] }, now);
    ({ progress } = recordAttempt(progress, { problem, correct: true, help: 'none', hintsUsed: 0, missedSteps: [] }, now));
    expect(progress.misconceptionCounts['linear-equations/sign-constant']).toBe(1);
    const h = progress.skills['linear-equations'].history;
    expect(h.map((a) => a.firstOfDay)).toEqual([true, false]);
  });
});

describe('streaks', () => {
  const day = (problems: number) => ({ problems, xp: 0 });
  it('counts days with at least 3 problems, ending today or yesterday', () => {
    const days = { '2026-10-14': day(5), '2026-10-15': day(3), '2026-10-16': day(10) };
    expect(currentStreak(days, new Date(2026, 9, 17))).toBe(3); // today not done yet: streak still alive
    expect(currentStreak({ ...days, '2026-10-17': day(3) }, new Date(2026, 9, 17))).toBe(4);
    expect(currentStreak({ ...days, '2026-10-15': day(2) }, new Date(2026, 9, 17))).toBe(1);
    expect(totalPracticeDays({ ...days, '2026-10-01': day(1) })).toBe(3);
  });
});

describe('session builder', () => {
  it('has warm-up, ~70/30 middle, finisher; follow-ups after help come next', () => {
    // Linear equations practiced, so the skills that build on it unlock.
    const base = emptyProgress();
    base.skills['linear-equations'] = { ...emptySkill(), rating: 1.5, attempts: 5, lastPracticed: '2026-01-01' };
    let s = startSession(base, 10, { random: () => 0.3 });
    expect(s.currentSkill).not.toBe('linear-equations'); // practiced: move on to something new
    expect(base.skills[s.currentSkill!]).toBeUndefined();
    expect(s.slots[0].kind).toBe('warmup');
    expect(s.slots.at(-1)!.kind).toBe('finisher');
    expect(s.slots.filter((k) => k.kind === 'review').length).toBe(2);
    const p = emptyProgress();
    const first = nextProblem(s, p)!;
    s = afterProblem(first.session, first.next.problem, false, true, 0);
    const follow = nextProblem(s, p)!;
    expect(follow.next.kind).toBe('followup');
    expect(follow.next.problem.skillId).toBe(first.next.problem.skillId);
  });

  it('terminates', () => {
    let s = startSession(emptyProgress(), 5);
    let n = 0;
    while (!sessionDone(s)) {
      const r = nextProblem(s, emptyProgress())!;
      s = afterProblem(r.session, r.next.problem, true, false, 10);
      n++;
    }
    expect(n).toBe(5);
  });
});

describe('progress storage', () => {
  it('round-trips through export/import', () => {
    const { progress } = recordAttempt(emptyProgress(), { problem: makeProblem(linearEquations, 1, 1), correct: true, help: 'none', hintsUsed: 0, missedSteps: [] });
    expect(parseProgressFile(serializeProgress(progress))).toEqual(progress);
  });

  it('rejects files that are not progress files', () => {
    expect(() => parseProgressFile('not json')).toThrow(ProgressFormatError);
    expect(() => parseProgressFile('{"version": 99}')).toThrow(/version/);
    expect(() => migrate({ version: 1, skills: { x: { rating: 'a' } }, days: {}, mistakes: [] })).toThrow(/invalid/);
  });

  it('fills in fields missing from older files', () => {
    const p = migrate({ version: 1, skills: {}, days: {}, mistakes: [] });
    expect(p.settings.dailyGoal).toBe(10);
    expect(p.stepMisses).toEqual({});
  });
});
