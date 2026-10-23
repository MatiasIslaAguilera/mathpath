// Home's garden, cat and charts: the checks from the design review, as assertions.
import { expect, test, type Page } from '@playwright/test';

/** Progress with a few practiced skills; `history` attempts are [weeksAgo, correct][] (all unassisted). */
async function seed(page: Page, history: [number, boolean][] = []) {
  await page.goto('/?e2e');
  await page.evaluate((hist) => {
    const key = (o: number) => {
      const d = new Date();
      d.setDate(d.getDate() + o);
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };
    const days = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [key(-1 - i), { problems: 8, xp: 0 }]));
    const skill = (rating: number) => ({ rating, attempts: 20, correctUnassisted: 15, history: [] as unknown[], interpretation: { correct: 0, total: 0 }, lastPracticed: key(-1) });
    const lin = skill(1.4);
    lin.history = hist.map(([weeksAgo, correct], i) => ({ ts: Date.now() - weeksAgo * 7 * 86400000 - i * 1000, problemId: 'linear-equations:2:1', level: 2, correct, help: 'none', hintsUsed: 0, firstOfDay: false }));
    const progress = {
      version: 1,
      createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      xp: 1234567,
      days,
      skills: { 'linear-equations': lin, 'linear-inequalities': skill(-1.2) },
      mistakes: [],
      misconceptionCounts: {},
      stepMisses: {},
      settings: { dailyGoal: 10 },
      onboarding: 'skipped',
      welcomeShownOn: key(0),
    };
    localStorage.clear();
    localStorage.setItem('mathpath.progress', JSON.stringify(progress));
  }, history);
  await page.goto('/?e2e');
  await expect(page.getByTestId('garden')).toBeVisible();
}

test('no sideways scroll at 320px, even with a seven-figure XP', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await seed(page);
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(client);
  await expect(page.locator('.streak-foot')).toContainText('1,234,567');
});

test('the garden grows in once, then nothing animates', async ({ page }) => {
  await seed(page);
  await expect.poll(() => page.evaluate(() => document.getAnimations().length), { timeout: 4000 }).toBe(0);
});

test("the cat's words are page text, not hidden inside the garden button, and fit at 200% text", async ({ page }) => {
  await seed(page);
  await expect(page.getByTestId('garden').getByTestId('cat-says')).toHaveCount(0);
  await expect(page.getByTestId('cat-says')).not.toBeEmpty();
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  const [bubble, hero] = await Promise.all([page.getByTestId('cat-says').boundingBox(), page.locator('.garden-hero').boundingBox()]);
  expect(bubble!.y).toBeGreaterThanOrEqual(hero!.y);
  expect(bubble!.y + bubble!.height).toBeLessThanOrEqual(hero!.y + hero!.height);
});

test('accuracy points sit at their true value and the line breaks at a week with no answers', async ({ page }) => {
  // 3 weeks ago: 3 of 10 right; 2 weeks ago: nothing; last week: 5 of 10 right.
  const week = (ago: number, right: number): [number, boolean][] => Array.from({ length: 10 }, (_, i) => [ago, i < right]);
  await seed(page, [...week(3, 3), ...week(1, 5)]);
  const chart = page.getByTestId('accuracy-chart');
  const ys = await chart.locator('circle.chart-dot').evaluateAll((els) => els.map((e) => Number(e.getAttribute('cy'))));
  expect(ys).toHaveLength(2);
  // y(v) is linear on a 0–100% axis: 30% sits lower than 50%, and their gap is a fifth of the axis.
  const axis = await chart.locator('svg').evaluate((svg) => {
    const labels = [...svg.querySelectorAll('text')].filter((t) => /^(0|100)%$/.test(t.textContent ?? ''));
    return labels.map((t) => Number(t.getAttribute('y')) - 4);
  });
  const [y0, y100] = axis;
  const y = (v: number) => y0 + (y100 - y0) * v;
  expect(ys[0]).toBeCloseTo(y(0.3), 5);
  expect(ys[1]).toBeCloseTo(y(0.5), 5);
  const d = await chart.locator('path.chart-line').getAttribute('d');
  expect(d!.match(/M/g)).toHaveLength(2);
});
