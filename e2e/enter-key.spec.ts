import { expect, test } from '@playwright/test';
import { correctInput, currentProblem, freshStart } from './helpers';

// Enter in the answer box checks the answer. The feedback (with its autofocused Next button) must
// stay on screen: the same Enter keystroke must not also press Next.
test('Enter checks the answer and the feedback stays on screen', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('skill-linear-equations').getByRole('button', { name: 'Practice' }).click();
  const p = await currentProblem(page);
  const box = page.getByLabel('Your answer');
  await box.fill(correctInput(p.answer) as string);
  await box.press('Enter');
  await expect(page.getByTestId('result-banner')).toContainText('Correct!');
  await page.waitForTimeout(300);
  await expect(page.getByTestId('result-banner')).toBeVisible();
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-problem-id', p.id);
});

test('Enter on a wrong answer shows the explanation, not the next problem', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('skill-linear-equations').getByRole('button', { name: 'Practice' }).click();
  const p = await currentProblem(page);
  const box = page.getByLabel('Your answer');
  await box.fill('123456');
  await box.press('Enter');
  await page.waitForTimeout(300);
  await expect(page.getByTestId('result-banner')).toBeVisible();
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-problem-id', p.id);
});
