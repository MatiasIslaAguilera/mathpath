// Pace and error handling: the second try, the short session, test-out, the notebook, and the
// session-length / weekly-goal / target-date settings.
import { expect, test } from '@playwright/test';
import { checkWrong, correctInput, currentProblem, fillAnswer, finishFeedback, freshStart } from './helpers';

const check = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Check', exact: true }).first();

test('a wrong answer gets one more try; fixing it earns half XP and shows no "Not quite"', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('skill-linear-equations').getByRole('button', { name: 'Practice' }).click();
  const p = await currentProblem(page);
  await fillAnswer(page, p.answer, '123456');
  await check(page).click();
  await expect(page.getByTestId('retry-note')).toContainText('One more try');
  await expect(page.getByTestId('feedback')).toHaveCount(0);
  await fillAnswer(page, p.answer, correctInput(p.answer));
  await check(page).click();
  await expect(page.getByTestId('result-banner')).toContainText('Fixed on the second try');
  await expect(page.getByTestId('result-banner')).toContainText(`+${5 * p.level} XP (half)`);
  // A slip the learner fixed alone gets no "same method, new numbers" repeat.
  await finishFeedback(page, p);
  await expect(page.getByTestId('followup-note')).toHaveCount(0);
});

test('the notebook lists a miss and redoes it with new numbers', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('skill-linear-equations').getByRole('button', { name: 'Practice' }).click();
  const p = await currentProblem(page);
  await fillAnswer(page, p.answer, '123456');
  await checkWrong(page);
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByTestId('home').click();
  await page.getByTestId('nav-stats').click();
  await expect(page.getByTestId('notebook-card')).toContainText('Linear equations');
  await expect(page.getByTestId('notebook-card')).toContainText('You answered 123456');
  await page.getByTestId('redo-misses').click();
  const redo = await currentProblem(page);
  expect(redo.skillId).toBe(p.skillId);
  expect(redo.level).toBe(p.level);
  expect(redo.id).not.toBe(p.id);
  await expect(page.getByTestId('redo-note')).toBeVisible();
});

test('a short session is three problems and counts for the day', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('short-session').click();
  for (let i = 0; i < 3; i++) {
    const p = await currentProblem(page);
    await fillAnswer(page, p.answer, correctInput(p.answer));
    await check(page).click();
    await finishFeedback(page, p);
  }
  await expect(page.getByTestId('summary')).toContainText('3');
  await page.getByTestId('home').click();
  await expect(page.getByTestId('short-session')).toHaveCount(0);
});

test('testing out of a new skill: two level-3 problems, then it is practiced', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('nav-tree').click();
  await page.getByTestId('tree-item-linear-equations').getByRole('button').first().click();
  await page.getByTestId('test-out-linear-equations').click();
  for (let i = 0; i < 2; i++) {
    const p = await currentProblem(page);
    expect(p.level).toBe(3);
    await expect(page.getByTestId('testout-note')).toBeVisible();
    await fillAnswer(page, p.answer, correctInput(p.answer));
    await check(page).click();
    await finishFeedback(page, p);
  }
  await expect(page.getByTestId('test-out-result')).toContainText('Tested out');
  await page.getByTestId('home').click();
  await page.getByTestId('nav-tree').click();
  await expect(page.getByTestId('tree-item-linear-equations')).toHaveAttribute('data-status', 'practiced');
});

test('a wrong first answer on a test-out is final: no second try', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('nav-tree').click();
  await page.getByTestId('tree-item-linear-equations').getByRole('button').first().click();
  await page.getByTestId('test-out-linear-equations').click();
  const p = await currentProblem(page);
  await fillAnswer(page, p.answer, p.answer.kind === 'tuple' ? p.answer.labels.map(() => '123456') : '123456');
  await check(page).click();
  await expect(page.getByTestId('retry-note')).toHaveCount(0);
  await expect(page.getByTestId('result-banner')).toContainText('Not quite');
});

test('session length, weekly goal and target date are saved and show up on Home and Stats', async ({ page }) => {
  await freshStart(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByTestId('minutes-15').click();
  await page.getByTestId('weekly-5').click();
  await page.getByTestId('target-date').fill('2030-08-19');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('this-week')).toHaveText('0 of 5 days this week');
  await expect(page.getByTestId('pace-line')).toContainText('a week reaches your target');
  await page.getByTestId('nav-stats').click();
  await expect(page.getByTestId('road-card')).toContainText('Core skills solid');
  await expect(page.getByTestId('milestone-linear-algebra')).toContainText('0 of 4 solid');
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByTestId('minutes-15')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('weekly-5')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('target-date')).toHaveValue('2030-08-19');
});
