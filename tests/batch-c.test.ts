import { describe, expect, it } from 'vitest';
import { activePrerequisites, getSkill, makeProblem, SKILLS } from '../src/engine/registry';
import { recordAttempt } from '../src/learning/record';
import { nextProblem, startSession } from '../src/learning/session';
import { overallProgress, skillStats, streakCalendar, topMissedSteps, topMisconceptions, treeView, weakestSkills } from '../src/learning/stats';
import { comebackStatus, daysAway, MAX_FREEZES, streakReport } from '../src/learning/streak';
import { linearEquations } from '../src/skills/math/linear-equations';
import { TREE } from '../src/skills/tree';
import { emptyProgress, emptySkill, type DayRecord } from '../src/storage/progress';

const D = (d: number) => new Date(2026, 9, d, 12); // October 2026
const key = (d: number) => `2026-10-${String(d).padStart(2, '0')}`;
/** Days in October with the given problem counts. */
const days = (spec: Record<number, number>): Record<string, DayRecord> =>
  Object.fromEntries(Object.entries(spec).map(([d, n]) => [key(Number(d)), { problems: n, xp: 0 }]));
const run = (from: number, to: number, n = 5) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, n]));

describe('streaks and freezes', () => {
  it('earns a freeze every 7 days and uses it on a missed day', () => {
    const r = streakReport(days({ ...run(1, 7), ...run(9, 10) }), D(10));
    expect(r.frozenDays).toEqual([key(8)]);
    expect(r.current).toBe(9); // 7 + 2; the frozen day bridges but doesn't count
    expect(r.freezes).toBe(0);
    expect(r.breaks).toEqual([]);
  });

  it('breaks the streak when no freeze is left', () => {
    const r = streakReport(days({ ...run(1, 3), ...run(5, 6) }), D(6));
    expect(r.breaks).toEqual([key(4)]);
    expect(r.current).toBe(2);
    expect(r.longest).toBe(3);
  });

  it('holds at most 2 freezes and never spends one without a streak', () => {
    const r = streakReport(days(run(1, 28)), D(28));
    expect(r.freezes).toBe(MAX_FREEZES);
    const idle = streakReport(days({ 1: 1, 20: 5 }), D(20)); // a 1-problem day isn't a streak
    expect(idle.frozenDays).toEqual([]);
  });

  it('today never breaks anything, and short days do not count', () => {
    expect(streakReport(days(run(1, 5)), D(6)).current).toBe(5);
    expect(streakReport(days({ ...run(1, 5), 6: 2 }), D(7)).breaks).toEqual([key(6)]);
  });

  it('weekly consistency and totals', () => {
    const r = streakReport(days({ 1: 5, 3: 5, 5: 5, 8: 5 }), D(8));
    expect(r.totalDays).toBe(4);
    expect(r.lastSevenDays).toBe(3); // the 3rd, 5th, and 8th fall in Oct 2–8
  });
});

describe('welcome back', () => {
  it('says nothing after a normal day off', () => {
    expect(comebackStatus(days(run(1, 5)), D(6)).kind).toBe('none');
  });
  it('reports a freeze that saved the streak', () => {
    const c = comebackStatus(days(run(1, 7)), D(9));
    expect(c).toMatchObject({ kind: 'frozen', frozenDays: [key(8)], streak: 7 });
  });
  it('offers a gentle restart after a broken streak, without losing totals', () => {
    const c = comebackStatus(days(run(1, 3)), D(6));
    expect(c).toMatchObject({ kind: 'restart', daysAway: 3, totalDays: 3, longest: 3, gentle: false });
    expect(comebackStatus(days(run(1, 3)), D(20))).toMatchObject({ kind: 'restart', gentle: true });
  });
  it('counts days away from the last practice', () => {
    expect(daysAway(days({ 3: 1 }), D(10))).toBe(7);
    expect(daysAway({}, D(10))).toBeUndefined();
  });
});

describe('gentle comeback session', () => {
  it('is review-only, one level easier, with no retention checks', () => {
    const p = emptyProgress();
    p.days = days({ 1: 5 });
    p.skills['linear-equations'] = { ...emptySkill(), rating: 1.5, attempts: 10, lastPracticed: key(1), readyAt: key(1), retentionDue: key(4) };
    const now = D(20);
    const s = startSession(p, 5, { now });
    expect(s.gentle).toBe(true);
    // Review only (plus the daily GRE question), no current skill, no retention checks.
    expect(s.slots.map((x) => x.kind)).toEqual(['warmup', 'review', 'gre', 'review', 'finisher']);
    let r = nextProblem(s, p, now)!;
    r = nextProblem(r.session, p, now)!;
    expect(r.next.kind).toBe('review');
    expect(r.next.problem.level).toBe(2); // working level 3, minus one
  });
});

describe('stats', () => {
  it('computes accuracy, weakest skills, and top mistakes', () => {
    let p = emptyProgress();
    const problem = makeProblem(linearEquations, 2, 1);
    for (let i = 0; i < 6; i++) {
      ({ progress: p } = recordAttempt(
        p,
        { problem, correct: i % 3 === 0, help: i === 1 ? 'hint' : 'none', hintsUsed: 0, misconception: i % 3 ? 'sign-constant' : undefined, missedSteps: i === 1 ? ['collect'] : [] },
        D(1),
      ));
    }
    const [s] = skillStats(p);
    expect(s.attempts).toBe(6);
    expect(s.unassistedAccuracy).toBeCloseTo(2 / 6);
    expect(s.helpRate).toBeCloseTo(1 / 6);
    expect(weakestSkills(p)[0].id).toBe('linear-equations');
    expect(topMisconceptions(p)[0]).toMatchObject({ id: 'sign-constant', count: 4, label: 'Moved a number without changing its sign' });
    expect(topMissedSteps(p)[0]).toMatchObject({ id: 'collect', label: 'Collect x-terms and numbers' });
  });

  it('calendar: 8 Monday-first weeks ending this Sunday, with frozen days marked', () => {
    const p = emptyProgress();
    p.days = days({ ...run(1, 7), 9: 5 });
    const cal = streakCalendar(p, 8, D(9)); // Oct 9, 2026 is a Friday
    expect(cal).toHaveLength(56);
    expect(cal.at(-1)!.date).toBe(key(11)); // Sunday
    expect(new Date(2026, 9, 11).getDay()).toBe(0);
    expect(cal.find((c) => c.date === key(8))!.frozen).toBe(true);
    expect(cal.find((c) => c.date === key(10))!.future).toBe(true);
  });
});

describe('skill-tree map', () => {
  it('shows every planned skill: built ones by state, the rest as coming soon', () => {
    const v = treeView(emptyProgress());
    const all = [...v.math, ...v.econ, ...v.gre].flatMap((u) => u.items);
    expect(all).toHaveLength(TREE.length);
    const by = (id: string) => all.find((i) => i.node.id === id)!;
    expect(by('linear-equations').status).toBe('new');
    expect(by('derivatives-power-rule').status).toBe('locked');
    expect(by('derivatives-power-rule').lockedBy.sort()).toEqual(activePrerequisites(getSkill('derivatives-power-rule')).sort());
    expect(by('kuhn-tucker').status).toBe('coming-soon');
  });

  it("overall progress counts the master's-relevant tree, excluding optional trig", () => {
    const p = emptyProgress();
    p.skills['linear-equations'] = { ...emptySkill(), attempts: 20, rating: 2, readyAt: key(1), masteredAt: key(4) };
    const o = overallProgress(p);
    expect(o.total).toBe(TREE.filter((n) => !n.optional && n.track !== 'gre').length); // the master's path: no trig, no GRE
    expect(o.built).toBe(SKILLS.filter((s) => s.track !== 'gre' && !TREE.find((n) => n.id === s.id)!.optional).length);
    expect(o.mastered).toBe(1);
  });
});

describe('daily GRE question', () => {
  it('every session has exactly one GRE slot, mid-session, and it serves a GRE skill', async () => {
    const { startSession, nextProblem } = await import('../src/learning/session');
    const { getSkill } = await import('../src/engine/registry');
    for (const goal of [3, 5, 10, 15]) {
      const s = startSession(emptyProgress(), goal);
      const kinds = s.slots.map((x) => x.kind);
      expect(kinds.filter((k) => k === 'gre'), `goal ${goal}`).toHaveLength(1);
      expect(kinds[0]).toBe('warmup');
      expect(kinds.at(-1)).toBe('finisher');
      expect(s.slots).toHaveLength(Math.max(3, goal));
      let r = nextProblem(s, emptyProgress());
      let sawGre = false;
      while (r) {
        if (r.next.kind === 'gre') {
          sawGre = true;
          expect(getSkill(r.next.problem.skillId).track).toBe('gre');
        } else {
          expect(getSkill(r.next.problem.skillId).track, r.next.kind).not.toBe('gre');
        }
        r = nextProblem(r.session, emptyProgress());
      }
      expect(sawGre).toBe(true);
    }
  });
});
