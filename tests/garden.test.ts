import { describe, expect, it } from 'vitest';
import { hasSkill } from '../src/engine/registry';
import { catMood, catSays, gardenPlots, gardenSummary, weekDots } from '../src/learning/garden';
import { dailyActivity, overallProgress, weeklyAccuracy } from '../src/learning/stats';
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

  it('weeklyAccuracy counts only unassisted correct answers, by Monday-start week', () => {
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
    p.skills['linear-equations'] = { ...emptySkill(), attempts: 5, history: [at(-5, true), at(-4, true), at(-1, false), at(0, true, 'hint'), at(0, true)] };
    const w = weeklyAccuracy(p, 8, NOW);
    expect(w).toHaveLength(8);
    expect(w[7]).toEqual({ weekOf: day(-4), attempts: 4, accuracy: 0.5 });
    expect(w[6]).toEqual({ weekOf: day(-11), attempts: 1, accuracy: 1 });
    expect(w[0].accuracy).toBeUndefined();
  });
});
