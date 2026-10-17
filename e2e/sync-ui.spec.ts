import { expect, test } from '@playwright/test';
import { freshStart } from './helpers';

test('without Supabase config, Settings says sync is off and Home shows no sync dot', async ({ page }) => {
  await freshStart(page);
  await expect(page.getByTestId('sync-dot')).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByTestId('sync-off')).toHaveText("Sync isn't set up in this build, so progress is saved on this device only.");
  await expect(page.getByTestId('sign-in-form')).toHaveCount(0);
});
