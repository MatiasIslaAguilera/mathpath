// Review 10 learning-engine changes, end to end on the phone profile:
//   - a miss diagnosed as coefficient-raised-to-inner is followed by the contrasting case
//     (two expressions with the exponents swapped, ids `…:c`), then by an ordinary item;
//   - a fast wrong answer that matches no misconception gets the "likely slip" note.
// With SCREENS=<dir> it also writes review PNGs of both screens.

import { expect, test, type Page } from '@playwright/test';
import { correctInput, currentProblem, fillAnswer, finishFeedback } from './helpers';

const OUT = process.env.SCREENS;

async function seedExponentRulesAtLevel2(page: Page) {
  await page.goto('/?e2e');
  await page.evaluate(() => {
    const solid = { rating: 2.4, attempts: 30, correctUnassisted: 28, history: [], interpretation: { correct: 0, total: 0 } };
    const progress = {
      version: 1,
      createdAt: new Date().toISOString(),
      xp: 0,
      days: {},
      skills: {
        'linear-equations': solid,
        // Working level 2: P(level 2) ≥ 0.75, P(level 3) < 0.75 under the default model.
        'exponent-rules': { rating: 0.5, held: 2, attempts: 30, correctUnassisted: 25, history: [], interpretation: { correct: 0, total: 0 } },
      },
      mistakes: [],
      misconceptionCounts: {},
      stepMisses: {},
      settings: { dailyGoal: 10 },
      onboarding: 'skipped',
    };
    localStorage.clear();
    localStorage.setItem('mathpath.progress', JSON.stringify(progress));
  });
  await page.goto('/?e2e');
  await page.getByTestId('skill-exponent-rules').getByRole('button', { name: 'Practice' }).click();
}

test('a coefficient-raised-to-inner miss brings the contrasting case, then an ordinary item', async ({ page }) => {
  await seedExponentRulesAtLevel2(page);

  // Answer correctly until a (c x^a)^b item comes up.
  let p = await currentProblem(page);
  for (let i = 0; i < 25 && !(p.level === 2 && p.params.form === 1 && p.variant === undefined); i++) {
    await fillAnswer(page, p.answer, correctInput(p.answer));
    await page.getByRole('button', { name: 'Check', exact: true }).first().click();
    await finishFeedback(page, p);
    p = await currentProblem(page);
  }
  expect(p.level === 2 && p.params.form === 1, 'reached a coefficient item').toBe(true);

  // The trap: the coefficient raised to the inner exponent.
  const { a, b, c } = p.params;
  await fillAnswer(page, p.answer, [String(c ** a), String(a * b)]);
  await page.getByRole('button', { name: 'Check', exact: true }).first().click();
  await expect(page.getByTestId('misconception')).toContainText('Raised the coefficient');
  await page.getByTestId('next').click();

  const contrast = await currentProblem(page);
  expect(contrast.id).toMatch(/^exponent-rules:2:\d+:c$/);
  await expect(page.getByTestId('followup-note')).toContainText('differ in one place');
  if (OUT) await page.screenshot({ path: `${OUT}/contrast-exercise.png`, fullPage: true });

  // A fast wrong answer that no misconception predicts: the slip note.
  await fillAnswer(page, contrast.answer, ['1', '1', '1']);
  await page.getByRole('button', { name: 'Check', exact: true }).first().click();
  await expect(page.getByTestId('result-banner')).toContainText('Not quite');
  await expect(page.getByTestId('fast-miss')).toContainText('usually slips');
  await expect(page.getByTestId('misconception')).toHaveCount(0);
  if (OUT) await page.screenshot({ path: `${OUT}/fast-miss-feedback.png`, fullPage: true });
  await page.getByTestId('next').click();

  // Then an ordinary level-2 item that sets the same trap: does it transfer?
  const transfer = await currentProblem(page);
  expect(transfer.variant).toBeUndefined();
  expect(transfer.level).toBe(2);
  expect(transfer.misconceptions.map((m) => m.id)).toContain('coefficient-raised-to-inner');
});

test('a diagnosed misconception never gets the slip note, however fast', async ({ page }) => {
  await seedExponentRulesAtLevel2(page);
  let p = await currentProblem(page);
  for (let i = 0; i < 25 && !(p.level === 2 && p.params.form === 1 && p.variant === undefined); i++) {
    await fillAnswer(page, p.answer, correctInput(p.answer));
    await page.getByRole('button', { name: 'Check', exact: true }).first().click();
    await finishFeedback(page, p);
    p = await currentProblem(page);
  }
  const { a, b, c } = p.params;
  await fillAnswer(page, p.answer, [String(c ** a), String(a * b)]);
  await page.getByRole('button', { name: 'Check', exact: true }).first().click();
  await expect(page.getByTestId('misconception')).toBeVisible();
  await expect(page.getByTestId('fast-miss')).toHaveCount(0);
});
