// Batch A: FSRS grading, the mastery state machine (retention check, rusty, recovered),
// fragile detection, and session building with due reviews / retention checks / interleaving.

import { Rating } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { makeProblem, SKILLS } from '../src/engine/registry';
import type { Level } from '../src/engine/types';
import type { Help } from '../src/learning/mastery';
import { recordAttempt, type SkillEvent } from '../src/learning/record';
import { gradeFor, isDue, reviewCard } from '../src/learning/scheduler';
import { nextProblem, startSession, todaysAgenda } from '../src/learning/session';
import { addDays, fragileReport, skillState } from '../src/learning/states';
import { supplyDemandEquilibrium } from '../src/skills/econ/supply-demand-equilibrium';
import { derivativesPowerRule } from '../src/skills/math/derivatives-power-rule';
import { linearEquations } from '../src/skills/math/linear-equations';
import { dateKey, emptyProgress, emptySkill, type Progress, type SkillProgress } from '../src/storage/progress';

const LIN = 'linear-equations';
const DER = 'derivatives-power-rule';
const SND = 'supply-demand-equilibrium';
const day = (d: number, hour = 9) => new Date(2026, 9, d, hour);

function attempt(p: Progress, when: Date, opts: { level?: Level; correct?: boolean; help?: Help; retentionCheck?: boolean; skill?: typeof linearEquations } = {}) {
  const problem = makeProblem(opts.skill ?? linearEquations, opts.level ?? 4, when.getTime() % 100000);
  return recordAttempt(p, { problem, correct: opts.correct ?? true, help: opts.help ?? 'none', hintsUsed: 0, missedSteps: [], retentionCheck: opts.retentionCheck }, when);
}
const types = (events: SkillEvent[]) => events.map((e) => e.type);

/** A synthetic unassisted attempt record; only history is read by the accuracy signals. */
const solve = (correct: boolean, i: number, level: Level = 3) => ({
  ts: i,
  problemId: `${LIN}:${level}:${i}`,
  level,
  correct,
  help: 'none' as Help,
  hintsUsed: 0,
  firstOfDay: false,
});

describe('FSRS scheduling', () => {
  it('grades only by outcome and help', () => {
    expect(gradeFor(true, 'none')).toBe(Rating.Good);
    expect(gradeFor(true, 'hint')).toBe(Rating.Hard);
    expect(gradeFor(true, 'guided')).toBe(Rating.Again);
    expect(gradeFor(false, 'none')).toBe(Rating.Again);
  });

  it('pushes the next review out after success and keeps it close after failure', () => {
    const now = day(1);
    const good = reviewCard(undefined, now, Rating.Good);
    const again = reviewCard(undefined, now, Rating.Again);
    expect(new Date(good.due).getTime()).toBeGreaterThan(new Date(again.due).getTime());
    expect(isDue(again, day(2))).toBe(true);
    // A second success spaces it out further than the first.
    const good2 = reviewCard(good, new Date(good.due), Rating.Good);
    const gap1 = new Date(good.due).getTime() - now.getTime();
    const gap2 = new Date(good2.due).getTime() - new Date(good.due).getTime();
    expect(gap2).toBeGreaterThan(gap1);
  });

  it('grades only the first attempt of the day', () => {
    let { progress } = attempt(emptyProgress(), day(1, 9));
    const after1 = progress.skills[LIN].fsrs!;
    ({ progress } = attempt(progress, day(1, 10), { correct: false }));
    expect(progress.skills[LIN].fsrs).toEqual(after1);
    ({ progress } = attempt(progress, day(2, 9), { correct: false }));
    expect(progress.skills[LIN].fsrs!.lapses + progress.skills[LIN].fsrs!.reps).toBeGreaterThan(after1.reps);
  });
});

describe('mastery state machine', () => {
  it('level-4 unassisted solve schedules a retention check 3 days later', () => {
    const { progress, events } = attempt(emptyProgress(), day(10), { level: 4 });
    const sp = progress.skills[LIN];
    expect(sp.readyAt).toBe('2026-10-10');
    expect(sp.retentionDue).toBe('2026-10-13');
    expect(skillState(sp)).toBe('check-pending');
    expect(types(events)).toContain('check-scheduled');
  });

  it('hinted or lower-level solves do not schedule it', () => {
    expect(attempt(emptyProgress(), day(10), { level: 4, help: 'hint' }).progress.skills[LIN].readyAt).toBeUndefined();
    expect(attempt(emptyProgress(), day(10), { level: 3 }).progress.skills[LIN].readyAt).toBeUndefined();
  });

  it('a level-3 solve starts the check when the recent solo record is strong (≥90% over 25)', () => {
    const p = emptyProgress();
    p.skills[LIN] = { ...emptySkill(), rating: 1.2, attempts: 25, history: Array.from({ length: 25 }, (_, i) => solve(true, i)) };
    const { progress, events } = attempt(p, day(10), { level: 3 });
    expect(progress.skills[LIN].readyAt).toBe('2026-10-10');
    expect(progress.skills[LIN].readyLevel).toBe(3);
    expect(types(events)).toContain('check-scheduled');
  });

  it('a level-3 solve with a weak recent record still waits for level 4', () => {
    const p = emptyProgress();
    const history = Array.from({ length: 25 }, (_, i) => solve(i >= 20, i)); // 80% solo
    p.skills[LIN] = { ...emptySkill(), rating: 1.2, attempts: 25, history };
    const { progress, events } = attempt(p, day(10), { level: 3 });
    expect(progress.skills[LIN].readyAt).toBeUndefined();
    expect(types(events)).not.toContain('check-scheduled');
  });

  it('passing the cold check masters the skill', () => {
    let { progress } = attempt(emptyProgress(), day(10), { level: 4 });
    const r = attempt(progress, day(13), { level: 4, retentionCheck: true });
    progress = r.progress;
    expect(types(r.events)).toContain('mastered');
    expect(skillState(progress.skills[LIN])).toBe('mastered');
  });

  it('failing the check reschedules it without punishment', () => {
    let { progress } = attempt(emptyProgress(), day(10), { level: 4 });
    const r = attempt(progress, day(13), { level: 4, correct: false, retentionCheck: true });
    progress = r.progress;
    expect(types(r.events)).toContain('check-failed');
    expect(progress.skills[LIN].retentionDue).toBe('2026-10-16');
    expect(progress.skills[LIN].retentionFails).toBe(1);
    expect(skillState(progress.skills[LIN])).toBe('check-pending');
  });

  it('a "check" that is not the first attempt of the day does not count', () => {
    let { progress } = attempt(emptyProgress(), day(10), { level: 4 });
    ({ progress } = attempt(progress, day(13, 8), { level: 2 }));
    const r = attempt(progress, day(13, 9), { level: 4, retentionCheck: true });
    expect(types(r.events)).not.toContain('mastered');
    expect(r.progress.skills[LIN].masteredAt).toBeUndefined();
  });

  it('mastered → rusty on a failed first-of-day review → recovered on a later solo success', () => {
    let { progress } = attempt(emptyProgress(), day(10), { level: 4 });
    ({ progress } = attempt(progress, day(13), { retentionCheck: true }));
    let r = attempt(progress, day(20), { correct: false });
    expect(types(r.events)).toContain('rusty');
    expect(skillState(r.progress.skills[LIN])).toBe('rusty');
    // Same day: no recovery (not a cold attempt).
    r = attempt(r.progress, day(20, 11));
    expect(skillState(r.progress.skills[LIN])).toBe('rusty');
    r = attempt(r.progress, day(22));
    expect(types(r.events)).toContain('recovered');
    expect(skillState(r.progress.skills[LIN])).toBe('mastered');
  });
});

describe('fragile detection', () => {
  const sp = (first: boolean[], later: boolean[]): SkillProgress => {
    const s = emptySkill();
    s.attempts = first.length + later.length;
    const rec = (correct: boolean, firstOfDay: boolean) => ({ ts: 0, problemId: 'x', level: 2 as Level, correct, help: 'none' as Help, hintsUsed: 0, firstOfDay });
    s.history = [...first.map((c) => rec(c, true)), ...later.map((c) => rec(c, false))];
    return s;
  };
  it('flags a big gap between first-of-day and later accuracy', () => {
    expect(fragileReport(sp([false, false, true], [true, true, true, true, true])).fragile).toBe(true);
    expect(fragileReport(sp([true, true, false], [true, true, true, true, false])).fragile).toBe(false);
  });
  it('needs enough data before judging', () => {
    expect(fragileReport(sp([false, false], [true, true, true, true, true])).fragile).toBe(false);
  });
});

describe('session building (batch A)', () => {
  function practicedProgress(): Progress {
    // All three skills practiced on Oct 10; linear also reached level 4 (check due Oct 13).
    let p = emptyProgress();
    p = attempt(p, day(10), { level: 4 }).progress;
    p = attempt(p, day(10), { level: 3, skill: makeSkill(DER) }).progress;
    p = attempt(p, day(10), { level: 3, skill: makeSkill(SND) }).progress;
    for (const id of [DER, SND]) p.skills[id].rating = 1.5; // solid
    p.skills[LIN].rating = 1.5;
    return p;
  }

  it('serves a check earned at level 3 at level 3', () => {
    const p = practicedProgress();
    p.skills[LIN].readyLevel = 3; // earned from a strong solo record, not a level-4 solve
    p.skills[LIN].rating = 1.2; // working level 3
    const now = day(13);
    const s = startSession(p, 10, { now, random: () => 0.5 });
    const warm = nextProblem(s, p, now)!;
    const check = nextProblem(warm.session, p, now)!;
    expect(check.next.kind).toBe('retention');
    expect(check.next.problem.level).toBe(3);
  });

  it('puts a due retention check right after a warm-up on a different skill', () => {
    const p = practicedProgress();
    const now = day(13);
    const s = startSession(p, 10, { now, random: () => 0.5 });
    expect(s.slots[1]).toEqual({ kind: 'retention', skillId: LIN });
    const warm = nextProblem(s, p, now)!;
    expect(warm.next.kind).toBe('warmup');
    expect(warm.next.problem.skillId).not.toBe(LIN);
    const check = nextProblem(warm.session, p, now)!;
    expect(check.next.kind).toBe('retention');
    expect(check.next.problem.skillId).toBe(LIN);
    expect(check.next.problem.level).toBeGreaterThanOrEqual(4);
  });

  it('hides the skill name on review items once 3 skills are solid', () => {
    const p = practicedProgress();
    const s = startSession(p, 10, { now: day(13) });
    expect(s.interleaved).toBe(true);
  });

  it('skips a retention check if the skill was already practiced today', () => {
    const p = practicedProgress();
    const now = day(13, 12);
    const s = startSession(p, 10, { now });
    p.skills[LIN].lastPracticed = dateKey(now); // practiced after the session was built
    let r = nextProblem(s, p, now)!; // warm-up
    r = nextProblem(r.session, p, now)!;
    expect(r.next.kind).not.toBe('retention');
  });

  it('lists due reviews, and treats skills from before FSRS existed as due', () => {
    const p = practicedProgress();
    delete p.skills[DER].fsrs;
    const agenda = todaysAgenda(p, day(30));
    expect(agenda.retentionChecks).toEqual([LIN]);
    expect(agenda.reviewsDue).toContain(DER);
    expect(agenda.reviewsDue).toContain(SND);
    expect(todaysAgenda(p, day(10)).reviewsDue).toEqual([]); // practiced today: nothing due
  });

  it('still builds a session when everything is mastered and nothing is due', () => {
    const p = practicedProgress();
    for (const { id } of SKILLS) {
      p.skills[id] ??= { ...emptySkill(), attempts: 10, rating: 2, lastPracticed: '2026-10-10' };
      p.skills[id].readyAt = '2026-10-10';
      p.skills[id].masteredAt = '2026-10-13';
      p.skills[id].fsrs = reviewCard(undefined, day(13), Rating.Easy);
    }
    const now = day(14);
    const s = startSession(p, 5, { now });
    expect(s.currentSkill).toBeUndefined();
    let r = nextProblem(s, p, now);
    let n = 0;
    while (r) {
      n++;
      r = nextProblem(r.session, p, now);
    }
    expect(n).toBe(5);
  });

  it('dates: addDays crosses month boundaries', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });
});

function makeSkill(id: string) {
  return id === DER ? derivativesPowerRule : supplyDemandEquilibrium;
}
