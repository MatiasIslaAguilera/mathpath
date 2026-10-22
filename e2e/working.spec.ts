import { expect, test, type Page } from '@playwright/test';
import type { Problem } from '../src/engine/types';
import { currentProblem, freshStart } from './helpers';

// The working pad on an equation problem (the first session item is a linear equation).

async function startOnEquation(page: Page): Promise<Problem> {
  await freshStart(page);
  await page.getByTestId('start-session').click();
  const p = await currentProblem(page);
  expect(p.skillId).toBe('linear-equations');
  await expect(page.getByTestId('working-pad')).toBeVisible();
  await expect(page.getByTestId('working-line-0')).toBeVisible();
  return p;
}

/** Replace the content of working line `i` by typing, as a learner would. */
async function typeLine(page: Page, i: number, text: string) {
  const field = page.getByTestId(`working-line-${i}`);
  await field.click();
  // A new line focuses itself a frame after it appears: type only once this field has focus.
  await expect.poll(() => field.evaluate((el) => (el as HTMLElement & { hasFocus(): boolean }).hasFocus())).toBe(true);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(text);
  // Close the math keyboard the way a learner does (tap outside), so the page buttons are reachable.
  await page.getByTestId('prompt').click();
  await expect(page.getByTestId('keyboard-bar')).toBeHidden();
}

const lineValue = (page: Page, i: number) => page.getByTestId(`working-line-${i}`).evaluate((el) => (el as HTMLElement & { value: string }).value);

test('the first line is the equation, and a new line starts as a copy of the one above', async ({ page }) => {
  await startOnEquation(page);
  const first = await lineValue(page, 0);
  expect(first).toContain('=');
  await page.getByTestId('working-add').click();
  await expect(page.getByTestId('working-line-1')).toBeVisible();
  expect(await lineValue(page, 1)).toBe(first);
});

test('a wrong line is pinpointed after Check', async ({ page }) => {
  const p = await startOnEquation(page);
  const x = Number((p.answer as { value: string }).value);
  await page.getByTestId('working-add').click();
  await typeLine(page, 1, `x=${x + 1}`);
  await page.getByTestId('working-use-answer').click();
  await expect(page.getByLabel('Your answer')).toHaveValue(String(x + 1));
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByTestId('result-banner')).toContainText('Not quite');
  await expect(page.getByTestId('working-first-wrong')).toContainText('line 2');
  await expect(page.getByTestId('working-review').locator('[data-status="wrong"]')).toHaveCount(1);
  await expect(page.getByTestId('working-review').locator('[data-status="ok"]')).toHaveCount(1);
});

test('correct working fills an empty answer box on Check and every line checks out', async ({ page }) => {
  const p = await startOnEquation(page);
  const x = (p.answer as { value: string }).value;
  await page.getByTestId('working-add').click();
  await typeLine(page, 1, `x=${x}`);
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByTestId('result-banner')).toContainText('Correct!');
  await expect(page.getByTestId('working-all-right')).toContainText('checks out');
});

test('with the math keyboard open, Check on the bar above it submits', async ({ page }) => {
  const p = await startOnEquation(page);
  const x = (p.answer as { value: string }).value;
  await page.getByTestId('working-add').click();
  await expect(page.getByTestId('keyboard-bar')).toBeVisible();
  const field = page.getByTestId('working-line-1');
  await expect.poll(() => field.evaluate((el) => (el as HTMLElement & { hasFocus(): boolean }).hasFocus())).toBe(true);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(`x=${x}`);
  await page.getByTestId('keyboard-bar').getByRole('button', { name: 'Check' }).click();
  await expect(page.getByTestId('result-banner')).toContainText('Correct!');
  await expect(page.getByTestId('keyboard-bar')).toHaveCount(0);
});
