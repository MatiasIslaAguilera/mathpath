import { expect, test } from '@playwright/test';
import { freshStart } from './helpers';

// The Android back gesture is a browser "back": it must move one layer back inside the app,
// ask before throwing away a session, and leave the app only from Home.

test('back from a screen returns to Home, and Home keeps no leftover history entry', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('nav-tree').click();
  await expect(page.getByTestId('tree-item-linear-equations')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('start-session')).toBeVisible();
  expect(await page.evaluate(() => history.state?.mathpath)).toBeUndefined();

  // Leaving by the in-app Back button drops the guard entry too.
  await page.getByTestId('nav-stats').click();
  await page.getByTestId('nav-tree').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('start-session')).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.mathpath)).toBeUndefined();
});

test('back during a session asks first; "Keep going" stays, "End session" leaves', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('start-session').click();
  await expect(page.getByTestId('exercise')).toBeVisible();

  await page.goBack();
  await expect(page.getByTestId('confirm-leave')).toBeVisible();
  await page.getByTestId('confirm-stay').click();
  await expect(page.getByTestId('confirm-leave')).toBeHidden();
  await expect(page.getByTestId('exercise')).toBeVisible();

  // A second back press while the dialog is open closes it (still in the session).
  await page.goBack();
  await expect(page.getByTestId('confirm-leave')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('confirm-leave')).toBeHidden();
  await expect(page.getByTestId('exercise')).toBeVisible();

  await page.goBack();
  await page.getByTestId('confirm-leave-btn').click();
  await expect(page.getByTestId('start-session')).toBeVisible();
});

test('back closes the Learn card before anything else', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('start-session').click();
  await expect(page.getByTestId('exercise')).toBeVisible();
  await page.getByRole('button', { name: 'Learn card' }).first().click();
  await expect(page.getByTestId('learn-card')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('learn-card')).toBeHidden();
  await expect(page.getByTestId('exercise')).toBeVisible();
  await expect(page.getByTestId('confirm-leave')).toBeHidden();
});
