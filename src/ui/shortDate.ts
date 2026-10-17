/** "2026-10-20" → "Oct 20" (parsed by hand so the time zone can't shift the day). */
export function shortDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
