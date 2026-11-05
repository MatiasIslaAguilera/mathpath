// Time on an item. A wrong answer this fast is usually a slip (a misread sign, a typo), not a
// misconception: exponent rules on 2026-11-04 had 6 of 11 misses under 12 s, with correct
// answers taking a median 7 s. Used by the feedback screen, `npm run analyze` and `measure`.

export const FAST_MISS_MS = 12_000;

/** Wrong, unassisted, unexplained by a misconception, and faster than FAST_MISS_MS. */
export function isFastMiss(a: { correct: boolean; help: string; misconception?: string; durationMs?: number }): boolean {
  return !a.correct && a.help === 'none' && !a.misconception && a.durationMs !== undefined && a.durationMs < FAST_MISS_MS;
}
