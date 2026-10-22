import { expect, test } from '@playwright/test';
import { freshStart } from './helpers';

test('the GRE bank deck runs, reveals answers, and records challenge history', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('nav-challenge').click();
  await expect(page.getByTestId('challenge')).toBeVisible();
  await expect(page.getByText('GRE Quant bank')).toBeVisible();

  await page.getByTestId('challenge-start').click();
  await expect(page.getByTestId('challenge-prompt')).not.toBeEmpty();

  for (let i = 0; i < 10; i++) {
    if (await page.getByText('Deck done').isVisible()) break;
    await page.getByRole('button', { name: 'Show answer' }).click();
    await expect(page.getByTestId('challenge-feedback')).toContainText('Answer revealed.');
    await expect(page.getByTestId('challenge-feedback')).toContainText('Explanation.');
    await page.getByTestId('challenge-next').click();
  }

  await expect(page.getByText('Deck done')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the bank' }).click();
  await expect(page.getByTestId('challenge-stats')).toContainText('10 answered');
});
