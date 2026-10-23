// UI review shots, not a test: `SCREENS=<dir> npx playwright test screens` writes PNGs of Home in
// four learner states (new, early, mid, goal met), light and dark, on the Pixel 7 profile.
// Skipped in the normal e2e run.

import { expect, test, type Page } from '@playwright/test';
import { hasSkill } from '../src/engine/registry';
import { TREE } from '../src/skills/tree';

const OUT = process.env.SCREENS;
test.skip(!OUT, 'set SCREENS=<dir> to write review screenshots');

const BUILT = TREE.filter((n) => !n.optional && n.track !== 'gre' && hasSkill(n.id)).map((n) => n.id);

type Kind = 'learning' | 'practiced' | 'check' | 'mastered' | 'rusty';
/** One skill per entry, in tree order; `due` marks a review waiting today. */
type Spec = { kind: Kind; due?: boolean };

interface Fixture {
  name: string;
  /** Problems per day, by offset from today (0 = today). */
  days: Record<number, number>;
  skills: Spec[];
  xp: number;
}

// Uneven day sizes, like real practice.
const SIZES = [8, 11, 6, 10, 13, 7, 10, 4, 12, 9, 10, 5, 14, 10];
const run = (from: number, to: number) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, SIZES[(from + i + 100) % SIZES.length]]));
const many = (n: number, s: Spec): Spec[] => Array.from({ length: n }, () => ({ ...s }));

const FIXTURES: Fixture[] = [
  { name: '1-new', days: {}, skills: [], xp: 0 },
  {
    name: '2-early-morning',
    days: run(-4, -1, 6),
    skills: [{ kind: 'practiced' }, { kind: 'practiced', due: true }, { kind: 'learning', due: true }, { kind: 'learning' }],
    xp: 340,
  },
  {
    name: '3-two-weeks-mid-session',
    days: { ...run(-13, -7), ...run(-5, -1), 0: 4 },
    skills: [
      ...many(4, { kind: 'mastered' }),
      { kind: 'rusty', due: true },
      ...many(2, { kind: 'check' }),
      ...many(3, { kind: 'practiced' }),
      { kind: 'practiced', due: true },
      ...many(3, { kind: 'learning' }),
    ],
    xp: 1960,
  },
  {
    name: '4-six-weeks-goal-met',
    days: { ...run(-41, -1), 0: 11 },
    skills: [...many(17, { kind: 'mastered' }), ...many(3, { kind: 'check' }), ...many(6, { kind: 'practiced' }), ...many(4, { kind: 'learning' })],
    xp: 7420,
  },
];

async function seed(page: Page, f: Fixture) {
  await page.goto('/?e2e');
  await page.evaluate(
    ([f, ids]) => {
      const key = (o: number) => {
        const d = new Date();
        d.setDate(d.getDate() + o);
        const p = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      };
      const iso = (o: number) => new Date(Date.now() + o * 86400000).toISOString();
      const card = (dueIn: number) => ({ due: iso(dueIn), stability: 8, difficulty: 5, elapsed_days: 3, scheduled_days: 8, learning_steps: 0, reps: 4, lapses: 0, state: 2, last_review: iso(-3) });
      const rating = { learning: -1.2, practiced: 1.4, check: 1.8, mastered: 2.4, rusty: 2.1 };
      // A history spread over the practice days, solo accuracy rising from ~70% to ~85%.
      const offs = Object.keys(f.days).map(Number).sort((a, b) => a - b);
      const history = (i: number) =>
        Array.from({ length: offs.length ? 30 : 0 }, (_, k) => {
          const at = (k * 7 + i * 3) % offs.length;
          const progress = offs.length > 1 ? at / (offs.length - 1) : 1;
          const correct = (k * 37 + i * 11) % 100 < 70 + 15 * progress;
          return { ts: Date.now() + offs[at] * 86400000 - 3600000, problemId: `${ids[i]}:2:${k}`, level: 2, correct, help: 'none', hintsUsed: 0, firstOfDay: k % 5 === 0 };
        }).sort((a, b) => a.ts - b.ts);
      const skills = Object.fromEntries(
        f.skills.map((s, i) => [
          ids[i],
          {
            rating: rating[s.kind],
            attempts: 30,
            correctUnassisted: 24,
            history: history(i),
            interpretation: { correct: 0, total: 0 },
            lastPracticed: key(-1),
            fsrs: card(s.due ? -1 : 6),
            ...(s.kind === 'check' ? { readyAt: key(-1), readyLevel: 4, retentionDue: key(2) } : {}),
            ...(s.kind === 'mastered' || s.kind === 'rusty' ? { masteredAt: key(-8) } : {}),
            ...(s.kind === 'rusty' ? { rusty: true } : {}),
          },
        ]),
      );
      const days = Object.fromEntries(Object.entries(f.days).map(([o, n]) => [key(Number(o)), { problems: n, xp: n * 20 }]));
      const progress = {
        version: 1,
        createdAt: iso(-60),
        xp: f.xp,
        days,
        skills,
        mistakes: [],
        misconceptionCounts: {},
        stepMisses: {},
        settings: { dailyGoal: 10 },
        ...(f.skills.length ? { onboarding: 'skipped', welcomeShownOn: key(0) } : {}),
      };
      localStorage.clear();
      localStorage.setItem('mathpath.progress', JSON.stringify(progress));
    },
    [f, BUILT] as const,
  );
  await page.goto('/?e2e');
}

for (const f of FIXTURES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`home ${f.name} ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await seed(page, f);
      await page.getByTestId('garden').waitFor();
      await page.screenshot({ path: `${OUT}/home-${f.name}-${scheme}.png` });
      // The second screen: streak, figures and charts.
      await page.locator('.streak-card').evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: `${OUT}/home-${f.name}-${scheme}-2.png` });
    });
  }
}

// The fonts and palette reach every screen: one problem mid-session, and the skill tree.
for (const scheme of ['light', 'dark'] as const) {
  test(`exercise and tree ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await seed(page, FIXTURES[2]);
    await page.getByTestId('start-session').click();
    await page.getByTestId('exercise').waitFor();
    await page.screenshot({ path: `${OUT}/exercise-${scheme}.png` });
    await page.goto('/?e2e');
    await page.getByTestId('nav-tree').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/tree-${scheme}.png` });
  });
}

// The working pad on economics problems, with working typed as a learner would.
async function practiceSkill(page: Page, skillId: string) {
  await page.goto('/?e2e');
  await page.evaluate(() => {
    // Every prerequisite solid, the target untouched (level 1).
    const skill = { rating: 2.4, attempts: 30, correctUnassisted: 28, history: [], interpretation: { correct: 0, total: 0 } };
    const progress = { version: 1, createdAt: new Date().toISOString(), xp: 0, days: {}, skills: {} as Record<string, unknown>, mistakes: [], misconceptionCounts: {}, stepMisses: {}, settings: { dailyGoal: 10 }, onboarding: 'skipped' };
    for (const id of ['linear-equations', 'linear-inequalities', 'systems-of-equations', 'quadratics-factoring', 'quadratic-formula', 'functions-basics', 'function-composition', 'inverse-functions', 'function-transformations', 'exponent-rules', 'logarithm-rules', 'exp-log-equations', 'growth-decay', 'limits', 'derivatives-power-rule', 'derivatives-product-quotient', 'derivatives-chain-rule', 'derivatives-exp-log', 'concavity-second-derivative'])
      progress.skills[id] = skill;
    localStorage.clear();
    localStorage.setItem('mathpath.progress', JSON.stringify(progress));
  });
  await page.goto('/?e2e');
  await page.getByTestId(`skill-${skillId}`).getByRole('button', { name: 'Practice' }).click();
}

async function typeWorking(page: Page, lines: string[]) {
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 || !(await page.getByTestId('working-line-0').isVisible())) await page.getByTestId('working-add').click();
    const field = page.getByTestId(`working-line-${i}`);
    await field.click();
    await expect.poll(() => field.evaluate((el) => (el as HTMLElement & { hasFocus(): boolean }).hasFocus())).toBe(true);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(lines[i]);
    console.log(`line ${i}:`, await field.evaluate((el) => (el as HTMLElement & { value: string }).value));
    await page.getByTestId('prompt').click();
  }
}

for (const [skillId, working] of [
  ['supply-demand-equilibrium', (p: Record<string, number>) => [`${p.a}-${p.b === 1 ? '' : p.b}P=${p.c}+${p.d === 1 ? '' : p.d}P`, `${p.b + p.d}P=${p.a - p.c}`, `P=${p.P}`, `Q=${p.a}-${p.b === 1 ? '' : p.b + '*'}${p.P}`]],
  ['optimization', (p: Record<string, number>) => [`R'(q)=${p.a}-${2 * p.b}q=0`, `q=${p.a / (2 * p.b)}`, `R=${p.a}*${p.a / (2 * p.b)}-${p.b}*${p.a / (2 * p.b)}^2`]],
] as const) {
  test(`working pad on ${skillId}`, async ({ page }) => {
    await practiceSkill(page, skillId);
    for (let i = 0; i < 6; i++) {
      const p = await page.evaluate(() => (window as unknown as { __mathpath?: { problem: { skillId: string; params: Record<string, number> } } }).__mathpath?.problem);
      if (p?.skillId === skillId && (await page.getByTestId('working-pad').isVisible())) break;
      await page.getByRole('button', { name: /I don't know/ }).click();
      await page.getByTestId('next').click();
    }
    const p = await page.evaluate(() => (window as unknown as { __mathpath: { problem: { params: Record<string, number> } } }).__mathpath.problem);
    await typeWorking(page, working(p.params));
    await page.getByRole('button', { name: 'Check', exact: true }).first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/pad-${skillId}.png`, fullPage: true });
  });
}
