import { expect, test, type Page } from '@playwright/test';
import { correctInput, currentProblemIn, fillAnswer, freshStart } from './helpers';

async function takePlacement(page: Page, answer: 'correct' | 'skip') {
  await page.getByTestId('placement-start').click();
  for (let i = 0; i < 30; i++) {
    if (await page.getByTestId('placement-results').isVisible()) return;
    const p = await currentProblemIn(page, 'placement-question');
    if (answer === 'skip') {
      await page.getByTestId('placement-skip').click();
      continue;
    }
    await fillAnswer(page, p.answer, correctInput(p.answer));
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByTestId('placement-feedback')).toContainText('Correct');
    await page.getByTestId('placement-next').click();
  }
  throw new Error('placement did not finish');
}

test('fresh start shows onboarding; skipping leaves only the first skill unlocked', async ({ page }) => {
  await freshStart(page, { skipOnboarding: false });
  await expect(page.getByTestId('onboarding')).toBeVisible();
  await expect(page.getByTestId('start-session')).toHaveCount(0);
  await page.getByTestId('skip-placement').click();
  await expect(page.getByTestId('start-session')).toBeVisible();
  await expect(page.getByTestId('lock-derivatives-power-rule')).toBeVisible();
  await expect(page.getByTestId('skill-derivatives-power-rule').getByRole('button', { name: 'Practice' })).toBeDisabled();
  await expect(page.getByTestId('skill-derivatives-power-rule').getByRole('button', { name: 'Learn' })).toBeEnabled();
});

test('acing the placement test places every skill and unlocks them', async ({ page }) => {
  await freshStart(page, { skipOnboarding: false });
  await page.getByTestId('start-placement').click();
  await takePlacement(page, 'correct');
  for (const id of ['linear-equations', 'derivatives-power-rule', 'supply-demand-equilibrium']) {
    await expect(page.getByTestId(`placement-result-${id}`)).toContainText('Placed');
  }
  await page.getByTestId('placement-finish').click();
  await expect(page.getByTestId('onboarding')).toHaveCount(0);
  for (const id of ['linear-equations', 'derivatives-power-rule', 'supply-demand-equilibrium']) {
    await expect(page.getByTestId(`badge-${id}`)).toContainText('Practiced');
    await expect(page.getByTestId(`lock-${id}`)).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText(/Last taken/)).toBeVisible();
});

test('answering "I don\'t know" everywhere starts at the beginning, with dependents locked', async ({ page }) => {
  await freshStart(page, { skipOnboarding: false });
  await page.getByTestId('start-placement').click();
  await takePlacement(page, 'skip');
  await expect(page.getByTestId('placement-result-linear-equations')).toContainText('Start here');
  await expect(page.getByTestId('placement-result-supply-demand-equilibrium')).toContainText('Unlocks after');
  await page.getByTestId('placement-finish').click();
  await expect(page.getByTestId('lock-supply-demand-equilibrium')).toBeVisible();
  await page.getByTestId('start-session').click();
  const p = await currentProblemIn(page, 'exercise');
  expect(p.skillId).toBe('linear-equations');
});

test('retaking from Settings never lowers a placed skill', async ({ page }) => {
  await freshStart(page, { skipOnboarding: false });
  await page.getByTestId('start-placement').click();
  await takePlacement(page, 'correct');
  await page.getByTestId('placement-finish').click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByTestId('retake-placement').click();
  await takePlacement(page, 'skip');
  await page.getByTestId('placement-finish').click();
  await expect(page.getByTestId('badge-derivatives-power-rule')).toContainText('Practiced');
});
