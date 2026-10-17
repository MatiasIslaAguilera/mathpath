import { expect, type Page } from '@playwright/test';
import type { AnswerSpec, Problem } from '../src/engine/types';

/** Empty progress. By default also taps "Skip: start from the beginning" on the onboarding card. */
export async function freshStart(page: Page, { skipOnboarding = true } = {}) {
  await page.goto('/?e2e');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?e2e');
  if (skipOnboarding) await page.getByTestId('skip-placement').click();
}

export async function currentProblem(page: Page): Promise<Problem> {
  return currentProblemIn(page, 'exercise');
}

/** The problem on screen (via the ?e2e hook) once the container with this test id is visible. */
export async function currentProblemIn(page: Page, testId: string): Promise<Problem> {
  const box = page.getByTestId(testId);
  await expect(box).toBeVisible();
  const id = await box.getAttribute('data-problem-id');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mathpath?: { problem: Problem } }).__mathpath?.problem.id)).toBe(id);
  return page.evaluate(() => (window as unknown as { __mathpath: { problem: Problem } }).__mathpath.problem);
}

/** Type a value into the answer area for the given spec (scoped to `root`). */
export async function fillAnswer(page: Page, spec: AnswerSpec, values: string | string[], root = page.locator('body')) {
  if (spec.kind === 'choice') {
    await root.locator(`[data-option-id="${values}"]`).first().click();
  } else if (spec.kind === 'tuple') {
    const vals = values as string[];
    for (let i = 0; i < spec.labels.length; i++) await root.getByLabel(spec.labels[i], { exact: true }).fill(vals[i]);
  } else {
    await root.getByLabel('Your answer').fill(values as string);
  }
}

export const correctInput = (spec: AnswerSpec): string | string[] =>
  spec.kind === 'tuple' ? spec.values : spec.kind === 'choice' ? spec.correct : spec.value;

/** Answer any interpretation questions correctly, then press Next. */
export async function finishFeedback(page: Page, problem: Problem) {
  for (const q of problem.interpretation ?? []) {
    const box = page.getByTestId('interpretation');
    await box.locator(`[data-option-id="${q.correct}"]`).click();
    await box.getByRole('button', { name: /Next question|Done/ }).click();
  }
  await page.getByTestId('next').click();
}
