import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { freshStart } from './helpers';

test('daily reminder downloads a repeating calendar file', async ({ page }) => {
  await freshStart(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByTestId('reminder-card')).toBeVisible();
  await page.getByTestId('reminder-time').fill('07:30');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('reminder-ics').click()]);
  expect(download.suggestedFilename()).toBe('mathpath-reminder.ics');
  const text = readFileSync(await download.path(), 'utf8');
  expect(text).toContain('RRULE:FREQ=DAILY');
  expect(text).toContain('T073000');
  const saved = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  expect(saved).toContain('07:30');
});

test('offline banner appears when the browser goes offline', async ({ page, context }) => {
  await freshStart(page);
  await expect(page.getByTestId('offline-banner')).toHaveCount(0);
  await context.setOffline(true);
  await expect(page.getByTestId('offline-banner')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByTestId('offline-banner')).toHaveCount(0);
});

// The dev server has no service worker or manifest, so check the production build output.
test('production build ships a manifest and a precache without .ttf files', async () => {
  test.setTimeout(240_000);
  execSync('npm run build', { stdio: 'ignore' });
  expect(existsSync('dist/manifest.webmanifest')).toBe(true);
  const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
  expect(manifest.name).toBe('MathPath');
  expect(manifest.start_url).toBe('./');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toHaveLength(3);
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);

  expect(existsSync('dist/sw.js')).toBe(true);
  const sw = readFileSync('dist/sw.js', 'utf8');
  const urls = [...sw.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1]);
  expect(urls).toContain('index.html');
  expect(urls.some((u) => /^assets\/index-.*\.js$/.test(u))).toBe(true);
  expect(urls.some((u) => u.endsWith('.ttf'))).toBe(false);
  expect(urls.some((u) => u.endsWith('.woff2'))).toBe(true);
});
