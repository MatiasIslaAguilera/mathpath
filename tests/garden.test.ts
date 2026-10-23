import { describe, expect, it } from 'vitest';
import { hasSkill } from '../src/engine/registry';
import { catMood, catSays, gardenPlots, gardenSummary, ratchet, weekDots, type Plot } from '../src/learning/garden';
import { attemptLog, dailyActivity, overallProgress, weeklyAccuracy } from '../src/learning/stats';
import type { LearningEvent } from '../src/storage/events';
import { TREE } from '../src/skills/tree';
import { dateKey, emptyProgress, emptySkill, type AttemptRecord, type Progress } from '../src/storage/progress';

const NOW = new Date(2026, 9, 23, 12); // a Friday
const day = (offset: number) => dateKey(new Date(2026, 9, 23 + offset));

function withToday(problems: number): Progress {
  const p = emptyProgress();
  p.onboarding = 'skipped';
  if (problems) p.days[day(0)] = { problems, xp: 0 };
  return p;
}

describe('garden', () => {
  it('has one plot per master\'s skill, the same set overallProgress counts', () => {
    const plots = gardenPlots(emptyProgress(), NOW);
    expect(plots).toHaveLength(overallProgress(emptyProgress()).total);
    const core = TREE.filter((n) => !n.optional && n.track !== 'gre');
    expect(plots.filter((pl) => pl.stage === 'soil').map((pl) => pl.id)).toEqual(core.filter((n) => !hasSkill(n.id)).map((n) => n.id));
  });

  it('growth follows the skill state; a slipped mastered skill fades and is thirsty, never removed', () => {
    const p = withToday(0);
    p.skills['linear-equations'] = { ...emptySkill(), rating: -1.2, attempts: 5, lastPracticed: day(0) };
    let pl = gardenPlots(p, NOW).find((x) => x.id === 'linear-equations')!;
    expect(pl.stage).toBe('sprout');
    p.skills['linear-equations'] = { ...emptySkill(), rating: 2.4, attempts: 40, masteredAt: day(-10), rusty: true, lastPracticed: day(-2) };
    pl = gardenPlots(p, NOW).find((x) => x.id === 'linear-equations')!;
    expect(pl).toMatchObject({ stage: 'bloom', faded: true, thirsty: true });
    expect(gardenSummary(gardenPlots(p, NOW))).toMatchObject({ bloom: 1, thirsty: 1 });
    expect(gardenSummary(gardenPlots(p, NOW)).toPlant).toBe(gardenPlots(p, NOW).filter((x) => x.stage === 'seed').length);
  });
});

describe('cat', () => {
  it('mood is today\'s progress: asleep, curious, content at the streak minimum, happy at the goal', () => {
    expect(catMood(withToday(0), false, NOW)).toBe('sleeping');
    expect(catMood(withToday(1), false, NOW)).toBe('curious');
    expect(catMood(withToday(3), false, NOW)).toBe('content');
    expect(catMood(withToday(10), false, NOW)).toBe('happy');
    expect(catMood(withToday(0), true, NOW)).toBe('curious');
  });

  it('never reproaches', () => {
    for (const n of [0, 1, 2, 3, 9, 10, 25]) expect(catSays(withToday(n), false, NOW)).not.toMatch(/lost|broke|missed|fail|sad|only/i);
    expect(catSays(withToday(1), false, NOW)).toBe('2 more and today counts.');
    expect(catSays(withToday(0), false, NOW)).toMatch(/when you are/);
  });
});

describe('week dots and charts', () => {
  it('marks done, frozen and today over the last seven days', () => {
    const p = withToday(0);
    for (let o = -13; o <= -2; o++) if (o !== -3) p.days[day(o)] = { problems: 5, xp: 0 }; // 7+ days earns a freeze for -3
    const dots = weekDots(p, NOW);
    expect(dots.map((d) => d.weekday).join('')).toBe('SSMTWTF');
    expect(dots.map((d) => d.state)).toEqual(['done', 'done', 'done', 'frozen', 'done', 'open', 'today']);
  });

  it('dailyActivity is oldest first and ends today', () => {
    const p = withToday(4);
    p.days[day(-13)] = { problems: 9, xp: 0 };
    const a = dailyActivity(p, 14, NOW);
    expect(a).toHaveLength(14);
    expect(a[0]).toEqual({ date: day(-13), problems: 9 });
    expect(a[13]).toEqual({ date: day(0), problems: 4 });
  });

  it('weeklyAccuracy: of the unassisted answers, the share solved, by Monday-start week; helped answers are left out', () => {
    const p = withToday(0);
    const at = (offset: number, correct: boolean, help: AttemptRecord['help'] = 'none'): AttemptRecord => ({
      ts: new Date(2026, 9, 23 + offset, 10).getTime(),
      problemId: 'x',
      level: 1,
      correct,
      help,
      hintsUsed: 0,
      firstOfDay: false,
    });
    // This week starts Monday Oct 19 (offset -4); Sunday Oct 18 is last week.
    p.skills['linear-equations'] = { ...emptySkill(), attempts: 6, history: [at(-5, true), at(-4, true), at(-1, false), at(0, false, 'hint'), at(0, true, 'guided'), at(0, true)] };
    const baseline: LearningEvent = { id: 'b', ts: 0, type: 'baseline', progress: p };
    const w = weeklyAccuracy(attemptLog([baseline]), 8, NOW);
    expect(w).toHaveLength(8);
    // 3 unassisted this week (2 right); the hint miss and the guided solve don't count either way.
    expect(w[7]).toEqual({ weekOf: day(-4), attempts: 3, accuracy: 2 / 3 });
    expect(w[6]).toEqual({ weekOf: day(-11), attempts: 1, accuracy: 1 });
    expect(w[0].accuracy).toBeUndefined();
  });

  it('attemptLog reads attempt events in full (the per-skill history is capped)', () => {
    const events: LearningEvent[] = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      ts: new Date(2026, 9, 22, 10).getTime() + i,
      type: 'attempt',
      skillId: 'linear-equations',
      problemId: 'x',
      level: 1,
      correct: i % 4 !== 0,
      help: 'none',
      hintsUsed: 0,
      missedSteps: [],
    }));
    const w = weeklyAccuracy(attemptLog(events), 8, NOW);
    expect(w[7]).toMatchObject({ attempts: 100, accuracy: 0.75 });
  });
});

describe('honesty and never shrinking', () => {
  it('on a comeback day the cat and the garden promise no memory check (the gentle session skips them)', () => {
    const p = withToday(0);
    for (let o = -20; o <= -12; o++) p.days[day(o)] = { problems: 5, xp: 0 };
    p.skills['linear-equations'] = { ...emptySkill(), rating: 1.8, attempts: 30, lastPracticed: day(-12), readyAt: day(-14), readyLevel: 4, retentionDue: day(-11) };
    const says = catSays(p, false, NOW);
    expect(says).not.toMatch(/memory check/i);
    expect(says).toMatch(/warm-up/);
    expect(gardenPlots(p, NOW).find((x) => x.id === 'linear-equations')!.thirsty).toBe(false);
    // The same skill on a normal day: the check is announced.
    p.days[day(-1)] = { problems: 5, xp: 0 };
    expect(catSays(p, false, NOW)).toMatch(/memory check/i);
  });

  it('a plant never shows a smaller stage than it reached; only growth animates', () => {
    const plot = (stage: Plot['stage']): Plot => ({ id: 'a', title: 'A', stage, thirsty: false, faded: false });
    const first = ratchet([plot('sapling')], {});
    expect([...first.grew]).toEqual(['a']);
    const slipped = ratchet([plot('sprout')], first.seen);
    expect(slipped.plots[0].stage).toBe('sapling');
    expect(slipped.grew.size).toBe(0);
    const grown = ratchet([plot('bud')], slipped.seen);
    expect(grown.plots[0].stage).toBe('bud');
    expect([...grown.grew]).toEqual(['a']);
    // Locked or unbuilt plots aren't remembered as growth.
    expect(ratchet([plot('grass')], {}).grew.size).toBe(0);
  });
});
