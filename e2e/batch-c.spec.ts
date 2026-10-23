import { expect, test, type Page } from '@playwright/test';
import { correctInput, currentProblem, fillAnswer, finishFeedback, freshStart } from './helpers';

/** Seed progress whose `days` are given as offsets from today (e.g. -3 → 3 days ago). */
async function seed(page: Page, dayOffsets: Record<number, number>, skills: Record<string, unknown> = {}) {
  await page.evaluate(
    ([offsets, sk]) => {
      const key = (o: number) => {
        const d = new Date();
        d.setDate(d.getDate() + o);
        const p = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      };
      const days = Object.fromEntries(Object.entries(offsets).map(([o, n]) => [key(Number(o)), { problems: n, xp: 0 }]));
      const progress = { version: 1, createdAt: '', xp: 50, days, skills: sk, mistakes: [], misconceptionCounts: {}, stepMisses: {}, settings: { dailyGoal: 10 }, onboarding: 'skipped' };
      localStorage.clear(); // start from a pre-event-log install: exercises the migration
      localStorage.setItem('mathpath.progress', JSON.stringify(progress));
    },
    [dayOffsets, skills] as const,
  );
  await page.goto('/?e2e');
}

const lin = { rating: 1.5, attempts: 10, correctUnassisted: 8, history: [], interpretation: { correct: 0, total: 0 } };
const range = (from: number, to: number) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, 5]));

test('after a broken streak: welcome back, then a 3-problem restart', async ({ page }) => {
  await freshStart(page);
  await seed(page, range(-6, -4), { 'linear-equations': lin }); // 3-day streak, then 3 days away
  const card = page.getByTestId('welcome-back');
  await expect(card).toContainText('Welcome back');
  await expect(card).toContainText('3 days in total');
  await expect(card).not.toContainText(/lost|broke|missed|failed/i);
  await card.getByTestId('welcome-restart').click();
  for (let i = 0; i < 10; i++) {
    if (await page.getByTestId('summary').isVisible()) break;
    const p = await currentProblem(page);
    await fillAnswer(page, p.answer, correctInput(p.answer));
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await finishFeedback(page, p);
  }
  await expect(page.getByTestId('summary')).toContainText('3');
  await page.getByTestId('home').click();
  await expect(page.getByTestId('welcome-back')).toHaveCount(0); // shown once
});

test('a freeze that saved the streak is reported, and the calendar marks it', async ({ page }) => {
  await freshStart(page);
  await seed(page, range(-9, -2), { 'linear-equations': lin }); // 8 days → earned a freeze; yesterday covered
  const card = page.getByTestId('welcome-back');
  await expect(card).toContainText('streak freeze');
  await expect(card).toContainText('safe');
  await card.getByRole('button', { name: 'Nice' }).click();
  await expect(card).toHaveCount(0);
  await page.getByTestId('nav-stats').click();
  await expect(page.getByTestId('streak-calendar')).toContainText('❄');
});

test('skill tree shows locked, coming-soon, and practiceable skills', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('nav-tree').click();
  await expect(page.getByTestId('tree-item-derivatives-power-rule')).toHaveAttribute('data-status', 'locked');
  await expect(page.getByTestId('tree-item-derivatives-power-rule')).toContainText('Unlocks after');
  await expect(page.getByTestId('tree-item-kuhn-tucker')).toHaveAttribute('data-status', 'coming-soon');
  const lin = page.getByTestId('tree-item-linear-equations');
  await lin.click();
  await lin.getByRole('button', { name: 'Practice' }).click();
  const p = await currentProblem(page);
  expect(p.skillId).toBe('linear-equations');
});

test('stats page fills in after practice', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('skill-linear-equations').getByRole('button', { name: 'Practice' }).click();
  const p = await currentProblem(page);
  const wrong = p.misconceptions[0];
  await fillAnswer(page, p.answer, wrong ? correctInput(wrong.wrong) : '99999');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByTestId('home').click();
  await page.getByTestId('nav-stats').click();
  await expect(page.getByTestId('accuracy-table')).toContainText('Linear equations');
  if (wrong) await expect(page.getByText('Most frequent mistakes').locator('..')).toContainText('1×');
});
