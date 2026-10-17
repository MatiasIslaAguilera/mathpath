import { expect, test, type Page } from '@playwright/test';
import { correctInput, currentProblem, fillAnswer, finishFeedback, freshStart } from './helpers';

/** Local YYYY-MM-DD, `offset` days from today (runs in the browser's timezone). */
async function dayKey(page: Page, offset: number): Promise<string> {
  return page.evaluate((o) => {
    const d = new Date();
    d.setDate(d.getDate() + o);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, offset);
}

const skill = (extra: Record<string, unknown>) => ({
  rating: 1.5,
  attempts: 8,
  correctUnassisted: 8,
  history: [],
  interpretation: { correct: 0, total: 0 },
  ...extra,
});

async function seed(page: Page, skills: Record<string, unknown>, dailyGoal = 5) {
  await page.evaluate(
    ([s, g]) => {
      const progress = {
        version: 1,
        createdAt: new Date().toISOString(),
        xp: 100,
        skills: s,
        days: {},
        mistakes: [],
        misconceptionCounts: {},
        stepMisses: {},
        settings: { dailyGoal: g },
      };
      localStorage.clear(); // start from a pre-event-log install: exercises the migration
      localStorage.setItem('mathpath.progress', JSON.stringify(progress));
    },
    [skills, dailyGoal] as const,
  );
  await page.goto('/?e2e');
}

async function answerAllCorrectly(page: Page, onProblem?: (i: number) => Promise<void>) {
  for (let i = 0; i < 30; i++) {
    if (await page.getByTestId('summary').isVisible()) return;
    const p = await currentProblem(page);
    if (onProblem) await onProblem(i);
    await fillAnswer(page, p.answer, correctInput(p.answer));
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await finishFeedback(page, p);
  }
}

test('a due retention check is cold, unassisted, and masters the skill when passed', async ({ page }) => {
  await freshStart(page);
  const longAgo = await dayKey(page, -4);
  await seed(page, { 'linear-equations': skill({ readyAt: longAgo, retentionDue: await dayKey(page, -1), lastPracticed: longAgo }) });
  await expect(page.getByTestId('agenda')).toContainText('1 memory check');
  await expect(page.getByTestId('badge-linear-equations')).toContainText('Memory check');

  await page.getByTestId('start-session').click();
  // Warm-up must not be the skill being checked.
  const warm = await currentProblem(page);
  expect(warm.skillId).not.toBe('linear-equations');
  await fillAnswer(page, warm.answer, correctInput(warm.answer));
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await finishFeedback(page, warm);

  const check = await currentProblem(page);
  expect(check.skillId).toBe('linear-equations');
  expect(check.level).toBeGreaterThanOrEqual(4);
  await expect(page.getByTestId('retention-note')).toBeVisible();
  await fillAnswer(page, check.answer, correctInput(check.answer));
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByTestId('event-mastered')).toBeVisible();
  await finishFeedback(page, check);

  await answerAllCorrectly(page);
  await expect(page.getByTestId('summary').getByTestId('event-mastered')).toBeVisible();
  await page.getByTestId('home').click();
  await expect(page.getByTestId('badge-linear-equations')).toContainText('Mastered');
});

test('once 3 skills are solid, review items hide which skill they are until answered', async ({ page }) => {
  await freshStart(page);
  const old = await dayKey(page, -5);
  await seed(
    page,
    {
      'linear-equations': skill({ lastPracticed: old }),
      'derivatives-power-rule': skill({ lastPracticed: old }),
      'supply-demand-equilibrium': skill({ lastPracticed: old }),
    },
    10,
  );
  await expect(page.getByTestId('agenda')).toContainText('3 reviews due');
  await page.getByTestId('start-session').click();

  let sawHidden = false;
  await answerAllCorrectly(page, async () => {
    const chip = page.getByTestId('skill-chip');
    if ((await chip.innerText()).includes('Mixed review')) {
      sawHidden = true;
      await expect(page.getByRole('button', { name: 'Learn card' })).toHaveCount(0);
    }
  });
  expect(sawHidden).toBe(true);
});

test('a brand-new skill opens with a "what it is for" intro', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('start-session').click();
  await expect(page.getByTestId('new-skill-intro')).toBeVisible();
  await expect(page.getByTestId('new-skill-intro')).toContainText('New skill');
});
