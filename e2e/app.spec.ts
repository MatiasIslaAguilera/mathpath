import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { correctInput, currentProblem, fillAnswer, finishFeedback, freshStart } from './helpers';

test('full daily session ends on the summary and updates home', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('start-session').click();

  for (let i = 0; i < 30; i++) {
    if (await page.getByTestId('summary').isVisible()) break;
    const p = await currentProblem(page);
    await fillAnswer(page, p.answer, correctInput(p.answer));
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByTestId('result-banner')).toContainText('Correct!');
    await finishFeedback(page, p);
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  await expect(page.getByTestId('summary')).toContainText('10');
  await page.getByTestId('home').click();
  await expect(page.getByLabel('10 of 10 problems today')).toBeVisible();
  await expect(page.getByText('1', { exact: true }).first()).toBeVisible(); // streak
});

test('hints reveal one step at a time and give half XP', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('skill-linear-equations').getByRole('button', { name: 'Practice' }).click();
  const p = await currentProblem(page);
  const hint = page.getByRole('button', { name: /^Hint/ });
  await hint.click();
  await expect(page.getByTestId('hints').locator('.step')).toHaveCount(1);
  await expect(hint).toHaveText(`Hint (1/${p.steps.length})`);
  await fillAnswer(page, p.answer, correctInput(p.answer));
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByTestId('result-banner')).toContainText(`+${5 * p.level} XP (half, hints used)`);
});

test('revealing every step with hints gives no XP', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('skill-linear-equations').getByRole('button', { name: 'Practice' }).click();
  const p = await currentProblem(page);
  for (let i = 0; i < p.steps.length; i++) await page.getByRole('button', { name: /^Hint/ }).click();
  await expect(page.getByTestId('hints').locator('.step')).toHaveCount(p.steps.length);
  await fillAnswer(page, p.answer, correctInput(p.answer));
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByTestId('result-banner')).toContainText('No XP');
});

test('guided mode: wrong step shows explanation, retry, show me, then a follow-up', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('skill-linear-equations').getByRole('button', { name: 'Practice' }).click();
  const p = await currentProblem(page);
  await page.getByRole('button', { name: "I don't know how to solve this" }).click();
  await expect(page.getByTestId('guided')).toBeVisible();

  let first = true;
  for (let guard = 0; guard < 10; guard++) {
    if (await page.getByTestId('feedback').isVisible()) break;
    const box = page.getByTestId('guided-step');
    const idx = Number(await box.locator('.step-num').innerText()) - 1;
    const ask = p.steps[idx].ask!;
    if (first && ask.answer.kind !== 'choice') {
      // Wrong answer → explanation, then retry correctly.
      await fillAnswer(page, ask.answer, ask.answer.kind === 'tuple' ? ask.answer.values.map(() => '99999') : '99999', box);
      await box.getByRole('button', { name: 'Check step' }).click();
      await expect(page.getByTestId('step-wrong')).toBeVisible();
      first = false;
      await box.getByRole('button', { name: 'Show me' }).click();
    } else {
      await fillAnswer(page, ask.answer, correctInput(ask.answer), box);
      await box.getByRole('button', { name: 'Check step' }).click();
    }
    await box.getByRole('button', { name: /Next step|Finish/ }).click();
  }
  await expect(page.getByTestId('result-banner')).toContainText('guidance');
  await finishFeedback(page, p);
  await expect(page.getByText('Same method, new numbers')).toBeVisible();
  const next = await currentProblem(page);
  expect(next.skillId).toBe(p.skillId);
});

test('a known wrong answer names the misconception', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('skill-linear-equations').getByRole('button', { name: 'Practice' }).click();
  for (let i = 0; i < 10; i++) {
    const p = await currentProblem(page);
    if (p.misconceptions.length) {
      const m = p.misconceptions[0];
      await fillAnswer(page, p.answer, correctInput(m.wrong));
      await page.getByRole('button', { name: 'Check', exact: true }).click();
      await expect(page.getByTestId('misconception')).toBeVisible();
      // A wrong solve also gets the "put it back into the equation" check habit.
      await expect(page.getByTestId('substitute-nudge')).toBeVisible();
      return;
    }
    await fillAnswer(page, p.answer, correctInput(p.answer));
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await finishFeedback(page, p);
  }
  throw new Error('no problem with a misconception appeared');
});

test('learn card opens with formulas and a worked example', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('skill-supply-demand-equilibrium').getByRole('button', { name: 'Learn' }).click();
  const card = page.getByTestId('learn-card');
  await expect(card).toContainText('Key formulas');
  await expect(card).toContainText('Worked example');
  await expect(card).toContainText('Common mistakes');
  await card.getByRole('button', { name: 'Close' }).click();
  await expect(card).toBeHidden();
});

test('export then import restores progress', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('skill-linear-equations').getByRole('button', { name: 'Practice' }).click();
  const p = await currentProblem(page);
  await fillAnswer(page, p.answer, correctInput(p.answer));
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByTestId('home').click();
  const xpText = await page.locator('.stat', { hasText: 'XP' }).locator('strong').innerText();
  expect(Number(xpText)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Settings' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export').click()]);
  const file = await download.path();
  const json = JSON.parse(readFileSync(file, 'utf-8'));
  expect(json.version).toBe(2);
  expect(json.events.filter((e: { type: string }) => e.type === 'attempt')).toHaveLength(1);
  expect(json.progress.skills['linear-equations'].attempts).toBe(1);
  expect(Array.isArray(json.progress.mistakes)).toBe(true);

  await page.evaluate(() => localStorage.clear());
  await page.goto('/?e2e');
  await expect(page.locator('.stat', { hasText: 'XP' }).locator('strong')).toHaveText('0');

  await page.getByRole('button', { name: 'Settings' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('import-file').setInputFiles(file);
  await expect(page.getByText('Progress imported.')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.stat', { hasText: 'XP' }).locator('strong')).toHaveText(xpText);
});
